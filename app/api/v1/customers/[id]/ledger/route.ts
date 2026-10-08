import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { LedgerEntryType } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const customerId = params.id;
    const body = await req.json();

    const {
      type = 'DEBIT', // 'DEBIT' (Udhar / Receivable) or 'CREDIT' (Payment / Advance / Payable)
      amountPaise,
      date,
      refNo,
      narration,
    } = body;

    if (!amountPaise || BigInt(amountPaise) <= 0n) {
      return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
    }

    const amt = BigInt(amountPaise);
    const isDebit = type === 'DEBIT' || type === 'DUE';
    const entryDate = date ? new Date(date) : new Date();
    const cleanRef = refNo || (isDebit ? `UDHAR-${Date.now()}` : `CREDIT-${Date.now()}`);
    const cleanNarration = narration || (isDebit ? 'Manual Debit / Past Udhar Entry' : 'Manual Credit / Advance Entry');
    const targetTenantId = authUser?.tenantId || 'tenant-apex-1';

    // 1. Try Postgres DB if available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId)) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
        });

        if (customer) {
          await prisma.ledgerEntry.create({
            data: {
              tenantId: customer.tenantId,
              customerId: customer.id,
              entryType: isDebit ? LedgerEntryType.DEBIT_NOTE : LedgerEntryType.ADJUSTMENT,
              debit: isDebit ? amt : 0n,
              credit: isDebit ? 0n : amt,
              entryDate: entryDate,
              refId: null,
              narration: cleanNarration,
            }
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable during manual ledger entry, using localStore fallback:', dbErr);
      }
    }

    // 2. Always persist into localStore
    const entry = localStore.addLedgerEntry({
      tenantId: targetTenantId,
      customerId,
      date: entryDate.toISOString().split('T')[0],
      type: isDebit ? 'MANUAL_DEBIT' : 'MANUAL_CREDIT',
      refNo: cleanRef,
      narration: cleanNarration,
      debitPaise: isDebit ? amt.toString() : '0',
      creditPaise: isDebit ? '0' : amt.toString(),
    });

    const localCust = localStore.getCustomerById(customerId);

    return NextResponse.json({
      success: true,
      message: isDebit ? 'Debit / Udhar entry recorded successfully' : 'Credit / Advance entry recorded successfully',
      ledgerEntry: entry,
      newBalancePaise: localCust?.balancePaise || '0',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording manual ledger entry:', error);
    return NextResponse.json({ error: error.message || 'Failed to record ledger entry' }, { status: 500 });
  }
}
