import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { verifyRazorpaySignature } from '@/server/lib/razorpay';
import { CreditStatus, InvoiceStatus, LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function POST(req: NextRequest) {
  try {
    // 1. Read exact raw request body BEFORE parsing JSON
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // 2. Strict Webhook Secret & Signature Verification
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Razorpay Webhook Error: RAZORPAY_WEBHOOK_SECRET is not configured on server.');
      return NextResponse.json(
        { error: 'Webhook secret is not configured on server' },
        { status: 500 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing required x-razorpay-signature header' },
        { status: 400 }
      );
    }

    const isSignatureValid = verifyRazorpaySignature(rawBody, signature, webhookSecret);
    if (!isSignatureValid) {
      console.warn('Unauthorized: Invalid Razorpay webhook signature rejected.');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // 3. Safe JSON Parsing & Event Structure Validation
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string') {
      return NextResponse.json(
        { error: 'Invalid webhook event payload structure' },
        { status: 400 }
      );
    }

    const event = payload.event;

    // Supported Webhook Events
    const supportedEvents = [
      'payment.captured',
      'payment_link.paid',
      'order.paid',
      'payment.failed',
      'payment.dispute.created',
      'refund.processed',
    ];

    if (!supportedEvents.includes(event)) {
      return NextResponse.json(
        { success: true, ignored: true, event, message: 'Event type ignored (unsupported or not relevant)' },
        { status: 200 }
      );
    }

    const hasDb = await isPostgresAvailable();

    // =========================================================================
    // CASE 1: PAYMENT SUCCESS / CAPTURED (payment.captured, payment_link.paid, order.paid)
    // =========================================================================
    if (event === 'payment.captured' || event === 'payment_link.paid' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity;
      if (!paymentEntity || typeof paymentEntity !== 'object') {
        return NextResponse.json(
          { error: 'Missing payment entity in payload' },
          { status: 400 }
        );
      }

      const rzpPaymentId = paymentEntity.id;
      if (!rzpPaymentId || typeof rzpPaymentId !== 'string') {
        return NextResponse.json(
          { error: 'Missing or invalid payment ID in entity' },
          { status: 400 }
        );
      }

      // Validate payment status
      if (
        paymentEntity.entity === 'payment' &&
        paymentEntity.status !== 'captured' &&
        paymentEntity.status !== 'authorized'
      ) {
        return NextResponse.json(
          { success: true, ignored: true, message: `Payment in uncaptured state: ${paymentEntity.status}` },
          { status: 200 }
        );
      }

      // Validate currency
      if (paymentEntity.currency && paymentEntity.currency !== 'INR') {
        return NextResponse.json(
          { error: `Unsupported currency: ${paymentEntity.currency}. Only INR is supported.` },
          { status: 400 }
        );
      }

      // Validate amount (stored in integer paise)
      const rawAmount = paymentEntity.amount;
      if (rawAmount === undefined || rawAmount === null || isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
        return NextResponse.json(
          { error: 'Invalid or non-positive payment amount' },
          { status: 400 }
        );
      }
      const amountPaise = BigInt(Math.round(Number(rawAmount)));

      // Extract metadata notes
      const notes = paymentEntity.notes || {};
      const tenantId = typeof notes.tenantId === 'string' && notes.tenantId.trim() ? notes.tenantId.trim() : null;
      const customerId = typeof notes.customerId === 'string' && notes.customerId.trim() ? notes.customerId.trim() : null;
      const invoiceId = typeof notes.invoiceId === 'string' && notes.invoiceId.trim() ? notes.invoiceId.trim() : null;

      const rawMethod = typeof paymentEntity.method === 'string' ? paymentEntity.method.toUpperCase() : 'UPI';
      const mappedMode: PaymentMode =
        rawMethod === 'CARD'
          ? PaymentMode.OTHER
          : rawMethod === 'NETBANKING'
          ? PaymentMode.BANK
          : PaymentMode.UPI;

      const linkId = paymentEntity.payment_link_id || payload.payload?.payment_link?.entity?.id || rzpPaymentId;

      // -----------------------------------------------------------------------
      // A. PostgreSQL Persistence (ACID Transaction with Unique Constraint Idempotency)
      // -----------------------------------------------------------------------
      if (hasDb) {
        try {
          const txResult = await prisma.$transaction(async (tx) => {
            // Step 1: Deduplication Check via unique gateway_ref
            const existingPayment = await tx.payment.findUnique({
              where: { gatewayRef: rzpPaymentId },
            });

            if (existingPayment) {
              return { duplicate: true, paymentId: existingPayment.id };
            }

            // Step 2: Resolve Tenant ID
            let dbTenantId: string | null = isUuid(tenantId) ? tenantId : null;
            if (!dbTenantId) {
              // Try finding tenant from invoice
              if (isUuid(invoiceId)) {
                const inv = await tx.invoice.findUnique({
                  where: { id: invoiceId },
                  select: { tenantId: true },
                });
                if (inv) dbTenantId = inv.tenantId;
              }
            }

            // Step 3: Resolve Customer ID
            let dbCustomerId: string | null = isUuid(customerId) ? customerId : null;
            if (dbTenantId && !dbCustomerId) {
              // Resolve from invoice if present
              if (isUuid(invoiceId)) {
                const inv = await tx.invoice.findFirst({
                  where: { id: invoiceId, tenantId: dbTenantId },
                  select: { customerId: true },
                });
                if (inv && inv.customerId) dbCustomerId = inv.customerId;
              }
              // Resolve from contact phone
              if (!dbCustomerId && paymentEntity.contact) {
                const cleanContact = String(paymentEntity.contact).replace(/\D/g, '').slice(-10);
                if (cleanContact) {
                  const cust = await tx.customer.findFirst({
                    where: { tenantId: dbTenantId, phone: { contains: cleanContact } },
                    select: { id: true },
                  });
                  if (cust) dbCustomerId = cust.id;
                }
              }
            }

            if (!dbTenantId || !dbCustomerId) {
              // Cannot create relational Payment without valid customer and tenant in Postgres
              return { skipped: true, reason: 'Tenant or Customer could not be resolved' };
            }

            // Verify customer belongs to this tenant
            const customer = await tx.customer.findFirst({
              where: { id: dbCustomerId, tenantId: dbTenantId },
            });
            if (!customer) {
              return { skipped: true, reason: 'Customer record not found for tenant' };
            }

            // Step 4: Create Payment record atomically with gatewayRef
            const payment = await tx.payment.create({
              data: {
                tenantId: dbTenantId,
                customerId: dbCustomerId,
                amount: amountPaise,
                mode: mappedMode,
                reference: rzpPaymentId,
                status: PaymentStatus.CLEARED,
                gatewayRef: rzpPaymentId,
                notes: `Razorpay Online Payment: ${paymentEntity.description || 'Auto-Settled'}`,
              },
            });

            // Step 5: If an invoice is linked, allocate payment and update invoice state
            if (isUuid(invoiceId)) {
              const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
              if (invoice && invoice.tenantId === dbTenantId) {
                await tx.paymentAllocation.create({
                  data: {
                    paymentId: payment.id,
                    invoiceId,
                    amount: amountPaise,
                    strategy: 'DIRECT_LINK',
                  },
                });

                const newAmountPaid = (invoice.amountPaid || 0n) + amountPaise;
                const newBalanceDue = invoice.grandTotal > newAmountPaid ? invoice.grandTotal - newAmountPaid : 0n;
                const newStatus = newBalanceDue === 0n ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

                await tx.invoice.update({
                  where: { id: invoiceId },
                  data: {
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                    status: newStatus,
                  },
                });

                await tx.invoiceEvent.create({
                  data: {
                    invoiceId,
                    event: 'PAID',
                    meta: {
                      paymentId: payment.id,
                      gatewayRef: rzpPaymentId,
                      amountPaise: amountPaise.toString(),
                      method: mappedMode,
                    },
                  },
                });
              }
            }

            // Step 6: Post Credit Entry to Append-Only Customer Ledger
            await tx.ledgerEntry.create({
              data: {
                tenantId: dbTenantId,
                customerId: dbCustomerId,
                entryType: LedgerEntryType.PAYMENT,
                refId: payment.id,
                credit: amountPaise,
                debit: 0n,
                narration: `Razorpay Online Payment (${mappedMode}) - Ref: ${rzpPaymentId}`,
              },
            });

            // Step 7: Recompute Customer Credit Health & Balance
            const ledgerEntries = await tx.ledgerEntry.findMany({
              where: { customerId: dbCustomerId },
              select: { debit: true, credit: true },
            });
            const runningBal = ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0n);
            const isWithinLimit = runningBal <= customer.creditLimit;
            await tx.customer.update({
              where: { id: dbCustomerId },
              data: {
                status: isWithinLimit ? CreditStatus.GREEN : CreditStatus.YELLOW,
              },
            });

            return { duplicate: false, paymentId: payment.id };
          });

          // Live polling update
          if (linkId) {
            localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: rzpPaymentId });
          }

          if (txResult.duplicate) {
            return NextResponse.json({
              success: true,
              duplicate: true,
              event,
              message: 'Payment already processed in database',
              paymentId: txResult.paymentId,
            });
          }

          if (txResult.skipped) {
            return NextResponse.json({
              success: true,
              skipped: true,
              event,
              reason: txResult.reason,
            });
          }

          return NextResponse.json({
            success: true,
            duplicate: false,
            event,
            paymentId: txResult.paymentId,
            processed: true,
          });
        } catch (dbErr: any) {
          // Handle concurrent duplicate deliveries safely (P2002: unique constraint failed on gatewayRef)
          if (dbErr?.code === 'P2002') {
            if (linkId) {
              localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: rzpPaymentId });
            }
            return NextResponse.json({
              success: true,
              duplicate: true,
              event,
              message: 'Concurrent webhook delivery safely deduplicated by database constraint',
              gatewayRef: rzpPaymentId,
            });
          }

          console.error('Error during PostgreSQL transaction in Razorpay webhook:', dbErr?.message || dbErr);
          return NextResponse.json(
            { error: 'Database transaction error processing payment' },
            { status: 500 }
          );
        }
      }

      // -----------------------------------------------------------------------
      // B. LocalStore Persistence Fallback (when PostgreSQL is offline / disconnected)
      // -----------------------------------------------------------------------
      const targetTenantId = tenantId;
      const targetCustomerId = customerId;

      if (!targetTenantId || !targetCustomerId) {
        console.warn('Skipping webhook localStore persistence: missing tenantId or customerId');
        return NextResponse.json({
          success: true,
          skipped: true,
          event,
          message: 'Payment received but cannot be allocated without tenant and customer context',
        });
      }
        // Single-process deduplication check against local store
        const existingLocalPayment = localStore
          .getPayments(targetTenantId)
          .find((p) => p.referenceNumber === rzpPaymentId);
        const existingLocalLedger = localStore
          .getLedger(targetCustomerId)
          .find((l) => l.refNo === rzpPaymentId);

        if (existingLocalPayment || existingLocalLedger) {
          if (linkId) {
            localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: rzpPaymentId });
          }
          return NextResponse.json({
            success: true,
            duplicate: true,
            event,
            storage: 'localStore',
            message: 'Payment already processed in local store',
          });
        }

        localStore.createPayment({
          tenantId: targetTenantId,
          customerId: targetCustomerId,
          amountPaise: amountPaise.toString(),
          mode: rawMethod,
          referenceNumber: rzpPaymentId,
        });

        localStore.addLedgerEntry({
          tenantId: targetTenantId,
          customerId: targetCustomerId,
          type: 'PAYMENT',
          refNo: rzpPaymentId,
          narration: `Razorpay Online Payment (${rawMethod}) - Ref: ${rzpPaymentId}`,
          debitPaise: '0',
          creditPaise: amountPaise.toString(),
        });

      if (linkId) {
        localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: rzpPaymentId });
      }

      return NextResponse.json({
        success: true,
        duplicate: false,
        event,
        storage: 'localStore',
        processed: true,
      });
    }

    // =========================================================================
    // CASE 2: PAYMENT FAILED / DROPPED (payment.failed)
    // =========================================================================
    if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const errorDetails =
        paymentEntity?.error_description || paymentEntity?.error_reason || 'Bank Gateway Declined';
      const rzpPaymentId = paymentEntity?.id || 'UNKNOWN';
      const notes = paymentEntity?.notes || {};
      const invoiceId = notes.invoiceId || null;

      // Idempotently log event to invoice audit log if Postgres available
      if (hasDb && invoiceId && isUuid(invoiceId)) {
        try {
          const existingFailEvent = await prisma.invoiceEvent.findFirst({
            where: {
              invoiceId,
              event: 'PAYMENT_FAILED',
              meta: { path: ['paymentId'], equals: rzpPaymentId },
            },
          });

          if (!existingFailEvent) {
            await prisma.invoiceEvent.create({
              data: {
                invoiceId,
                event: 'PAYMENT_FAILED',
                meta: {
                  paymentId: rzpPaymentId,
                  reason: errorDetails,
                  code: paymentEntity?.error_code,
                  timestamp: new Date().toISOString(),
                },
              },
            });
          }
        } catch (e) {
          // Silent catch for non-critical logging
        }
      }

      // Record attempt for live polling
      const failedLinkId =
        paymentEntity?.payment_link_id || payload.payload?.payment_link?.entity?.id || rzpPaymentId;
      if (failedLinkId) {
        localStore.recordPaymentAttempt(failedLinkId, {
          status: 'failed',
          reason: errorDetails,
          paymentId: rzpPaymentId,
        });
      }

      return NextResponse.json({
        success: true,
        event,
        action: 'logged_failure_without_ledger_mutation',
        reason: errorDetails,
      });
    }

    // =========================================================================
    // CASE 3: PAYMENT DISPUTE / REVERSAL (payment.dispute.created, refund.processed)
    // =========================================================================
    if (event === 'payment.dispute.created' || event === 'refund.processed') {
      const dispute = payload.payload?.dispute?.entity || payload.payload?.refund?.entity;
      const disputeId = dispute?.id;
      if (!disputeId) {
        return NextResponse.json({ error: 'Missing dispute or refund ID' }, { status: 400 });
      }

      const amountPaise = BigInt(dispute?.amount || 0);
      const notes = dispute?.notes || {};
      const tenantId = notes.tenantId || null;
      const customerId = notes.customerId || null;

      if (hasDb && customerId && isUuid(customerId) && tenantId && isUuid(tenantId)) {
        try {
          const disputeResult = await prisma.$transaction(async (tx) => {
            // Check if this reversal was already recorded
            const existingReversal = await tx.ledgerEntry.findFirst({
              where: {
                tenantId,
                customerId,
                entryType: LedgerEntryType.PAYMENT_REVERSAL,
                narration: { contains: disputeId },
              },
            });

            if (existingReversal) {
              return { duplicate: true };
            }

            // Post Reversal Debit Entry
            await tx.ledgerEntry.create({
              data: {
                tenantId,
                customerId,
                entryType: LedgerEntryType.PAYMENT_REVERSAL,
                refId: isUuid(dispute.payment_id) ? dispute.payment_id : undefined,
                debit: amountPaise,
                credit: 0n,
                narration: `REVERSAL: Gateway Dispute/Refund - Ref: ${disputeId}`,
              },
            });

            // Mark Customer Status RED (Credit Suspended)
            await tx.customer.update({
              where: { id: customerId },
              data: { status: CreditStatus.RED },
            });

            return { duplicate: false };
          });

          if (disputeResult.duplicate) {
            return NextResponse.json({
              success: true,
              duplicate: true,
              event,
              message: 'Dispute reversal already recorded',
            });
          }
        } catch (e: any) {
          console.error('Error recording dispute reversal in Postgres:', e?.message || e);
          return NextResponse.json({ error: 'Failed to record dispute reversal' }, { status: 500 });
        }
      } else if (customerId) {
        // Fallback for local store
        const localCust = localStore.getCustomerById(customerId);
        const disputeTenantId = tenantId || localCust?.tenantId;
        if (disputeTenantId) {
          const existingLocal = localStore.getLedger(customerId).find((l) => l.refNo === disputeId || l.narration?.includes(disputeId));
          if (!existingLocal) {
            localStore.addLedgerEntry({
              tenantId: disputeTenantId,
              customerId,
              type: 'PAYMENT_REVERSAL',
              refNo: disputeId,
              narration: `REVERSAL: Gateway Dispute/Refund - Ref: ${disputeId}`,
              debitPaise: amountPaise.toString(),
              creditPaise: '0',
            });
          }
        }
      }

      return NextResponse.json({ success: true, event, reversal_applied: true });
    }

    return NextResponse.json({ success: true, unhandledEvent: event });
  } catch (error: any) {
    console.error('Unhandled error in Razorpay webhook handler:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal webhook processing error' },
      { status: 500 }
    );
  }
}
