import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';

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

    const { amountPaise, mode = 'UPI', referenceNumber } = body;

    if (!amountPaise || BigInt(amountPaise) <= 0n) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    const amt = BigInt(amountPaise);
    const ref = referenceNumber || `${mode}/${Date.now()}`;
    const targetTenantId = authUser?.tenantId || 'tenant-royal-1';

    // 1. Try Prisma first if DB available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId)) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
        });

        if (customer) {
          let paymentModeEnum: PaymentMode = PaymentMode.UPI;
          if (mode === 'CASH') paymentModeEnum = PaymentMode.CASH;
          else if (mode === 'BANK') paymentModeEnum = PaymentMode.BANK;
          else if (mode === 'CHEQUE') paymentModeEnum = PaymentMode.CHEQUE;

          const payment = await prisma.payment.create({
            data: {
              tenantId: customer.tenantId,
              customerId: customer.id,
              amount: amt,
              mode: paymentModeEnum,
              reference: ref,
              status: PaymentStatus.CLEARED,
              receivedBy: authUser?.id || null,
            }
          });

          await prisma.ledgerEntry.create({
            data: {
              tenantId: customer.tenantId,
              customerId: customer.id,
              entryType: LedgerEntryType.PAYMENT,
              refId: payment.id,
              debit: 0n,
              credit: amt,
              narration: `Payment received via ${mode} (Ref: ${ref})`,
            }
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable during payment, using localStore fallback');
      }
    }

    // 2. Always persist payment & ledger in localStore
    localStore.createPayment({
      tenantId: targetTenantId,
      customerId,
      amountPaise: amt.toString(),
      mode,
      referenceNumber: ref,
    });

    const localCust = localStore.getCustomerById(customerId);
    const currentBal = BigInt(localCust?.balancePaise || '0');
    const newBal = currentBal >= amt ? currentBal - amt : 0n;

    const entry = localStore.addLedgerEntry({
      tenantId: targetTenantId,
      customerId,
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT',
      refNo: ref,
      narration: `Payment received via ${mode} (Ref: ${ref})`,
      debitPaise: '0',
      creditPaise: amt.toString(),
    });

    return NextResponse.json({
      success: true,
      ledgerEntryId: entry.id,
      newBalancePaise: newBal.toString(),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: error.message || 'Failed to record payment' }, { status: 500 });
  }
}
