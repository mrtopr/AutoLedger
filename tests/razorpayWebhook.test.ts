import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { verifyRazorpaySignature } from '@/server/lib/razorpay';
import { POST } from '@/app/api/v1/webhooks/razorpay/route';
import * as prismaModule from '@/server/lib/prisma';
import { prisma } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

// Helper to generate HMAC SHA256 hex signature
function generateSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Razorpay Webhook Security & Idempotency', () => {
  const TEST_SECRET = 'test_webhook_secret_xyz123';
  const ORIGINAL_ENV = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_SECRET;
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
  });

  afterEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // SECTION 1: verifyRazorpaySignature Unit Tests
  // ===========================================================================
  describe('verifyRazorpaySignature', () => {
    it('returns true for a valid HMAC-SHA256 signature with the correct secret', () => {
      const payload = JSON.stringify({ event: 'payment.captured', id: 'pay_123' });
      const validSig = generateSignature(payload, TEST_SECRET);

      expect(verifyRazorpaySignature(payload, validSig, TEST_SECRET)).toBe(true);
    });

    it('returns false when signature does not match payload', () => {
      const payload = JSON.stringify({ event: 'payment.captured', id: 'pay_123' });
      const invalidSig = generateSignature('tampered payload', TEST_SECRET);

      expect(verifyRazorpaySignature(payload, invalidSig, TEST_SECRET)).toBe(false);
    });

    it('returns false when signed with the wrong secret (e.g. API key secret instead of webhook secret)', () => {
      const payload = JSON.stringify({ event: 'payment.captured', id: 'pay_123' });
      const wrongSig = generateSignature(payload, 'wrong_api_key_secret');

      expect(verifyRazorpaySignature(payload, wrongSig, TEST_SECRET)).toBe(false);
    });

    it('returns false when secret is empty or undefined', () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const payload = JSON.stringify({ event: 'payment.captured' });
      const sig = generateSignature(payload, TEST_SECRET);

      expect(verifyRazorpaySignature(payload, sig, undefined)).toBe(false);
    });

    it('returns false when signature is empty or undefined', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });

      expect(verifyRazorpaySignature(payload, '', TEST_SECRET)).toBe(false);
    });

    it('returns false safely when signature length is wrong without throwing RangeError', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });

      expect(verifyRazorpaySignature(payload, 'short-sig', TEST_SECRET)).toBe(false);
      expect(verifyRazorpaySignature(payload, 'a'.repeat(128), TEST_SECRET)).toBe(false);
    });
  });

  // ===========================================================================
  // SECTION 2: Webhook Route Handler Security & Signature Enforcement
  // ===========================================================================
  describe('Webhook Route Handler: Authentication & Validation', () => {
    it('rejects with HTTP 500 when RAZORPAY_WEBHOOK_SECRET is not configured on the server', async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const body = JSON.stringify({ event: 'payment.captured' });
      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': 'any_sig' },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/secret is not configured/i);
    });

    it('rejects with HTTP 400 when x-razorpay-signature header is missing', async () => {
      const body = JSON.stringify({ event: 'payment.captured' });
      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: {}, // no signature header
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Missing required x-razorpay-signature/i);
    });

    it('rejects with HTTP 400 when signature is invalid or forged', async () => {
      const body = JSON.stringify({ event: 'payment.captured' });
      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid webhook signature/i);
    });

    it('rejects with HTTP 400 when raw body is malformed JSON with valid signature', async () => {
      const malformedBody = '{ "event": "payment.captured", unclosed json';
      const sig = generateSignature(malformedBody, TEST_SECRET);

      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: malformedBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Malformed JSON payload/i);
    });

    it('ignores unsupported events with HTTP 200 without modifying any data', async () => {
      const body = JSON.stringify({
        event: 'virtual_account.credited',
        payload: { dummy: true },
      });
      const sig = generateSignature(body, TEST_SECRET);

      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ignored).toBe(true);
      expect(json.event).toBe('virtual_account.credited');
    });
  });

  // ===========================================================================
  // SECTION 3: Idempotent Payment Processing & Deduplication
  // ===========================================================================
  describe('Webhook Route Handler: Idempotency & Database Transactions', () => {
    const mockPaymentId = `pay_test_${Date.now()}`;
    const validPaymentPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: mockPaymentId,
            entity: 'payment',
            amount: 250000, // ₹2,500.00
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            description: 'Order Payment',
            notes: {
              tenantId: 'd0a4b7f0-1234-4567-89ab-cdef01234567',
              customerId: 'e1b5c8a1-5678-4321-98ba-fedcba987654',
            },
          },
        },
      },
    };

    it('processes a new valid payment.captured event and records it in database transaction', async () => {
      const bodyStr = JSON.stringify(validPaymentPayload);
      const sig = generateSignature(bodyStr, TEST_SECRET);

      const mockTx = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(null), // no duplicate
          create: vi.fn().mockResolvedValue({ id: 'payment-uuid-1', gatewayRef: mockPaymentId }),
        },
        tenant: {
          findUnique: vi.fn().mockResolvedValue({ id: validPaymentPayload.payload.payment.entity.notes.tenantId }),
        },
        customer: {
          findUnique: vi.fn().mockResolvedValue({ id: validPaymentPayload.payload.payment.entity.notes.customerId, creditLimit: 500000n }),
          findFirst: vi.fn().mockResolvedValue({ id: validPaymentPayload.payload.payment.entity.notes.customerId, creditLimit: 500000n }),
          update: vi.fn().mockResolvedValue({}),
        },
        ledgerEntry: {
          create: vi.fn().mockResolvedValue({ id: 'ledger-uuid-1' }),
          findMany: vi.fn().mockResolvedValue([{ debit: 0n, credit: 250000n }]),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: bodyStr,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.duplicate).toBe(false);
      expect(json.processed).toBe(true);
      expect(mockTx.payment.create).toHaveBeenCalledTimes(1);
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledTimes(1);
    });

    it('deduplicates a duplicate delivery of the same payment and does not apply duplicate ledger entries', async () => {
      const bodyStr = JSON.stringify(validPaymentPayload);
      const sig = generateSignature(bodyStr, TEST_SECRET);

      const mockTx = {
        payment: {
          // Payment already exists in database with this gatewayRef
          findUnique: vi.fn().mockResolvedValue({ id: 'existing-payment-uuid', gatewayRef: mockPaymentId }),
          create: vi.fn(),
        },
        ledgerEntry: {
          create: vi.fn(),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: bodyStr,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.duplicate).toBe(true);
      expect(json.message).toMatch(/already processed/i);

      // Verify that no second payment or ledger entry was created
      expect(mockTx.payment.create).not.toHaveBeenCalled();
      expect(mockTx.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('safely handles concurrent duplicate deliveries racing on database unique constraint (P2002)', async () => {
      const bodyStr = JSON.stringify(validPaymentPayload);
      const sig = generateSignature(bodyStr, TEST_SECRET);

      const p2002Error: any = new Error('Unique constraint failed on the fields: (`gateway_ref`)');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['gateway_ref'] };

      vi.spyOn(prisma, '$transaction').mockRejectedValue(p2002Error);

      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: bodyStr,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.duplicate).toBe(true);
      expect(json.message).toMatch(/concurrent webhook delivery safely deduplicated/i);
    });
  });

  // ===========================================================================
  // SECTION 4: Payment Failure & Dispute Deduplication
  // ===========================================================================
  describe('Webhook Route Handler: Failure & Dispute Reversals', () => {
    it('handles payment.failed without mutating customer ledger', async () => {
      const failPayload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_123',
              error_description: 'Customer bank timeout',
              error_code: 'BAD_REQUEST_ERROR',
            },
          },
        },
      };
      const bodyStr = JSON.stringify(failPayload);
      const sig = generateSignature(bodyStr, TEST_SECRET);

      const req = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: bodyStr,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.action).toBe('logged_failure_without_ledger_mutation');
      expect(json.reason).toBe('Customer bank timeout');
    });

    it('handles payment.dispute.created idempotently without duplicate reversals', async () => {
      const disputePayload = {
        event: 'payment.dispute.created',
        payload: {
          dispute: {
            entity: {
              id: 'disp_test_999',
              amount: 50000,
              payment_id: 'pay_original_123',
              notes: {
                tenantId: 'd0a4b7f0-1234-4567-89ab-cdef01234567',
                customerId: 'e1b5c8a1-5678-4321-98ba-fedcba987654',
              },
            },
          },
        },
      };
      const bodyStr = JSON.stringify(disputePayload);
      const sig = generateSignature(bodyStr, TEST_SECRET);

      // Simulation 1: Reversal not yet recorded
      const mockTx1 = {
        ledgerEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'reversal-entry-1' }),
        },
        customer: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(mockTx1));

      const req1 = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: bodyStr,
      });

      const res1 = await POST(req1);
      expect(res1.status).toBe(200);
      expect(mockTx1.ledgerEntry.create).toHaveBeenCalledTimes(1);

      // Simulation 2: Duplicate delivery of same dispute
      const mockTx2 = {
        ledgerEntry: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-reversal' }),
          create: vi.fn(),
        },
        customer: {
          update: vi.fn(),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(mockTx2));

      const req2 = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig },
        body: bodyStr,
      });

      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.duplicate).toBe(true);
      expect(mockTx2.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });
});
