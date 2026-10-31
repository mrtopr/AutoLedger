import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;
    const customerId = params.id;

    // 1. Try Prisma first if available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId) && isUuid(targetTenantId)) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, tenantId: targetTenantId },
          include: {
            ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 50 },
            invoices: { orderBy: { createdAt: 'desc' }, take: 20, include: { items: true } },
            payments: { orderBy: { createdAt: 'desc' }, take: 20 }
          }
        });

        if (customer) {
          const ledgerChronological = [...customer.ledgerEntries].reverse();
          let currentBalance = 0n;
          const ledgerWithRunning = ledgerChronological.map((entry: any) => {
            const d = entry.debit !== undefined ? BigInt(entry.debit) : BigInt(entry.debitPaise || 0);
            const c = entry.credit !== undefined ? BigInt(entry.credit) : BigInt(entry.creditPaise || 0);
            currentBalance = currentBalance + d - c;
            return {
              id: entry.id,
              date: entry.entryDate ? new Date(entry.entryDate).toISOString().split('T')[0] : entry.createdAt.toISOString().split('T')[0],
              type: entry.entryType,
              refNo: entry.refId || entry.refNumber || '-',
              narration: entry.narration,
              debitPaise: d.toString(),
              creditPaise: c.toString(),
              runningBalancePaise: currentBalance.toString(),
            };
          }).reverse();

          return NextResponse.json({
            success: true,
            customer: {
              id: customer.id,
              name: customer.name,
              shopName: customer.shopName || customer.name,
              phone: customer.phone,
              address: customer.address,
              gstin: customer.gstin,
              balancePaise: currentBalance.toString(),
              creditLimitPaise: customer.creditLimit.toString(),
              status: customer.status,
              termsDays: customer.paymentTermsDays,
              onTimeRate: '94%',
              relationshipDays: 120,
              aging: {
                current: currentBalance > 0n ? currentBalance.toString() : '0',
                days31to60: '0',
                days61to90: '0',
                days90Plus: '0',
              },
              invoices: customer.invoices.map((inv: any) => ({
                id: inv.id,
                invoiceNumber: inv.number || `INV-${inv.id.slice(0, 6)}`,
                status: inv.status,
                cancelReason: inv.cancelReason || null,
                date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : 'Today',
                grandTotalPaise: (inv.grandTotal || 0n).toString(),
                paidNowPaise: (inv.amountPaid || 0n).toString(),
                creditBalancePaise: ((inv.grandTotal || 0n) - (inv.amountPaid || 0n)).toString(),
                itemsCount: inv.items ? inv.items.length : 1,
              })),
              ledger: ledgerWithRunning,
            }
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable for customer detail, using localStore fallback:', dbErr);
      }
    }

    // 2. LocalStore fallback scoped to targetTenantId
    const localCust = localStore.getCustomerById(customerId, targetTenantId);
    if (!localCust) {
      return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
    }

    const ledgerEntries = localStore.getLedger(customerId, targetTenantId);
    const localBal = BigInt(localCust.balancePaise || 0);
    const customerInvoices = localStore.getInvoices(targetTenantId).filter((inv: any) => inv.customerId === customerId).map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber || inv.number || `INV-${inv.id.slice(0, 6)}`,
      status: inv.status || 'ISSUED',
      cancelReason: inv.cancelReason || null,
      date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : 'Today',
      grandTotalPaise: inv.grandTotalPaise || inv.amountPaise || '0',
      paidNowPaise: inv.paidNowPaise || '0',
      creditBalancePaise: inv.creditBalancePaise || '0',
      itemsCount: inv.items ? inv.items.length : 1,
    }));

    return NextResponse.json({
      success: true,
      customer: {
        id: localCust.id,
        name: localCust.name,
        shopName: localCust.shopName,
        phone: localCust.phone,
        address: localCust.address,
        gstin: localCust.gstin,
        balancePaise: localCust.balancePaise || '0',
        creditLimitPaise: localCust.creditLimitPaise || '5000000',
        status: localCust.status,
        termsDays: localCust.termsDays,
        onTimeRate: '92%',
        relationshipDays: 180,
        aging: {
          current: localBal > 0n ? localBal.toString() : '0',
          days31to60: '0',
          days61to90: '0',
          days90Plus: '0',
        },
        invoices: customerInvoices,
        ledger: ledgerEntries,
      }
    });
  } catch (error: any) {
    console.error('Error fetching customer detail:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch customer detail' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }

    const body = await req.json();
    const { name, shopName, phone, address, gstin, creditLimitPaise, termsDays, status } = body;

    // RBAC: Only OWNER or MANAGER can alter credit limit or customer status
    if ((creditLimitPaise !== undefined || status !== undefined) && authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can alter customer credit limits or status' },
        { status: 403 }
      );
    }

    const targetTenantId = authUser.tenantId;
    const customerId = params.id;

    const hasDb = await isPostgresAvailable();
    let dbUpdated = false;

    if (hasDb && isUuid(customerId) && isUuid(targetTenantId)) {
      try {
        const existing = await prisma.customer.findFirst({
          where: { id: customerId, tenantId: targetTenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
        }

        await prisma.customer.update({
          where: { id: customerId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(shopName !== undefined ? { shopName } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(address !== undefined ? { address } : {}),
            ...(gstin !== undefined ? { gstin } : {}),
            ...(creditLimitPaise !== undefined ? { creditLimit: BigInt(creditLimitPaise) } : {}),
            ...(termsDays !== undefined ? { paymentTermsDays: parseInt(termsDays, 10) } : {}),
            ...(status !== undefined ? { status } : {}),
          },
        });
        dbUpdated = true;
      } catch (dbErr) {
        console.warn('Postgres customer update error, fallback to local store:', dbErr);
      }
    }

    const updated = localStore.updateCustomer(customerId, {
      ...(name !== undefined ? { name } : {}),
      ...(shopName !== undefined ? { shopName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(gstin !== undefined ? { gstin } : {}),
      ...(creditLimitPaise !== undefined ? { creditLimitPaise: String(creditLimitPaise) } : {}),
      ...(termsDays !== undefined ? { termsDays: parseInt(termsDays, 10) } : {}),
      ...(status !== undefined ? { status } : {}),
    }, targetTenantId);

    if (!dbUpdated && !updated) {
      return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: creditLimitPaise !== undefined ? 'LIMIT_CHANGED' : 'CUSTOMER_UPDATED',
      entity: 'CUSTOMER',
      entityId: customerId,
      after: {
        name,
        shopName,
        phone,
        creditLimitPaise,
        status,
        termsDays,
      },
    });

    return NextResponse.json({
      success: true,
      customer: updated || { id: customerId, ...body },
    });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: error.message || 'Failed to update customer' }, { status: 500 });
  }
}

export const PUT = PATCH;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can delete customer records' },
        { status: 403 }
      );
    }

    const targetTenantId = authUser.tenantId;
    const customerId = params.id;

    const hasDb = await isPostgresAvailable();
    let dbDeleted = false;

    if (hasDb && isUuid(customerId) && isUuid(targetTenantId)) {
      try {
        const existing = await prisma.customer.findFirst({
          where: { id: customerId, tenantId: targetTenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
        }

        await prisma.customer.update({
          where: { id: customerId },
          data: { isActive: false },
        });
        dbDeleted = true;
      } catch (dbErr) {
        console.warn('Postgres customer delete error, fallback:', dbErr);
      }
    }

    const localDeleted = localStore.deleteCustomer(customerId, targetTenantId);
    if (!dbDeleted && !localDeleted) {
      return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'CUSTOMER_DELETED',
      entity: 'CUSTOMER',
      entityId: customerId,
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete customer' }, { status: 500 });
  }
}
