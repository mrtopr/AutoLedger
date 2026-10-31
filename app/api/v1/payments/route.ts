import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable, getStorageMode } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { allocatePayment, OpenInvoice, ManualAllocationLine } from '@/server/lib/allocation';
import { LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';
import { createAuditLog } from '@/server/lib/audit';

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
    const customerId = searchParams.get('customerId');

    let payments: any[] = [];
    const hasDb = await isPostgresAvailable();
    const effectiveTenantId = isUuid(targetTenantId) ? targetTenantId : null;

    if (hasDb && effectiveTenantId && (!customerId || isUuid(customerId))) {
      try {
        const whereClause: any = { tenantId: effectiveTenantId };
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
        const cust = p.customerId ? localStore.getCustomerById(p.customerId, targetTenantId) : undefined;
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

const paymentIdempotencyCache = new Map<string, {
  paymentId: string;
  customerId?: string;
  ledgerEntryId?: string;
  amountPaise: string;
  newBalancePaise: string;
  allocations: { invoiceId: string; amountPaise: string }[];
  unallocatedAdvancePaise: string;
  timestamp: number;
}>();

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    const body = await req.json();

    const {
      customerId,
      amountPaise,
      referenceNumber,
      notes,
      strategy = 'OLDEST_FIRST',
      allocations: requestedAllocations = [],
    } = body;

    const effectiveAmountPaise = (amountPaise !== undefined && amountPaise !== null && amountPaise !== '')
      ? String(amountPaise)
      : (body.amountRupees !== undefined ? String(Math.round(Number(body.amountRupees) * 100)) : '');
    const mode = body.mode || body.paymentMode || 'UPI';

    const idempotencyKey = (
      req.headers.get('idempotency-key') ||
      body.idempotencyKey ||
      body.clientRequestId ||
      ''
    ).trim();

    if (idempotencyKey) {
      const cacheKey = `${targetTenantId}:${idempotencyKey}`;
      const cached = paymentIdempotencyCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
        if (customerId && cached.customerId && customerId !== cached.customerId) {
          return NextResponse.json(
            { error: 'Idempotency key conflict: This key was previously used for a payment to a different customer' },
            { status: 409 }
          );
        }
        if (effectiveAmountPaise && cached.amountPaise && BigInt(effectiveAmountPaise) !== BigInt(cached.amountPaise)) {
          return NextResponse.json(
            { error: 'Idempotency key conflict: Payment amount does not match original transaction' },
            { status: 409 }
          );
        }
        return NextResponse.json({
          success: true,
          isDuplicate: true,
          paymentId: cached.paymentId,
          ledgerEntryId: cached.ledgerEntryId,
          newBalancePaise: cached.newBalancePaise,
          allocations: cached.allocations,
          unallocatedAdvancePaise: cached.unallocatedAdvancePaise,
        }, { status: 200 });
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const numAmt = Number(effectiveAmountPaise);
    if (!effectiveAmountPaise || !Number.isFinite(numAmt) || BigInt(effectiveAmountPaise) <= 0n) {
      return NextResponse.json({ error: 'Valid payment amount in paise is required' }, { status: 400 });
    }

    const amt = BigInt(effectiveAmountPaise);
    const ref = referenceNumber || `${mode}/${Date.now()}`;

    let paymentModeEnum: PaymentMode = PaymentMode.UPI;
    if (mode === 'CASH') paymentModeEnum = PaymentMode.CASH;
    else if (mode === 'BANK') paymentModeEnum = PaymentMode.BANK;
    else if (mode === 'CHEQUE') paymentModeEnum = PaymentMode.CHEQUE;

    let createdPaymentId = `pay-${Date.now()}`;
    let computedAllocations: { invoiceId: string; amount: bigint }[] = [];
    let unallocatedAdvance = amt;

    const hasDb = await isPostgresAvailable();
    const dbCustomerId = isUuid(customerId) ? customerId : null;

    if (hasDb && dbCustomerId && isUuid(targetTenantId)) {
      try {
        if (idempotencyKey) {
          const existingPayment = await prisma.payment.findFirst({
            where: { tenantId: targetTenantId, idempotencyKey },
            include: { allocations: true },
          });
          if (existingPayment) {
            if (customerId && existingPayment.customerId !== customerId) {
              return NextResponse.json(
                { error: 'Idempotency key conflict: This key was previously used for a payment to a different customer' },
                { status: 409 }
              );
            }
            if (amountPaise && existingPayment.amount !== amt) {
              return NextResponse.json(
                { error: 'Idempotency key conflict: Payment amount does not match original transaction' },
                { status: 409 }
              );
            }
            return NextResponse.json({
              success: true,
              isDuplicate: true,
              paymentId: existingPayment.id,
              amountPaise: existingPayment.amount.toString(),
              allocations: existingPayment.allocations.map((a) => ({
                invoiceId: a.invoiceId,
                amountPaise: a.amount.toString(),
              })),
            }, { status: 200 });
          }
        }

        const customer = await prisma.customer.findFirst({
          where: { id: dbCustomerId, tenantId: targetTenantId },
        });

        if (!customer) {
          return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
        }

        if (customer) {
          // Fetch open invoices with positive balance (excluding cancelled invoices and draft requisitions)
          const openInvoices = await prisma.invoice.findMany({
            where: {
              customerId: dbCustomerId,
              tenantId: targetTenantId,
              balanceDue: { gt: 0n },
              status: { notIn: ['CANCELLED', 'DRAFT'] },
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

          // Prisma transaction with safety timeout
          const payment = await prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
              data: {
                tenantId: customer.tenantId,
                customerId: customer.id,
                amount: amt,
                mode: paymentModeEnum,
                reference: ref,
                status: PaymentStatus.CLEARED,
                idempotencyKey: idempotencyKey || null,
                notes: notes || null,
                receivedBy: (authUser?.id && isUuid(authUser.id)) ? authUser.id : null,
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

            // Immutable Audit Trail Entry
            await createAuditLog({
              tenantId: customer.tenantId,
              userId: authUser.id,
              action: 'PAYMENT_RECEIVED',
              entity: 'PAYMENT',
              entityId: p.id,
              after: {
                customerId: customer.id,
                amountPaise: amt.toString(),
                mode,
                reference: ref,
                allocatedCount: computedAllocations.length,
              },
            }, tx);

            return p;
          }, { maxWait: 10000, timeout: 25000 });

          createdPaymentId = payment.id;
        }
      } catch (dbErr: any) {
        if (dbErr?.code === 'P2002' && idempotencyKey) {
          // Concurrent race won by another request with the same idempotency key
          let winningPayment = await prisma.payment.findFirst({
            where: { tenantId: targetTenantId, idempotencyKey },
            include: { allocations: true },
          });
          if (!winningPayment) {
            await new Promise((r) => setTimeout(r, 200));
            winningPayment = await prisma.payment.findFirst({
              where: { tenantId: targetTenantId, idempotencyKey },
              include: { allocations: true },
            });
          }
          if (winningPayment) {
            return NextResponse.json({
              success: true,
              isDuplicate: true,
              paymentId: winningPayment.id,
              amountPaise: winningPayment.amount.toString(),
              allocations: winningPayment.allocations.map((a) => ({
                invoiceId: a.invoiceId,
                amountPaise: a.amount.toString(),
              })),
            }, { status: 200 });
          }
        }
        console.error('Postgres transaction failed for payment create:', dbErr?.message || dbErr);
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
      }
    } else {
      // Offline / LocalStore fallback path: check idempotency
      if (idempotencyKey) {
        const existingLocal = localStore.getPaymentByIdempotencyKey(targetTenantId, idempotencyKey);
        if (existingLocal) {
          if (customerId && existingLocal.customerId !== customerId) {
            return NextResponse.json(
              { error: 'Idempotency key conflict: This key was previously used for a payment to a different customer' },
              { status: 409 }
            );
          }
          if (amountPaise && existingLocal.amountPaise !== amt.toString()) {
            return NextResponse.json(
              { error: 'Idempotency key conflict: Payment amount does not match original transaction' },
              { status: 409 }
            );
          }
          return NextResponse.json({
            success: true,
            isDuplicate: true,
            paymentId: existingLocal.id,
            amountPaise: existingLocal.amountPaise,
            storage: 'localStore',
          }, { status: 200 });
        }
      }
    }

    // Fail-safe: In production / PostgreSQL storage mode, never silently fall back to localStore
    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Payment cannot be safely recorded.' },
        { status: 503 }
      );
    }

    // Update localStore mirror
    localStore.createPayment({
      tenantId: targetTenantId,
      customerId,
      amountPaise: amt.toString(),
      mode,
      referenceNumber: ref,
      idempotencyKey: idempotencyKey || undefined,
    });

    const localCust = localStore.getCustomerById(customerId, targetTenantId);
    if (!hasDb && !localCust) {
      return NextResponse.json({ error: 'Customer not found in your organization' }, { status: 404 });
    }
    const currentBal = BigInt(localCust?.balancePaise || '0');
    const newBal = currentBal >= amt ? currentBal - amt : 0n;

    // Update localStore open invoices
    const targetInvoiceId = body.invoiceId || (requestedAllocations && requestedAllocations[0]?.invoiceId);
    if (targetInvoiceId) {
      const inv = localStore.getInvoiceById(targetInvoiceId, targetTenantId);
      if (inv) {
        const prevBal = BigInt(inv.creditBalancePaise || '0');
        const prevPaid = BigInt(inv.paidNowPaise || '0');
        const alloc = prevBal > amt ? amt : prevBal;
        inv.paidNowPaise = (prevPaid + alloc).toString();
        inv.creditBalancePaise = (prevBal - alloc).toString();
        inv.status = inv.creditBalancePaise === '0' ? 'PAID' : 'PARTIALLY_PAID';
        localStore.save();
      }
    } else {
      let remaining = amt;
      const localInvoices = localStore.getInvoices(targetTenantId)
        .filter(i => i.customerId === customerId && i.status !== 'CANCELLED' && BigInt(i.creditBalancePaise || '0') > 0n)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      for (const inv of localInvoices) {
        if (remaining <= 0n) break;
        const bal = BigInt(inv.creditBalancePaise || '0');
        const prevPaid = BigInt(inv.paidNowPaise || '0');
        const alloc = bal > remaining ? remaining : bal;
        inv.paidNowPaise = (prevPaid + alloc).toString();
        inv.creditBalancePaise = (bal - alloc).toString();
        inv.status = inv.creditBalancePaise === '0' ? 'PAID' : 'PARTIALLY_PAID';
        remaining -= alloc;
      }
      localStore.save();
    }

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

    if (idempotencyKey) {
      paymentIdempotencyCache.set(`${targetTenantId}:${idempotencyKey}`, {
        paymentId: createdPaymentId,
        customerId: customerId || undefined,
        ledgerEntryId: entry.id,
        amountPaise: amt.toString(),
        newBalancePaise: newBal.toString(),
        allocations: computedAllocations.map((a) => ({
          invoiceId: a.invoiceId,
          amountPaise: a.amount.toString(),
        })),
        unallocatedAdvancePaise: unallocatedAdvance.toString(),
        timestamp: Date.now(),
      });
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'PAYMENT_RECEIVED',
      entity: 'PAYMENT',
      entityId: createdPaymentId,
      after: {
        customerId,
        amountPaise: amt.toString(),
        mode,
        reference: ref,
        allocatedCount: computedAllocations.length,
      },
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
