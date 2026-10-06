import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { verifyRazorpaySignature } from '@/server/lib/razorpay';
import { LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // 1. Verify Webhook Signature (if secret configured)
    if (process.env.RAZORPAY_WEBHOOK_SECRET && signature) {
      const isValid = verifyRazorpaySignature(rawBody, signature);
      if (!isValid) {
        console.warn('❌ Invalid Razorpay Webhook Signature rejected');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`🔔 Razorpay Webhook Received: [${event}]`);

    const hasDb = await isPostgresAvailable();

    // =========================================================================
    // CASE 1: PAYMENT SUCCESS / CAPTURED
    // =========================================================================
    if (event === 'payment.captured' || event === 'payment_link.paid' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity;
      if (!paymentEntity) {
        return NextResponse.json({ status: 'ignored_no_entity' });
      }

      const amountPaise = BigInt(paymentEntity.amount || 0);
      const rzpPaymentId = paymentEntity.id;
      const notes = paymentEntity.notes || {};
      const tenantId = notes.tenantId || 'tenant-default';
      const customerId = notes.customerId || null;
      const invoiceId = notes.invoiceId || null;
      const paymentMethod = (paymentEntity.method || 'UPI').toUpperCase();

      const mappedMode: PaymentMode = paymentMethod === 'CARD' ? PaymentMode.OTHER : (paymentMethod === 'NETBANKING' ? PaymentMode.BANK : PaymentMode.UPI);

      // A. PostgreSQL Persistence
      if (hasDb && isUuid(tenantId) && customerId && isUuid(customerId)) {
        try {
          // 1. Create Payment Record
          const payment = await prisma.payment.create({
            data: {
              tenantId,
              customerId,
              amount: amountPaise,
              mode: mappedMode,
              reference: rzpPaymentId,
              status: PaymentStatus.CLEARED,
              gatewayRef: rzpPaymentId,
              notes: `Razorpay Online Payment: ${paymentEntity.description || 'Auto-Settled'}`,
            },
          });

          // 2. Allocate to specific invoice if linked
          if (invoiceId && isUuid(invoiceId)) {
            const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
            if (invoice) {
              await prisma.paymentAllocation.create({
                data: {
                  paymentId: payment.id,
                  invoiceId,
                  amount: amountPaise,
                  strategy: 'DIRECT_LINK',
                },
              });

              const newAmountPaid = (invoice.amountPaid || 0n) + amountPaise;
              const newBalanceDue = invoice.grandTotal > newAmountPaid ? invoice.grandTotal - newAmountPaid : 0n;
              const newStatus = newBalanceDue === 0n ? 'PAID' : 'PARTIALLY_PAID';

              await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                  amountPaid: newAmountPaid,
                  balanceDue: newBalanceDue,
                  status: newStatus as any,
                },
              });
            }
          }

          // 3. Post Credit Entry to Customer Ledger
          await prisma.ledgerEntry.create({
            data: {
              tenantId,
              customerId,
              entryType: LedgerEntryType.PAYMENT,
              refId: isUuid(invoiceId) ? invoiceId : undefined,
              credit: amountPaise,
              debit: 0n,
              narration: `Razorpay Online Payment (${mappedMode}) - Ref: ${rzpPaymentId}`,
            },
          });

          // 4. Update Customer Credit Status & Balance
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: { ledgerEntries: { select: { debit: true, credit: true } } },
          });

          if (customer) {
            const runningBal = customer.ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0n);
            const isWithinLimit = runningBal <= customer.creditLimit;
            await prisma.customer.update({
              where: { id: customerId },
              data: {
                status: isWithinLimit ? 'GREEN' : 'YELLOW',
              },
            });
          }

          console.log(`✅ Postgres Ledger automatically updated for payment ${rzpPaymentId}`);
        } catch (dbErr) {
          console.error('Error recording Razorpay payment in Postgres:', dbErr);
        }
      }

      // B. LocalStore Persistence
      if (customerId) {
        localStore.createPayment({
          tenantId,
          customerId,
          amountPaise: amountPaise.toString(),
          mode: paymentMethod,
          referenceNumber: rzpPaymentId,
        });

        localStore.addLedgerEntry({
          tenantId,
          customerId,
          type: 'PAYMENT',
          refNo: rzpPaymentId,
          narration: `Razorpay Online Payment (${paymentMethod}) - Ref: ${rzpPaymentId}`,
          debitPaise: '0',
          creditPaise: amountPaise.toString(),
        });
      }

      // Record attempt for live polling
      const linkId = paymentEntity.payment_link_id || payload.payload?.payment_link?.entity?.id || rzpPaymentId;
      if (linkId) {
        localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: rzpPaymentId });
      }

      return NextResponse.json({ success: true, event, processed: true });
    }

    // =========================================================================
    // CASE 2: PAYMENT FAILED / DROPPED
    // =========================================================================
    if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const errorDetails = paymentEntity?.error_description || paymentEntity?.error_reason || 'Bank Gateway Timeout';
      const rzpPaymentId = paymentEntity?.id || 'UNKNOWN';
      const notes = paymentEntity?.notes || {};
      const invoiceId = notes.invoiceId || null;

      console.warn(`⚠️ Payment ${rzpPaymentId} failed. Reason: ${errorDetails}`);

      // Ledger integrity preserved: Zero balance deducted.
      // Log event to invoice audit log if Postgres available
      if (hasDb && invoiceId && isUuid(invoiceId)) {
        try {
          await prisma.invoiceEvent.create({
            data: {
              invoiceId,
              event: 'PAYMENT_FAILED',
              meta: {
                paymentId: rzpPaymentId,
                reason: errorDetails,
                code: paymentEntity?.error_code,
                source: paymentEntity?.error_source,
                step: paymentEntity?.error_step,
                timestamp: new Date().toISOString(),
              },
            },
          });
        } catch (e) {}
      }

      // Record attempt for live polling
      const failedLinkId = paymentEntity.payment_link_id || payload.payload?.payment_link?.entity?.id || rzpPaymentId;
      if (failedLinkId) {
        localStore.recordPaymentAttempt(failedLinkId, { status: 'failed', reason: errorDetails, paymentId: rzpPaymentId });
      }

      return NextResponse.json({
        success: true,
        event,
        action: 'logged_failure_without_ledger_mutation',
        reason: errorDetails,
      });
    }

    // =========================================================================
    // CASE 3: PAYMENT DISPUTE / REVERSAL (CHARGEBACK OR BOUNCE)
    // =========================================================================
    if (event === 'payment.dispute.created' || event === 'refund.processed') {
      const dispute = payload.payload?.dispute?.entity || payload.payload?.refund?.entity;
      const amountPaise = BigInt(dispute?.amount || 0);
      const notes = dispute?.notes || {};
      const tenantId = notes.tenantId || 'tenant-default';
      const customerId = notes.customerId || null;

      console.warn(`🚨 Payment Dispute / Reversal: ${dispute?.id} of ₹${Number(amountPaise) / 100}`);

      if (hasDb && customerId && isUuid(customerId) && isUuid(tenantId)) {
        try {
          // 1. Post a Reversal Debit Entry
          await prisma.ledgerEntry.create({
            data: {
              tenantId,
              customerId,
              entryType: LedgerEntryType.PAYMENT_REVERSAL,
              debit: amountPaise,
              credit: 0n,
              narration: `REVERSAL: Gateway Dispute/Refund - Ref: ${dispute?.id}`,
            },
          });

          // 2. Mark Customer RED (Credit Suspended)
          await prisma.customer.update({
            where: { id: customerId },
            data: { status: 'RED' },
          });
        } catch (e) {
          console.error('Error posting reversal ledger entry:', e);
        }
      }

      return NextResponse.json({ success: true, event, reversal_applied: true });
    }

    return NextResponse.json({ success: true, unhandledEvent: event });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: error?.message || 'Webhook processing failed' }, { status: 500 });
  }
}
