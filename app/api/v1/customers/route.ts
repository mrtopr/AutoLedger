import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { CreditStatus, CustomerType } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';

    let formatted: any[] = [];

    // 1. Try Prisma first if Postgres is available
    const hasDb = await isPostgresAvailable();
    if (hasDb && (!authUser?.tenantId || isUuid(authUser.tenantId))) {
      try {
        const customers = await prisma.customer.findMany({
          where: {
            ...(authUser?.tenantId && isUuid(authUser.tenantId) ? { tenantId: authUser.tenantId } : {}),
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
      } catch (dbErr) {
        console.warn('Postgres unavailable for customers GET, using localStore fallback');
      }
    }

    // 2. If no customers from DB, use localStore
    if (formatted.length === 0) {
      const localCusts = localStore.getCustomers(authUser?.tenantId);
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
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();

    const {
      name,
      shopName,
      phone,
      address,
      gstin,
      creditLimitPaise = 5000000n,
      paymentTermsDays = 15,
      customerType = 'RETAILER',
      openingBalancePaise = '0',
      openingBalanceType = 'DUE', // 'DUE' (Dr / Udhar) or 'ADVANCE' (Cr)
      openingBalanceDate,
      openingBalanceNarration,
    } = body;

    if (!shopName || !phone) {
      return NextResponse.json(
        { error: 'Shop name and phone number are required' },
        { status: 400 }
      );
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-apex-1';
    let createdCust: any = null;
    const initialBalPaise = BigInt(openingBalancePaise || 0);
    const isDueBal = openingBalanceType === 'DUE';
    const netBalPaise = isDueBal ? initialBalPaise : -initialBalPaise;
    const defaultNarration = openingBalanceNarration || (isDueBal ? 'Opening Balance (Previous Udhar)' : 'Opening Balance (Advance Deposit)');
    const entryDate = openingBalanceDate ? new Date(openingBalanceDate) : new Date();

    // 1. Try Prisma if available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const customer = await prisma.customer.create({
          data: {
            tenantId: targetTenantId,
            name: name || shopName,
            shopName: shopName || name,
            phone,
            address: address || null,
            gstin: gstin || null,
            creditLimit: BigInt(creditLimitPaise),
            paymentTermsDays: parseInt(paymentTermsDays, 10) || 15,
            customerType: customerType as CustomerType,
            status: CreditStatus.GREEN,
            isActive: true,
          }
        });

        if (initialBalPaise > 0n) {
          await prisma.ledgerEntry.create({
            data: {
              tenantId: targetTenantId,
              customerId: customer.id,
              entryType: 'ADJUSTMENT' as any,
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
          shopName: customer.shopName,
          phone: customer.phone,
          balancePaise: netBalPaise.toString(),
          creditLimitPaise: customer.creditLimit.toString(),
        };
      } catch (dbErr) {
        console.warn('Postgres unavailable during customer create, using localStore fallback');
      }
    }

    // 2. Always persist in localStore as well
    const localCust = localStore.createCustomer({
      tenantId: targetTenantId,
      name: name || shopName,
      shopName: shopName || name,
      phone,
      address: address || 'Pune, Maharashtra',
      gstin: gstin || null,
      customerType: customerType || 'RETAILER',
      balancePaise: netBalPaise.toString(),
      creditLimitPaise: String(creditLimitPaise || 5000000),
      status: 'GREEN',
      termsDays: parseInt(paymentTermsDays, 10) || 15,
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
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: 500 }
    );
  }
}
