import { NextRequest, NextResponse } from 'next/server';
import { getRazorpayClient } from '@/server/lib/razorpay';
import { localStore } from '@/server/lib/store';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId');
    const customerId = searchParams.get('customerId');
    const invoiceId = searchParams.get('invoiceId');
    const amountPaiseParam = searchParams.get('amountPaise');

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    // 1. Check in-memory / localStore recorded attempts (populated via Webhooks or manual checks)
    const recordedAttempt = localStore.getPaymentAttempt(linkId);
    if (recordedAttempt) {
      if (recordedAttempt.status === 'paid') {
        return NextResponse.json({
          status: 'paid',
          paid: true,
          paymentId: recordedAttempt.paymentId || `pay_${linkId}`,
          amountPaise: amountPaiseParam || '0',
          method: 'UPI',
          paidAt: recordedAttempt.updatedAt,
        });
      }
      if (recordedAttempt.status === 'failed') {
        return NextResponse.json({
          status: 'failed',
          paid: false,
          reason: recordedAttempt.reason || 'Customer cancelled transaction or bank gateway declined.',
        });
      }
    }

    // 2. Check Live Razorpay API if keys configured
    const razorpay = getRazorpayClient();
    if (razorpay && linkId.startsWith('plink_') && !linkId.includes('mock')) {
      try {
        const link: any = await razorpay.paymentLink.fetch(linkId);
        
        // Fetch all payment attempts associated with the underlying order if available
        let attempts: any[] = [];
        if (Array.isArray(link.payments) && link.payments.length > 0) {
          attempts = link.payments;
        }

        if (link.order_id) {
          try {
            const orderPaymentsRes: any = await razorpay.orders.fetchPayments(link.order_id);
            if (orderPaymentsRes && Array.isArray(orderPaymentsRes.items) && orderPaymentsRes.items.length > 0) {
              attempts = orderPaymentsRes.items;
            }
          } catch (orderErr) {
            console.warn('Could not fetch order payments:', orderErr);
          }
        }

        // Check if overall link is marked paid OR any attempt was captured
        const capturedAttempt = attempts.find((p: any) => p.status === 'captured' || p.status === 'authorized');
        if (link.status === 'paid' || capturedAttempt) {
          const amountPaise = link.amount_paid || capturedAttempt?.amount || link.amount || 0;
          const rzpPaymentId = capturedAttempt?.id || link.payments?.[0]?.payment_id || `pay_${linkId.replace('plink_', '')}`;
          const paymentMethod = (capturedAttempt?.method || 'UPI').toUpperCase();

          // Record in local store if not already recorded
          const existingLedger = localStore.getLedger(customerId || '');
          const alreadyRecorded = existingLedger.some((e: any) => e.refNo === rzpPaymentId || e.refNo === linkId);

          if (!alreadyRecorded && customerId) {
            const tenantId = localStore.getTenants()[0]?.id || 'tenant-default';
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

          localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: rzpPaymentId });

          return NextResponse.json({
            status: 'paid',
            paid: true,
            paymentId: rzpPaymentId,
            amountPaise,
            method: paymentMethod,
            paidAt: new Date().toISOString(),
          });
        }

        // Check if the latest attempt on this link failed
        if (attempts.length > 0) {
          const latestAttempt = attempts[attempts.length - 1];
          if (latestAttempt.status === 'failed') {
            const failReason = latestAttempt.error_description || latestAttempt.error_reason || latestAttempt.error_code || 'Customer cancelled transaction or bank gateway declined';
            localStore.recordPaymentAttempt(linkId, { status: 'failed', reason: failReason, paymentId: latestAttempt.id });
            return NextResponse.json({
              status: 'failed',
              paid: false,
              paymentId: latestAttempt.id,
              reason: failReason,
            });
          }
        }

        // Check link cancelled or expired
        if (link.status === 'cancelled' || link.status === 'expired') {
          const failReason = link.status === 'cancelled' ? 'Payment Link Cancelled by User' : 'Payment Link Expired';
          localStore.recordPaymentAttempt(linkId, { status: 'failed', reason: failReason });
          return NextResponse.json({
            status: 'failed',
            paid: false,
            reason: failReason,
          });
        }

        return NextResponse.json({
          status: 'pending',
          paid: false,
          amountPaise: link.amount,
        });
      } catch (rzpErr: any) {
        console.warn('Could not fetch status from Razorpay API, falling back:', rzpErr?.message);
      }
    }

    // 3. Check LocalStore for payment records
    if (customerId) {
      const payments = localStore.getPayments(customerId);
      const matchedPayment = payments.find(
        (p: any) => p.referenceNumber === linkId || (p.referenceNumber && p.referenceNumber.includes(linkId))
      );

      if (matchedPayment) {
        return NextResponse.json({
          status: 'paid',
          paid: true,
          paymentId: matchedPayment.referenceNumber,
          amountPaise: matchedPayment.amountPaise,
          method: matchedPayment.mode || 'UPI',
          paidAt: matchedPayment.createdAt,
        });
      }
    }

    // Default status when waiting for user scan & pin
    return NextResponse.json({
      status: 'pending',
      paid: false,
      amountPaise: amountPaiseParam || '0',
    });
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}

/**
 * Endpoint to simulate payment for instant verification / test checkout
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { linkId, customerId, invoiceId, amountPaise, action = 'SUCCESS', reason } = body;

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    const tenantId = localStore.getTenants()[0]?.id || 'tenant-default';
    const finalPaise = BigInt(amountPaise || '0');

    if (action === 'SUCCESS') {
      const simulatedPayId = `pay_sim_${Math.random().toString(36).substring(2, 10)}`;

      if (customerId) {
        localStore.createPayment({
          tenantId,
          customerId,
          amountPaise: finalPaise.toString(),
          mode: 'UPI',
          referenceNumber: simulatedPayId,
        });

        localStore.addLedgerEntry({
          tenantId,
          customerId,
          type: 'PAYMENT',
          refNo: simulatedPayId,
          narration: `Razorpay Online UPI Payment - Ref: ${simulatedPayId}`,
          debitPaise: '0',
          creditPaise: finalPaise.toString(),
        });
      }

      localStore.recordPaymentAttempt(linkId, { status: 'paid', paymentId: simulatedPayId });

      return NextResponse.json({
        success: true,
        status: 'paid',
        paid: true,
        paymentId: simulatedPayId,
        amountPaise: finalPaise.toString(),
        method: 'UPI / GPay',
        paidAt: new Date().toISOString(),
      });
    } else {
      const failureReason = reason || 'Customer cancelled transaction in UPI App (User Aborted)';
      localStore.recordPaymentAttempt(linkId, { status: 'failed', reason: failureReason });

      return NextResponse.json({
        success: true,
        status: 'failed',
        paid: false,
        reason: failureReason,
      });
    }
  } catch (error: any) {
    console.error('Error simulating payment:', error);
    return NextResponse.json({ error: error?.message || 'Simulation failed' }, { status: 500 });
  }
}
