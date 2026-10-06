import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { allocatePayment, OpenInvoice, ManualAllocationLine } from '@/server/lib/allocation';
import { LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-royal-1';

    let payments: any[] = [];
    const hasDb = await isPostgresAvailable();

    if (hasDb && isUuid(targetTenantId) && (!customerId || isUuid(customerId))) {
      try {
        const whereClause: any = { tenantId: targetTenantId };
        if (customerId) {
          whereClause.customerId = customerId;
        }

        const dbPayments = await prisma.payment.findMany({
          where: whereClause,
          include: {
            customer: { select: { id: true, name: true, shopName: true, phone: true } },
            allocations: {
              include: {
                invoice: { select: { id: true, number: true, grandTotal: true, balanceDue: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        if (dbPayments.length > 0) {
          payments = dbPayments.map((p) => ({
            id: p.id,
            customerId: p.customerId,
            customerName: p.customer?.name || 'Customer',
            customerShop: p.customer?.shopName || 'Customer',
            customerPhone: p.customer?.phone || '',
            amountPaise: p.amount.toString(),
            mode: p.mode,
            referenceNumber: p.reference || '',
            status: p.status,
            createdAt: p.createdAt.toISOString(),
            allocations: p.allocations.map((a) => ({
              id: a.id,
              invoiceId: a.invoiceId,
              invoiceNumber: a.invoice?.number || '',
              amountPaise: a.amount.toString(),
            })),
          }));
        }
      } catch (err) {
        console.warn('Postgres unavailable for payments GET, using localStore fallback');
      }
    }

    if (payments.length === 0) {
      let localPays = localStore.getPayments(targetTenantId);
      if (customerId) {
        localPays = localPays.filter((p) => p.customerId === customerId);
      }
      payments = localPays.map((p) => {
        const cust = localStore.getCustomerById(p.customerId);
        return {
          id: p.id,
          customerId: p.customerId,
          customerName: cust?.name || 'Customer',
          customerShop: cust?.shopName || 'Customer',
          customerPhone: cust?.phone || '',
          amountPaise: p.amountPaise,
          mode: p.mode,
          referenceNumber: p.referenceNumber,
          status: 'CLEARED',
          createdAt: p.createdAt,
          allocations: [],
        };
      });
    }

    return NextResponse.json({ success: true, payments });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();

    const {
      customerId,
      amountPaise,
      mode = 'UPI',
      referenceNumber,
      notes,
      strategy = 'OLDEST_FIRST',
      allocations: requestedAllocations = [],
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    if (!amountPaise || BigInt(amountPaise) <= 0n) {
      return NextResponse.json({ error: 'Valid payment amount in paise is required' }, { status: 400 });
    }

    const amt = BigInt(amountPaise);
    const ref = referenceNumber || `${mode}/${Date.now()}`;
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-royal-1';

    let paymentModeEnum: PaymentMode = PaymentMode.UPI;
    if (mode === 'CASH') paymentModeEnum = PaymentMode.CASH;
    else if (mode === 'BANK') paymentModeEnum = PaymentMode.BANK;
    else if (mode === 'CHEQUE') paymentModeEnum = PaymentMode.CHEQUE;

    let createdPaymentId = `pay-${Date.now()}`;
    let computedAllocations: { invoiceId: string; amount: bigint }[] = [];
    let unallocatedAdvance = amt;

    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(customerId)) {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
        });

        if (customer) {
          // Fetch open invoices with positive balance
          const openInvoices = await prisma.invoice.findMany({
            where: {
              customerId,
              tenantId: customer.tenantId,
              balanceDue: { gt: 0n },
            },
            orderBy: { dueDate: 'asc' },
          });

          const parsedInvoices: OpenInvoice[] = openInvoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            balanceDue: inv.balanceDue,
            dueDate: inv.dueDate,
          }));

          const manualLines: ManualAllocationLine[] = requestedAllocations.map((a: any) => ({
            invoiceId: a.invoiceId,
            amount: BigInt(a.amountPaise || a.amount || 0),
          }));

          const allocResult = allocatePayment(
            amt,
            parsedInvoices,
            strategy === 'MANUAL' ? 'MANUAL' : 'OLDEST_FIRST',
            manualLines
          );

          computedAllocations = allocResult.allocations;
          unallocatedAdvance = allocResult.unallocatedAdvance;

          // Prisma transaction
          const payment = await prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
              data: {
                tenantId: customer.tenantId,
                customerId: customer.id,
                amount: amt,
                mode: paymentModeEnum,
                reference: ref,
                status: PaymentStatus.CLEARED,
                notes: notes || null,
                receivedBy: authUser?.id || null,
              },
            });

            // Create allocations and update invoice balances
            for (const alloc of computedAllocations) {
              await tx.paymentAllocation.create({
                data: {
                  paymentId: p.id,
                  invoiceId: alloc.invoiceId,
                  amount: alloc.amount,
                  strategy,
                },
              });

              const targetInv = openInvoices.find((i) => i.id === alloc.invoiceId);
              if (targetInv) {
                const newBalance = targetInv.balanceDue - alloc.amount;
                const newPaid = targetInv.amountPaid + alloc.amount;
                await tx.invoice.update({
                  where: { id: alloc.invoiceId },
                  data: {
                    balanceDue: newBalance,
                    amountPaid: newPaid,
                    status: newBalance <= 0n ? 'PAID' : 'PARTIALLY_PAID',
                  },
                });
              }
            }

            // Ledger Entry
            await tx.ledgerEntry.create({
              data: {
                tenantId: customer.tenantId,
                customerId: customer.id,
                entryType: LedgerEntryType.PAYMENT,
                refId: p.id,
                debit: 0n,
                credit: amt,
                narration: `Payment received via ${mode} (Ref: ${ref})`,
              },
            });

            return p;
          });

          createdPaymentId = payment.id;
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable for payment create, using localStore fallback');
      }
    }

    // Always update localStore
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
      runningBalancePaise: newBal.toString(),
    });

    return NextResponse.json(
      {
        success: true,
        paymentId: createdPaymentId,
        ledgerEntryId: entry.id,
        newBalancePaise: newBal.toString(),
        allocations: computedAllocations.map((a) => ({
          invoiceId: a.invoiceId,
          amountPaise: a.amount.toString(),
        })),
        unallocatedAdvancePaise: unallocatedAdvance.toString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: error.message || 'Failed to create payment' }, { status: 500 });
  }
}
