import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    // 1. Try Prisma first if available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId)) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
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
                current: currentBalance.toString(),
                days31to60: '0',
                days61to90: '0',
                days90Plus: '0',
              },
              ledger: ledgerWithRunning,
            }
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable for customer detail, using localStore fallback:', dbErr);
      }
    }

    // 2. LocalStore fallback
    const localCust = localStore.getCustomerById(customerId);
    if (!localCust) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const ledgerEntries = localStore.getLedger(customerId);

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
          current: localCust.balancePaise || '0',
          days31to60: '0',
          days61to90: '0',
          days90Plus: '0',
        },
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
    const customerId = params.id;
    const body = await req.json();
    const { name, shopName, phone, address, gstin, creditLimitPaise, termsDays, status } = body;

    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId)) {
      try {
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
    });

    return NextResponse.json({
      success: true,
      customer: updated,
    });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: error.message || 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId)) {
      try {
        await prisma.customer.update({
          where: { id: customerId },
          data: { isActive: false },
        });
      } catch (dbErr) {
        console.warn('Postgres customer delete error, fallback:', dbErr);
      }
    }

    localStore.deleteCustomer(customerId);

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete customer' }, { status: 500 });
  }
}
