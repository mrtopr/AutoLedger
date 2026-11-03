import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable, getStorageMode } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { CreditStatus, CustomerType, LedgerEntryType } from '@prisma/client';
import { CreateCustomerSchema, CustomerDTO } from './schema';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';

    let formatted: CustomerDTO[] = [];
    let dbSuccess = false;

    // 1. Try Prisma first if Postgres is available
    const hasDb = await isPostgresAvailable();
    const effectiveTenantId = isUuid(targetTenantId) ? (targetTenantId as string) : null;

    if (hasDb && effectiveTenantId) {
      try {
        const customers = await prisma.customer.findMany({
          where: {
            tenantId: effectiveTenantId,
            isActive: true,
            ...(query ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { shopName: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
              ]
            } : {}),
            ...(status && status !== 'ALL' ? { status: status as CreditStatus } : {}),
          },
          include: {
            ledgerEntries: { select: { debit: true, credit: true } },
            invoices: {
              where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
              select: { grandTotal: true, dueDate: true }
            }
          },
          orderBy: { createdAt: 'desc' },
        });

        if (customers.length > 0) {
          const now = new Date();
          formatted = customers.map((c) => {
            const balancePaise = c.ledgerEntries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0n);
            let overduePaise = 0n;
            for (const inv of c.invoices) {
              if (inv.dueDate && new Date(inv.dueDate) < now) overduePaise += inv.grandTotal;
            }
            return {
              id: c.id,
              name: c.name,
              shopName: c.shopName || c.name,
              phone: c.phone || '',
              address: c.address || 'Pune, Maharashtra',
              gstin: c.gstin,
              customerType: c.customerType,
              balancePaise: balancePaise.toString(),
              creditLimitPaise: c.creditLimit.toString(),
              status: c.status,
              termsDays: c.paymentTermsDays,
              overduePaise: overduePaise.toString(),
              lastOrderDaysAgo: 2,
            };
          });
        }
        dbSuccess = true;
      } catch (dbErr) {
        console.warn('Postgres unavailable for customers GET, using localStore fallback');
      }
    }

    // 2. If DB offline or query failed, use localStore
    if (!dbSuccess) {
      const localCusts = localStore.getCustomers(targetTenantId);
      formatted = localCusts.map((c) => ({
        id: c.id,
        name: c.name,
        shopName: c.shopName,
        phone: c.phone,
        address: c.address,
        gstin: c.gstin || null,
        customerType: c.customerType,
        balancePaise: c.balancePaise || '0',
        creditLimitPaise: c.creditLimitPaise || '5000000',
        status: c.status,
        termsDays: c.termsDays,
        overduePaise: c.overduePaise || '0',
        lastOrderDaysAgo: 2,
      }));
    }

    // Filter
    let filtered = formatted;
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.shopName.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter(c => c.status === status);
    }

    return NextResponse.json({ success: true, count: filtered.length, customers: filtered });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Failed to fetch customers';
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    const body = await req.json().catch(() => ({}));
    const parseResult = CreateCustomerSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid customer input';
      return NextResponse.json({ error: firstError, details: parseResult.error.flatten() }, { status: 400 });
    }

    const {
      name,
      shopName,
      phone,
      address,
      gstin,
      creditLimitPaise: rawCreditLimitPaise,
      creditLimitRupees,
      paymentTermsDays = 15,
      customerType = 'RETAILER',
      openingBalancePaise = '0',
      openingBalanceType = 'DUE',
      openingBalanceDate,
      openingBalanceNarration,
    } = parseResult.data;

    const creditLimitPaise = rawCreditLimitPaise !== undefined
      ? BigInt(rawCreditLimitPaise)
      : (creditLimitRupees !== undefined ? BigInt(Math.round(Number(creditLimitRupees) * 100)) : 5000000n);

    const effectiveName = name || shopName;
    const effectiveShopName = shopName || name;

    if (!effectiveName || !phone) {
      return NextResponse.json(
        { error: 'Customer name and phone number are required' },
        { status: 400 }
      );
    }

    let createdCust: Partial<CustomerDTO> | null = null;
    const initialBalPaise = BigInt(openingBalancePaise || 0);
    const isDueBal = openingBalanceType === 'DUE';
    const netBalPaise = isDueBal ? initialBalPaise : -initialBalPaise;
    const defaultNarration = openingBalanceNarration || (isDueBal ? 'Opening Balance (Previous Udhar)' : 'Opening Balance (Advance Deposit)');
    const entryDate = openingBalanceDate ? new Date(openingBalanceDate) : new Date();

    // 1. Try Prisma if available
    const hasDb = await isPostgresAvailable();
    const dbTenantId = isUuid(targetTenantId) ? targetTenantId : null;

    let cType: CustomerType = CustomerType.GARAGE;
    if (customerType === 'RETAILER' || customerType === 'DISTRIBUTOR' || customerType === 'WHOLESALER') {
      cType = CustomerType.RETAILER;
    } else if (customerType === 'WALK_IN') {
      cType = CustomerType.WALK_IN;
    }

    // Fail-safe: In production / PostgreSQL storage mode, never silently fall back to localStore
    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Customer record cannot be safely saved.' },
        { status: 503 }
      );
    }

    if (hasDb && dbTenantId) {
      try {
        const customer = await prisma.customer.create({
          data: {
            tenantId: dbTenantId,
            name: name || shopName || 'Walk-in Customer',
            shopName: shopName || name || 'Walk-in Workshop',
            phone,
            address: address || null,
            gstin: gstin || null,
            creditLimit: BigInt(creditLimitPaise || 5000000),
            paymentTermsDays: Number(paymentTermsDays) || 15,
            customerType: cType,
            status: CreditStatus.GREEN,
            isActive: true,
          }
        });

        if (initialBalPaise > 0n) {
          await prisma.ledgerEntry.create({
            data: {
              tenantId: dbTenantId,
              customerId: customer.id,
              entryType: LedgerEntryType.ADJUSTMENT,
              debit: isDueBal ? initialBalPaise : 0n,
              credit: isDueBal ? 0n : initialBalPaise,
              entryDate: entryDate,
              narration: defaultNarration,
            }
          });
        }

        createdCust = {
          id: customer.id,
          name: customer.name,
          shopName: customer.shopName || customer.name,
          phone: customer.phone || '',
          balancePaise: netBalPaise.toString(),
          creditLimitPaise: customer.creditLimit.toString(),
        };
      } catch (dbErr: unknown) {
        const dbMsg = dbErr instanceof Error ? dbErr.message : 'Database error';
        if (getStorageMode() === 'POSTGRES') {
          console.error('Postgres error during customer create:', dbMsg);
          return NextResponse.json(
            { error: 'Failed to create customer in database' },
            { status: 500 }
          );
        }
        console.warn('Postgres unavailable during customer create, using localStore fallback');
      }
    }

    // 2. Always persist in localStore as well
    const localCust = localStore.createCustomer({
      tenantId: targetTenantId,
      name: name || shopName || 'Walk-in Customer',
      shopName: shopName || name || 'Walk-in Workshop',
      phone,
      address: address || 'Pune, Maharashtra',
      gstin: gstin || null,
      customerType: customerType || 'RETAILER',
      balancePaise: netBalPaise.toString(),
      creditLimitPaise: String(creditLimitPaise || 5000000),
      status: 'GREEN',
      termsDays: Number(paymentTermsDays) || 15,
      overduePaise: '0',
    });

    if (initialBalPaise > 0n) {
      localStore.addLedgerEntry({
        tenantId: targetTenantId,
        customerId: localCust.id,
        date: entryDate.toISOString().split('T')[0],
        type: isDueBal ? 'OPENING_DUE' : 'OPENING_ADVANCE',
        refNo: 'OPENING-BAL',
        narration: defaultNarration,
        debitPaise: isDueBal ? initialBalPaise.toString() : '0',
        creditPaise: isDueBal ? '0' : initialBalPaise.toString(),
      });
      // Ensure local balance is set correctly
      localCust.balancePaise = netBalPaise.toString();
    }

    return NextResponse.json({
      success: true,
      customer: createdCust || localCust,
    }, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to create customer';
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
