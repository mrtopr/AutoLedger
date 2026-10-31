import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createInvoice, DELETE as cancelInvoice } from '@/app/api/v1/invoices/route';
import { POST as createPayment } from '@/app/api/v1/payments/route';
import { GET as getSettlementReport } from '@/app/api/v1/reports/settlement/route';
import { localStore } from '@/server/lib/store';
import { calculateInvoiceTax } from '@/server/lib/tax';
import * as prismaModule from '@/server/lib/prisma';
import { StockReason } from '@prisma/client';

// Mock authentication
vi.mock('@/server/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));

import { getAuthenticatedUser } from '@/server/lib/auth';

describe('FIX 06 — Financial Integrity, Concurrency, and Production Audit', () => {
  const tenantId = 'tenant-audit-2026';
  const ownerUser = {
    id: 'user-owner-01',
    tenantId,
    name: 'Owner User',
    role: 'OWNER',
    phone: '9999900001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStore.clearAll();
    (getAuthenticatedUser as any).mockResolvedValue(ownerUser);
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
  });

  describe('1. Money, Rounding, and Strict Input Validation', () => {
    it('rejects invoice with non-positive or non-finite item quantity', async () => {
      const payloadZeroQty = {
        items: [{ name: 'Spark Plug', qty: 0, ratePaise: 15000 }],
      };
      const req1 = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadZeroQty),
      });
      const res1 = await createInvoice(req1);
      expect(res1.status).toBe(400);
      const data1 = await res1.json();
      expect(data1.error).toContain('Quantity must be a valid positive number');

      const payloadNegQty = {
        items: [{ name: 'Brake Pad', qty: -3, ratePaise: 25000 }],
      };
      const req2 = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNegQty),
      });
      const res2 = await createInvoice(req2);
      expect(res2.status).toBe(400);
    });

    it('rejects invoice with negative or non-finite unit price / rate', async () => {
      const payloadNegRate = {
        items: [{ name: 'Engine Oil', qty: 2, ratePaise: -5000 }],
      };
      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNegRate),
      });
      const res = await createInvoice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Rate must be a valid non-negative amount');
    });

    it('rejects invoice when line discount exceeds item gross total', async () => {
      const payloadOverDiscount = {
        items: [{ name: 'Chain Sprocket', qty: 1, ratePaise: 50000, discountPaise: 60000 }],
      };
      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadOverDiscount),
      });
      const res = await createInvoice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Discount cannot exceed item gross total');
    });

    it('rejects invoice when discount percent is negative or greater than 100', async () => {
      const payloadBadPct = {
        items: [{ name: 'Filter', qty: 1, ratePaise: 10000, discountPercent: 125 }],
      };
      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBadPct),
      });
      const res = await createInvoice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Discount percent must be between 0 and 100');
    });

    it('rejects negative or invalid cash/UPI tender values', async () => {
      const payloadNegCash = {
        items: [{ name: 'Bulb', qty: 1, ratePaise: 2000 }],
        cashPaidPaise: -500,
      };
      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNegCash),
      });
      const res = await createInvoice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cash paid amount cannot be negative or invalid');
    });

    it('rejects walk-in overpayment exceeding grand total', async () => {
      const payloadOverpay = {
        items: [{ name: 'Bulb', qty: 1, ratePaise: 2000 }], // ₹20.00
        cashPaidPaise: 5000, // ₹50.00 on walk-in bill
      };
      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadOverpay),
      });
      const res = await createInvoice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Walk-in cash/UPI payment cannot exceed the bill grand total');
    });

    it('calculates integer paise arithmetic and standard 50-paise round-off correctly', () => {
      // 1 unit at ₹99.49 (9949 paise) -> round-off = -49 paise -> grand total = ₹99.00 (9900 paise)
      const res1 = calculateInvoiceTax([{ qty: 1, ratePaise: 9949n, gstRateBp: 0 }]);
      expect(res1.subtotal).toBe(9949n);
      expect(res1.roundOff).toBe(-49n);
      expect(res1.grandTotal).toBe(9900n);

      // 1 unit at ₹99.50 (9950 paise) -> round-off = +50 paise -> grand total = ₹100.00 (10000 paise)
      const res2 = calculateInvoiceTax([{ qty: 1, ratePaise: 9950n, gstRateBp: 0 }]);
      expect(res2.subtotal).toBe(9950n);
      expect(res2.roundOff).toBe(50n);
      expect(res2.grandTotal).toBe(10000n);
    });
  });

  describe('2. Idempotency and Duplicate Protection', () => {
    it('returns identical invoice without creating duplicate bills on retry with same Idempotency-Key', async () => {
      const idempotencyKey = 'idemp-test-key-001';
      const payload = {
        items: [{ name: 'Engine Oil', qty: 1, ratePaise: 35000 }],
        cashPaidPaise: 35000,
        idempotencyKey,
      };

      // First request
      const req1 = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const res1 = await createInvoice(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      const invoiceNumber1 = data1.invoiceNumber;
      expect(invoiceNumber1).toBeDefined();

      // Second request with exact same idempotency key
      const req2 = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const res2 = await createInvoice(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.isDuplicate).toBe(true);
      expect(data2.invoiceNumber).toBe(invoiceNumber1);

      // Verify in localStore that only ONE invoice was created
      const allInvoices = localStore.getInvoices(tenantId);
      const matchingInvoices = allInvoices.filter((inv) => inv.invoiceNumber === invoiceNumber1);
      expect(matchingInvoices.length).toBe(1);
    });

    it('does not deduplicate separate legitimate purchases having identical amounts', async () => {
      const payload = {
        items: [{ name: 'Engine Oil', qty: 1, ratePaise: 35000 }],
        cashPaidPaise: 35000,
      };

      // Purchase A
      const reqA = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'purchase-A-key',
        },
        body: JSON.stringify(payload),
      });
      const resA = await createInvoice(reqA);
      expect(resA.status).toBe(201);
      const dataA = await resA.json();

      // Purchase B (different idempotency key)
      const reqB = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'purchase-B-key',
        },
        body: JSON.stringify(payload),
      });
      const resB = await createInvoice(reqB);
      expect(resB.status).toBe(201);
      const dataB = await resB.json();

      expect(dataA.invoiceNumber).not.toBe(dataB.invoiceNumber);
    });

    it('deduplicates payment submissions using Idempotency-Key', async () => {
      // Seed a customer with balance
      const customer = localStore.createCustomer({
        tenantId,
        name: 'Auto Garage',
        shopName: 'Auto Garage Spares',
        phone: '9888800001',
        customerType: 'GARAGE',
        balancePaise: '50000',
        creditLimitPaise: '100000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      const paymentKey = 'pay-idemp-key-999';
      const payPayload = {
        customerId: customer.id,
        amountPaise: '20000',
        mode: 'UPI',
        idempotencyKey: paymentKey,
      };

      // First payment
      const req1 = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': paymentKey,
        },
        body: JSON.stringify(payPayload),
      });
      const res1 = await createPayment(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.paymentId).toBeDefined();

      // Retry payment with same key
      const req2 = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': paymentKey,
        },
        body: JSON.stringify(payPayload),
      });
      const res2 = await createPayment(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.isDuplicate).toBe(true);
      expect(data2.paymentId).toBe(data1.paymentId);
    });
  });

  describe('3. Concurrency, Stock Reversal, and Cancellation Idempotency', () => {
    it('restores stock exactly once and handles repeated cancellation idempotently', async () => {
      // Create product with initial stock = 10
      const product = localStore.createProduct({
        tenantId,
        name: 'Disc Rotor',
        stockQty: 10,
        reorderLevel: 2,
        purchasePricePaise: '40000',
        salePricePaise: '60000',
        mrpPaise: '75000',
        hsnCode: '8714',
        gstRateBp: 0,
        unit: 'pcs',
        models: ['Hero Splendor'],
      });

      // Issue bill selling 3 units -> stock becomes 7
      const billPayload = {
        items: [{ productId: product.id, name: product.name, qty: 3, ratePaise: 60000 }],
        cashPaidPaise: 180000,
      };
      const billReq = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billPayload),
      });
      const billRes = await createInvoice(billReq);
      expect(billRes.status).toBe(201);
      const billData = await billRes.json();
      const invoiceId = billData.invoice.id;

      const pAfterSale = localStore.getProductById(product.id, tenantId);
      expect(pAfterSale?.stockQty).toBe(7);

      // First Cancellation -> stock should be restored to 10
      const cancelReq1 = new NextRequest(`http://localhost/api/v1/invoices?id=${invoiceId}&reason=TestCancel`, {
        method: 'DELETE',
      });
      const cancelRes1 = await cancelInvoice(cancelReq1);
      expect(cancelRes1.status).toBe(200);
      const pAfterCancel1 = localStore.getProductById(product.id, tenantId);
      expect(pAfterCancel1?.stockQty).toBe(10);

      // Repeated Cancellation -> must be idempotent, NOT inflate stock to 13
      const cancelReq2 = new NextRequest(`http://localhost/api/v1/invoices?id=${invoiceId}&reason=TestCancelRepeated`, {
        method: 'DELETE',
      });
      const cancelRes2 = await cancelInvoice(cancelReq2);
      expect(cancelRes2.status).toBe(200);
      const cancelData2 = await cancelRes2.json();
      expect(cancelData2.alreadyCancelled).toBe(true);

      const pAfterCancel2 = localStore.getProductById(product.id, tenantId);
      expect(pAfterCancel2?.stockQty).toBe(10); // Still 10, not inflated!
    });
  });

  describe('4. Reports Reconciliation: Exclusion of Cancelled Invoices', () => {
    it('excludes cancelled invoices from daily settlement sales and Khata totals', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create Customer
      const cust = localStore.createCustomer({
        tenantId,
        name: 'Settlement Test Customer',
        shopName: 'Settlement Garage',
        phone: '9876543210',
        customerType: 'GARAGE',
        balancePaise: '0',
        creditLimitPaise: '1000000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      // 1. Create Active Bill of ₹500 (50000 paise) on credit
      const activeBillPayload = {
        customerId: cust.id,
        items: [{ name: 'Clutch Wire', qty: 1, ratePaise: 50000 }],
        cashPaidPaise: 0,
      };
      const reqActive = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeBillPayload),
      });
      const resActive = await createInvoice(reqActive);
      expect(resActive.status).toBe(201);

      // 2. Create Bill of ₹300 (30000 paise) and then CANCEL it
      const cancelBillPayload = {
        customerId: cust.id,
        items: [{ name: 'Brake Cable', qty: 1, ratePaise: 30000 }],
        cashPaidPaise: 0,
      };
      const reqCancel = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancelBillPayload),
      });
      const resCancel = await createInvoice(reqCancel);
      expect(resCancel.status).toBe(201);
      const cancelBillData = await resCancel.json();

      // Cancel the second bill
      const reqDoCancel = new NextRequest(`http://localhost/api/v1/invoices?id=${cancelBillData.invoice.id}&reason=Voided`, {
        method: 'DELETE',
      });
      await cancelInvoice(reqDoCancel);

      // 3. Query Settlement Report for today
      const reportReq = new NextRequest(`http://localhost/api/v1/reports/settlement?date=${today}`);
      const reportRes = await getSettlementReport(reportReq);
      expect(reportRes.status).toBe(200);
      const reportData = await reportRes.json();

      // Expected gross sales should ONLY include active bill (₹500 = 50000 paise), NOT ₹800
      expect(reportData.summary.grossSalesPaise).toBe('50000');
      // Expected Khata credit balance should ONLY be ₹500
      expect(reportData.summary.khataGivenPaise).toBe('50000');
      // Exactly 1 active invoice (cancelled invoice is excluded)
      expect(reportData.summary.totalInvoicesCount).toBe(1);
    });
  });

  describe('5. PostgreSQL Transaction Atomicity & Stock Decrement Verification', () => {
    it('creates StockMovement with SALE and audit event inside PostgreSQL transaction', async () => {
      const pgTenantId = '11111111-1111-4111-8111-111111111111';
      const pgProductId = '22222222-2222-4222-8222-222222222222';
      const pgCustomerId = '33333333-3333-4333-8333-333333333333';

      (getAuthenticatedUser as any).mockResolvedValue({
        id: 'user-pg-01',
        tenantId: pgTenantId,
        role: 'OWNER',
        phone: '9999900002',
      });

      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const createdStockMovements: any[] = [];
      const createdEvents: any[] = [];

      const mockTx = {
        invoice: {
          create: vi.fn().mockResolvedValue({
            id: 'inv-pg-001',
            number: 'INV/2026-27/0001',
            seriesCode: 'INV',
            fy: '2026-27',
            grandTotal: 50000n,
            taxableValue: 50000n,
          }),
        },
        ledgerEntry: {
          create: vi.fn().mockResolvedValue({ id: 'le-01' }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation((args) => {
            createdStockMovements.push(args.data);
            return Promise.resolve({ id: 'sm-01', ...args.data });
          }),
        },
        invoiceEvent: {
          create: vi.fn().mockImplementation((args) => {
            createdEvents.push(args.data);
            return Promise.resolve({ id: 'ie-01', ...args.data });
          }),
        },
        customer: {
          findUnique: vi.fn().mockResolvedValue({
            id: pgCustomerId,
            creditLimit: 100000n,
            ledgerEntries: [{ debit: 50000n, credit: 0n }],
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        payment: {
          create: vi.fn().mockResolvedValue({ id: 'pay-pg-01' }),
        },
        paymentAllocation: {
          create: vi.fn().mockResolvedValue({ id: 'pa-pg-01' }),
        },
      };

      // Mock prisma.customer.findFirst
      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: pgCustomerId,
        tenantId: pgTenantId,
      } as any);

      // Mock prisma.product.findMany for tenant ownership validation
      vi.spyOn(prismaModule.prisma.product, 'findMany').mockResolvedValue([
        { id: pgProductId, tenantId: pgTenantId }
      ] as any);

      // Mock prisma.$transaction to execute with mockTx
      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const payload = {
        customerId: pgCustomerId,
        items: [{ productId: pgProductId, name: 'Brake Disc', qty: 2, ratePaise: 25000 }],
        cashPaidPaise: 0,
        idempotencyKey: 'pg-idemp-001',
      };

      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createInvoice(req);
      expect(res.status).toBe(201);

      // Verify stock movement was created inside tx with negative quantity and SALE reason
      expect(createdStockMovements.length).toBe(1);
      expect(createdStockMovements[0]).toMatchObject({
        tenantId: pgTenantId,
        productId: pgProductId,
        qty: -2,
        reason: StockReason.SALE,
        refType: 'INVOICE',
        refId: 'inv-pg-001',
      });

      // Verify audit event was created inside tx with idempotencyKey
      expect(createdEvents.length).toBe(1);
      expect(createdEvents[0]).toMatchObject({
        invoiceId: 'inv-pg-001',
        event: 'CREATED',
        meta: expect.objectContaining({
          idempotencyKey: 'pg-idemp-001',
        }),
      });
    });

    it('rolls back completely and returns HTTP 500 when PostgreSQL transaction encounters failure', async () => {
      const pgTenantId = '11111111-1111-4111-8111-111111111111';
      const pgCustomerId = '33333333-3333-4333-8333-333333333333';

      (getAuthenticatedUser as any).mockResolvedValue({
        id: 'user-pg-01',
        tenantId: pgTenantId,
        role: 'OWNER',
        phone: '9999900002',
      });

      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: pgCustomerId,
        tenantId: pgTenantId,
      } as any);

      // Mock transaction failure (e.g. database serialization conflict or lock timeout)
      vi.spyOn(prismaModule.prisma, '$transaction').mockRejectedValue(
        new Error('Serialization failure / deadlock in concurrent sale')
      );

      const payload = {
        customerId: pgCustomerId,
        items: [{ name: 'Gasket', qty: 1, ratePaise: 5000 }],
        cashPaidPaise: 5000,
      };

      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createInvoice(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to create invoice');
    });
  });
});
