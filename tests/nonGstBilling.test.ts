import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/invoices/route';
import * as prismaModule from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import * as authModule from '@/server/lib/auth';
import { calculateInvoiceTax } from '@/server/lib/tax';

describe('Non-GST Sales Billing (Kacha Bill) Regression & Integrity Tests', () => {
  const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
  const USER_STAFF = '33333333-3333-4333-8333-333333333333';
  const CUSTOMER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const PRODUCT_A = 'p-spark-plug-1';

  beforeEach(() => {
    // Reset local store state
    const rawData = (localStore as any).data;
    if (rawData) {
      rawData.invoiceSeries = {};
      rawData.invoices = [];
      rawData.ledgerEntries = [];
      rawData.payments = [];
      rawData.paymentAllocations = [];
      rawData.products = [
        {
          id: PRODUCT_A,
          tenantId: TENANT_A,
          name: 'BOSCH Spark Plug',
          partNumber: 'SP-001',
          stockQty: 50,
          purchasePricePaise: '10000',
          salePricePaise: '25000', // ₹250
          gstRateBp: 1800, // legacy catalog field
          createdAt: new Date().toISOString(),
        },
      ];
    }
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: USER_STAFF,
      email: 'staff@dealer.com',
      name: 'Counter Staff',
      role: 'STAFF',
      tenantId: TENANT_A,
    } as any);

    localStore.upsertCustomer(CUSTOMER_A, {
      id: CUSTOMER_A,
      tenantId: TENANT_A,
      name: 'Sharma Garage',
      shopName: 'Sharma Auto Works',
      phone: '9822100001',
      creditLimitPaise: '5000000',
      balancePaise: '0',
      status: 'GREEN',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createPostRequest(body: any): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/invoices', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer dummy-token',
      },
      body: JSON.stringify(body),
    });
  }

  // =========================================================================
  // 1. Bill Total Calculation: Exact Price * Qty - Discount (Zero GST)
  // =========================================================================
  describe('1. Non-GST Calculation Engine', () => {
    it('calculates grand total strictly from item prices without adding GST or splitting tax', () => {
      // 2 items: 1x ₹1,500 (150000 paise) and 2x ₹350 (35000 paise each)
      // Even if legacy callers or items supply gstRateBp: 1800, tax engine with 0 bp computes zero tax
      const summary = calculateInvoiceTax(
        [
          { qty: 1, ratePaise: 150000n, gstRateBp: 0 },
          { qty: 2, ratePaise: 35000n, gstRateBp: 0 },
        ],
        '27',
        '27'
      );

      expect(summary.subtotal).toBe(220000n); // 1500 + 700 = 2200 rupees (220000 paise)
      expect(summary.totalTax).toBe(0n);
      expect(summary.cgst).toBe(0n);
      expect(summary.sgst).toBe(0n);
      expect(summary.igst).toBe(0n);
      expect(summary.grandTotal).toBe(220000n); // exactly equal to subtotal
    });

    it('correctly applies line discounts without tax distortion', () => {
      // Item: ₹1,000 (100000 paise) with ₹100 discount (10000 paise)
      const summary = calculateInvoiceTax(
        [
          { qty: 1, ratePaise: 100000n, discountPaise: 10000n, gstRateBp: 0 },
        ],
        '27',
        '27'
      );

      expect(summary.subtotal).toBe(100000n);
      expect(summary.discountTotal).toBe(10000n);
      expect(summary.grandTotal).toBe(90000n); // ₹900
      expect(summary.totalTax).toBe(0n);
    });
  });

  // =========================================================================
  // 2. Full Route API Workflow: Non-GST Bill, Ledger & Payment Match
  // =========================================================================
  describe('2. Bill Creation via API', () => {
    it('creates a non-GST sales bill where grandTotal equals sum of item prices and ledger entry matches exactly', async () => {
      const req = createPostRequest({
        customerId: CUSTOMER_A,
        cashPaidPaise: 0,
        upiPaidPaise: 0,
        items: [
          {
            productId: PRODUCT_A,
            name: 'BOSCH Spark Plug',
            qty: 2,
            ratePaise: 25000, // ₹250 each = ₹500 total
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      // Grand total should be exactly 50000 paise (₹500.00), NOT ₹500 + 18% GST (₹590.00)
      expect(data.grandTotalPaise).toBe('50000');
      expect(data.invoice.grandTotalPaise).toBe('50000');

      // Verify Customer Khata Ledger Entry in localStore
      const ledgerEntries = (localStore as any).data.ledgerEntries.filter(
        (e: any) => e.tenantId === TENANT_A && e.customerId === CUSTOMER_A
      );
      expect(ledgerEntries.length).toBe(1);
      expect(ledgerEntries[0].debitPaise).toBe('50000');
      expect(ledgerEntries[0].creditPaise).toBe('0');
      expect(ledgerEntries[0].narration).toContain('Sales Bill #');

      // Customer current balance should be updated to 50000 paise
      const updatedCust = localStore.getCustomerById(CUSTOMER_A, TENANT_A);
      expect(updatedCust?.balancePaise).toBe('50000');

      // Verify stock was reduced by 2 (50 -> 48)
      const updatedProd = localStore.getProductById(PRODUCT_A, TENANT_A);
      expect(updatedProd?.stockQty).toBe(48);
    });

    it('records counter cash settlement matching the bill total without tax discrepancy', async () => {
      const req = createPostRequest({
        customerId: CUSTOMER_A,
        cashPaidPaise: 75000, // ₹750 full payment at counter
        items: [
          {
            name: 'Engine Oil Filter',
            qty: 3,
            ratePaise: 25000, // ₹250 each = ₹750 total (75000 paise)
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.grandTotalPaise).toBe('75000');
      expect(data.invoice.status).toBe('PAID');

      // Verify Payment record
      const payments = (localStore as any).data.payments.filter(
        (p: any) => p.tenantId === TENANT_A && p.customerId === CUSTOMER_A
      );
      expect(payments.length).toBe(1);
      expect(payments[0].amountPaise).toBe('75000');
      expect(payments[0].mode).toBe('CASH');

      // Verify Customer balance remains 0 since it was paid in full at counter
      const updatedCust = localStore.getCustomerById(CUSTOMER_A, TENANT_A);
      expect(updatedCust?.balancePaise).toBe('0');
    });

    it('records partial counter payment with remainder correctly tracked as Khata credit balance', async () => {
      // Bill: ₹1,000 (100000 paise). Paid Cash: ₹400 (40000 paise). Khata balance due: ₹600 (60000 paise)
      const req = createPostRequest({
        customerId: CUSTOMER_A,
        cashPaidPaise: 40000,
        items: [
          {
            name: 'Chain Sprocket Kit',
            qty: 1,
            ratePaise: 100000,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.grandTotalPaise).toBe('100000');
      expect(data.invoice.paidNowPaise).toBe('40000');
      expect(data.invoice.creditBalancePaise).toBe('60000');
      expect(data.invoice.status).toBe('ISSUED');

      // Verify customer running balance is debited by the net credit amount (100000 - 40000 = 60000)
      const cust = localStore.getCustomerById(CUSTOMER_A, TENANT_A);
      expect(cust?.balancePaise).toBe('60000');

      // Verify 2 ledger entries exist: 1 for Bill (+100000), 1 for Payment (-40000)
      const ledger = (localStore as any).data.ledgerEntries.filter(
        (e: any) => e.tenantId === TENANT_A && e.customerId === CUSTOMER_A
      );
      expect(ledger.length).toBe(2);
      expect(ledger.find((l: any) => l.type === 'INVOICE')?.debitPaise).toBe('100000');
      expect(ledger.find((l: any) => l.type === 'PAYMENT')?.creditPaise).toBe('40000');
    });

    it('records full UPI payment with reference number', async () => {
      const req = createPostRequest({
        customerId: CUSTOMER_A,
        cashPaidPaise: 0,
        upiPaidPaise: 65000,
        upiRef: 'UPI-REF-998877',
        items: [
          {
            name: 'Battery 12V 4Ah',
            qty: 1,
            ratePaise: 65000,
          },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.invoice.status).toBe('PAID');
      const payments = (localStore as any).data.payments.filter(
        (p: any) => p.tenantId === TENANT_A && p.customerId === CUSTOMER_A
      );
      expect(payments.length).toBe(1);
      expect(payments[0].mode).toBe('UPI');
      expect(payments[0].amountPaise).toBe('65000');
      expect(payments[0].referenceNumber).toBe('UPI-REF-998877');
    });

    it('calculates multi-item bill with line discounts in exact integer paise without tax markup', async () => {
      // Item 1: 3x @ ₹200 (60000 paise) - ₹50 discount (5000 paise) = 55000 paise
      // Item 2: 1x @ ₹450 (45000 paise) = 45000 paise
      // Item 3: 2x @ ₹150 (30000 paise) - 10% discount (3000 paise) = 27000 paise
      // Total = 55000 + 45000 + 27000 = 127000 paise (₹1,270.00)
      const req = createPostRequest({
        customerId: CUSTOMER_A,
        items: [
          { name: 'Item 1', qty: 3, ratePaise: 20000, discountPaise: 5000 },
          { name: 'Item 2', qty: 1, ratePaise: 45000 },
          { name: 'Item 3', qty: 2, ratePaise: 15000, discountPercent: 10 },
        ],
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.grandTotalPaise).toBe('127000');
      expect(data.taxSummary.totalTax).toBe('0');
      expect(data.taxSummary.taxableValue).toBe('127000');
    });

    it('preserves sequential unique bill numbering on successive non-GST bill creations', async () => {
      const req1 = createPostRequest({
        customerId: CUSTOMER_A,
        items: [{ name: 'Brake Cable', qty: 1, ratePaise: 12000 }],
      });
      const res1 = await POST(req1);
      const data1 = await res1.json();

      const req2 = createPostRequest({
        customerId: CUSTOMER_A,
        items: [{ name: 'Clutch Wire', qty: 1, ratePaise: 15000 }],
      });
      const res2 = await POST(req2);
      const data2 = await res2.json();

      expect(data1.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/00001$/);
      expect(data2.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/00002$/);
      expect(data1.invoice.number).toBe(1);
      expect(data2.invoice.number).toBe(2);
    });
  });

  // =========================================================================
  // 3. Bill Cancellation & Financial/Stock Reversal
  // =========================================================================
  describe('3. Bill Cancellation & Reversals', () => {
    it('restores stock and reverses Khata balance when a bill is cancelled', async () => {
      // 1. Create bill for 2 units on credit (stock: 50 -> 48, balance: 0 -> 50000 paise)
      const req = createPostRequest({
        customerId: CUSTOMER_A,
        items: [{ productId: PRODUCT_A, name: 'BOSCH Spark Plug', qty: 2, ratePaise: 25000 }],
      });
      const createRes = await POST(req);
      const createData = await createRes.json();
      const invoiceId = createData.invoice.id;

      expect(localStore.getProductById(PRODUCT_A, TENANT_A)?.stockQty).toBe(48);
      expect(localStore.getCustomerById(CUSTOMER_A, TENANT_A)?.balancePaise).toBe('50000');

      // 2. Cancel invoice via localStore directly or DELETE handler
      const cancelled = localStore.cancelInvoice(invoiceId, 'Customer return', TENANT_A);
      expect(cancelled?.status).toBe('CANCELLED');

      // 3. Verify stock is restored from 48 back to 50
      expect(localStore.getProductById(PRODUCT_A, TENANT_A)?.stockQty).toBe(50);

      // 4. Verify Khata balance is reversed back to 0
      expect(localStore.getCustomerById(CUSTOMER_A, TENANT_A)?.balancePaise).toBe('0');

      // 5. Test idempotency: calling cancel again does not double-restore stock
      const cancelAgain = localStore.cancelInvoice(invoiceId, 'Second cancel call', TENANT_A);
      expect(cancelAgain?.status).toBe('CANCELLED');
      expect(localStore.getProductById(PRODUCT_A, TENANT_A)?.stockQty).toBe(50);
      expect(localStore.getCustomerById(CUSTOMER_A, TENANT_A)?.balancePaise).toBe('0');
    });
  });

  // =========================================================================
  // 4. Historical Invoices Compatibility
  // =========================================================================
  describe('4. Historical Compatibility', () => {
    it('renders historical invoices with legacy tax fields intact without altering them', () => {
      // Seed a legacy GST invoice in localStore
      const rawData = (localStore as any).data;
      rawData.invoices.push({
        id: 'legacy-gst-1',
        tenantId: TENANT_A,
        customerId: CUSTOMER_A,
        invoiceNumber: 'INV/2025-26/00100',
        grandTotalPaise: '118000',
        paidNowPaise: '118000',
        creditBalancePaise: '0',
        status: 'PAID',
        createdAt: '2025-11-15T10:00:00.000Z',
        items: [
          {
            name: 'Legacy Part',
            qty: 1,
            ratePaise: 100000,
            gstRateBp: 1800,
          },
        ],
      });

      const inv = localStore.getInvoiceById('legacy-gst-1', TENANT_A);
      expect(inv).toBeDefined();
      expect(inv?.invoiceNumber).toBe('INV/2025-26/00100');
      expect(inv?.grandTotalPaise).toBe('118000');
      // Historical record remains unchanged
    });
  });
});
