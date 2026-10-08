import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, amountPaise, mode = 'UPI', referenceNumber = `UPI/${Date.now().toString().slice(-8)}` } = body;

    if (!customerId || !amountPaise) {
      return NextResponse.json(
        { error: 'Missing customerId or amountPaise in payment request.' },
        { status: 400 }
      );
    }

    const amt = BigInt(amountPaise);
    if (amt <= 0n) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero.' },
        { status: 400 }
      );
    }

    const narration = `Self-Settlement via Customer Portal (${mode} Ref: ${referenceNumber})`;

    // 1. Try Prisma if available
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          include: { ledgerEntries: true },
        });
        if (customer) {
          let currentBalance = 0n;
          for (const entry of customer.ledgerEntries || []) {
            currentBalance = currentBalance + (entry.debit || 0n) - (entry.credit || 0n);
          }
          const newBal = currentBalance - amt;

          await prisma.$transaction([
            prisma.payment.create({
              data: {
                tenantId: customer.tenantId,
                customerId: customer.id,
                amount: amt,
                mode: mode === 'UPI' ? 'UPI' : 'BANK',
                reference: referenceNumber,
                status: 'CLEARED',
                notes: narration,
              },
            }),
            prisma.ledgerEntry.create({
              data: {
                tenantId: customer.tenantId,
                customerId: customer.id,
                entryType: 'PAYMENT',
                credit: amt,
                debit: 0n,
                narration,
              },
            }),
          ]);

          return NextResponse.json({
            success: true,
            message: 'Payment recorded and Khata ledger credited successfully.',
            newBalancePaise: newBal.toString(),
          });
        }
      } catch (dbErr) {
        console.warn('Postgres customer payment failed, fallback to localStore:', dbErr);
      }
    }

    // 2. LocalStore fallback
    const localCust = localStore.getCustomerById(customerId);
    if (!localCust) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    const entry = localStore.addLedgerEntry({
      tenantId: localCust.tenantId || 'tenant-honda-1',
      customerId: localCust.id,
      type: 'PAYMENT',
      refNo: referenceNumber,
      narration,
      debitPaise: '0',
      creditPaise: amt.toString(),
    });

    const updatedCust = localStore.getCustomerById(customerId);

    return NextResponse.json({
      success: true,
      message: 'Payment recorded and Khata ledger credited successfully.',
      newBalancePaise: updatedCust?.balancePaise || '0',
      ledgerEntry: entry,
    });
  } catch (error: any) {
    console.error('Error recording portal payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record portal payment.' },
      { status: 500 }
    );
  }
}
