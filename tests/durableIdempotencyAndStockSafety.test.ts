import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createInvoice, DELETE as cancelInvoice } from '@/app/api/v1/invoices/route';
import { POST as createPayment } from '@/app/api/v1/payments/route';
import { localStore } from '@/server/lib/store';
import * as prismaModule from '@/server/lib/prisma';
import { StockReason, InvoiceStatus } from '@prisma/client';

// Mock authentication
vi.mock('@/server/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));

import { getAuthenticatedUser } from '@/server/lib/auth';

describe('FIX 07 — Durable Idempotency & Concurrent Inventory Safety', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const customerId = '00000000-0000-0000-0000-000000000010';
  const productId = '00000000-0000-0000-0000-000000000100';

  const authUser = {
    id: '00000000-0000-0000-0000-000000000099',
    tenantId,
    name: 'Owner Tester',
    role: 'OWNER',
    phone: '9876543210',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStore.clearAll();
    (getAuthenticatedUser as any).mockResolvedValue(authUser);
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
  });

  describe('A. Durable Idempotency for Invoices & Payments', () => {
    it('returns the same invoice and creates one set of side effects on sequential retries with same idempotency key (localStore)', async () => {
      // Setup product in local store
      localStore.createProduct({
        id: 'prod-01',
        tenantId,
        name: 'Brake Shoe',
        salePricePaise: '45000',
        stockQty: 10,
      } as any);

      const payload = {
        idempotencyKey: 'idemp-seq-001',
        items: [{ productId: 'prod-01', name: 'Brake Shoe', qty: 2, ratePaise: 45000 }],
        customerPhone: '9822100001',
        customerName: 'Sharma Motors',
      };

      const req1 = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res1 = await createInvoice(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.invoiceNumber).toBeDefined();

      const stockAfterFirst = localStore.getProductById('prod-01', tenantId)?.stockQty;
      expect(stockAfterFirst).toBe(8); // 10 - 2 = 8

      // Second request with SAME idempotency key (simulating retry / timeout recovery)
      const req2 = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res2 = await createInvoice(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.isDuplicate).toBe(true);
      expect(data2.invoiceNumber).toBe(data1.invoiceNumber);

      // Stock must NOT be deducted a second time
      const stockAfterSecond = localStore.getProductById('prod-01', tenantId)?.stockQty;
      expect(stockAfterSecond).toBe(8);

      // Total invoices created must be exactly 1
      const allInvoices = localStore.getInvoices(tenantId);
      expect(allInvoices.length).toBe(1);
    });

    it('creates a legitimate separate sale when a different idempotency key is submitted', async () => {
      localStore.createProduct({
        id: 'prod-02',
        tenantId,
        name: 'Chain Sprocket',
        salePricePaise: '85000',
        stockQty: 10,
      } as any);

      const payload1 = {
        idempotencyKey: 'idemp-diff-001',
        items: [{ productId: 'prod-02', name: 'Chain Sprocket', qty: 1, ratePaise: 85000 }],
      };
      const res1 = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1),
      }));
      expect(res1.status).toBe(201);

      const payload2 = {
        idempotencyKey: 'idemp-diff-002',
        items: [{ productId: 'prod-02', name: 'Chain Sprocket', qty: 1, ratePaise: 85000 }],
      };
      const res2 = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2),
      }));
      expect(res2.status).toBe(201);

      expect(localStore.getProductById('prod-02', tenantId)?.stockQty).toBe(8); // 10 - 1 - 1 = 8
      expect(localStore.getInvoices(tenantId).length).toBe(2);
    });

    it('safely handles concurrent PostgreSQL race with P2002 error without duplicate invoice creation', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const winningInvoice = {
        id: 'inv-win-001',
        tenantId,
        number: 'INV/2026-27/00099',
        seriesCode: 'INV',
        fy: '2026-27',
        status: InvoiceStatus.PAID,
        grandTotal: 50000n,
        createdAt: new Date('2026-10-28T10:00:00Z'),
        items: [
          {
            id: 'item-01',
            productId,
            description: 'Clutch Cable',
            qty: 2,
            rate: 25000n,
            lineTotal: 50000n,
          },
        ],
        allocations: [],
      };

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: customerId,
        tenantId,
      } as any);

      vi.spyOn(prismaModule.prisma.product, 'findMany').mockResolvedValue([
        { id: productId, tenantId }
      ] as any);

      // First query before tx returns null (both requests see no existing invoice initially)
      vi.spyOn(prismaModule.prisma.invoice, 'findFirst')
        .mockResolvedValueOnce(null) // Pre-tx check: not yet created
        .mockResolvedValueOnce(winningInvoice as any); // Post-P2002 check: winning invoice found

      // Simulate concurrent transaction conflict throwing P2002
      vi.spyOn(prismaModule.prisma, '$transaction').mockRejectedValue({
        code: 'P2002',
        meta: { target: ['tenant_id', 'idempotency_key'] },
        message: 'Unique constraint failed on tenant_id, idempotency_key',
      });

      const payload = {
        customerId,
        idempotencyKey: 'race-key-999',
        items: [{ productId, name: 'Clutch Cable', qty: 2, ratePaise: 25000 }],
      };

      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createInvoice(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(true);
      expect(data.invoice.id).toBe('inv-win-001');
      expect(data.invoice.invoiceNumber).toBe('INV/2026-27/00099');
      expect(data.invoice.grandTotalPaise).toBe('50000');
    });

    it('returns durable PostgreSQL invoice on retry even after in-memory cache is wiped (restart simulation)', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const persistedInvoice = {
        id: 'inv-persisted-001',
        tenantId,
        customerId,
        number: 'INV/2026-27/00105',
        seriesCode: 'INV',
        fy: '2026-27',
        status: InvoiceStatus.ISSUED,
        grandTotal: 120000n,
        taxableValue: 120000n,
        cgst: 0n,
        sgst: 0n,
        igst: 0n,
        createdAt: new Date('2026-10-28T09:00:00Z'),
        items: [
          {
            id: 'item-105',
            productId,
            description: 'Engine Oil 20W40',
            qty: 3,
            rate: 40000n,
            lineTotal: 120000n,
          },
        ],
        allocations: [],
      };

      // Mock finding the invoice in PostgreSQL during initial idempotency check
      vi.spyOn(prismaModule.prisma.invoice, 'findFirst').mockResolvedValue(persistedInvoice as any);

      const payload = {
        customerId,
        idempotencyKey: 'server-reboot-key-01',
        items: [{ productId, name: 'Engine Oil 20W40', qty: 3, ratePaise: 40000 }],
      };

      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createInvoice(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(true);
      expect(data.invoice.id).toBe('inv-persisted-001');
      expect(data.invoiceNumber).toBe('INV/2026-27/00105');
      expect(data.grandTotalPaise).toBe('120000');
    });

    it('prevents double-crediting customer on concurrent payment with same idempotency key', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const winningPayment = {
        id: 'pay-win-001',
        tenantId,
        customerId,
        amount: 250000n,
        allocations: [],
      };

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: customerId,
        tenantId,
      } as any);

      vi.spyOn(prismaModule.prisma.invoice, 'findMany').mockResolvedValue([]);

      // Pre-tx check returns null, then transaction fails with P2002
      vi.spyOn(prismaModule.prisma.payment, 'findFirst')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winningPayment as any);

      vi.spyOn(prismaModule.prisma, '$transaction').mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on payment idempotency_key',
      });

      const payload = {
        customerId,
        amountPaise: 250000,
        mode: 'UPI',
        idempotencyKey: 'pay-race-key-01',
      };

      const req = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createPayment(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(true);
      expect(data.paymentId).toBe('pay-win-001');
      expect(data.amountPaise).toBe('250000');
    });
  });

  describe('B. Atomic Stock Validation, Concurrency & Quantity Policy', () => {
    it('strictly validates quantity: rejects zero, negative, fractional, and NaN quantities', async () => {
      const invalidQuantities = [0, -1, -5.5, 1.5, 0.25, NaN, 'abc'];

      for (const invalidQty of invalidQuantities) {
        const payload = {
          items: [{ name: 'Brake Disc', qty: invalidQty, ratePaise: 10000 }],
        };
        const req = new NextRequest('http://localhost/api/v1/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const res = await createInvoice(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('Quantity must be a valid positive number');
      }
    });

    it('rejects invoice when productId does not belong to the authenticated tenant', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const foreignProductId = '00000000-0000-0000-0000-000000000999';

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: customerId,
        tenantId,
      } as any);

      // Simulate database query where foreignProductId is NOT owned by tenantId
      vi.spyOn(prismaModule.prisma.product, 'findMany').mockResolvedValue([]);

      const payload = {
        customerId,
        items: [{ productId: foreignProductId, name: 'Foreign Spark Plug', qty: 1, ratePaise: 15000 }],
      };

      const req = new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createInvoice(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Product not found in your organization|One or more products do not belong/);
    });

    it('records exact integer negative qty in StockMovement without alteration or coercion', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const capturedMovements: any[] = [];
      const mockTx: any = {
        $queryRaw: vi.fn().mockResolvedValue([{ next_val: 1 }]),
        invoice: {
          create: vi.fn().mockResolvedValue({
            id: 'inv-exact-01',
            number: 'INV/2026-27/00001',
            seriesCode: 'INV',
            fy: '2026-27',
            grandTotal: 60000n,
            taxableValue: 60000n,
            tenantId,
          }),
        },
        invoiceItem: { create: vi.fn() },
        ledgerEntry: { create: vi.fn().mockResolvedValue({ id: 'le-01' }) },
        customer: {
          findUnique: vi.fn().mockResolvedValue({ creditLimit: 500000n, ledgerEntries: [] }),
          update: vi.fn().mockResolvedValue({}),
        },
        payment: { create: vi.fn() },
        paymentAllocation: { create: vi.fn() },
        stockMovement: {
          create: vi.fn().mockImplementation((args) => {
            capturedMovements.push(args.data);
            return Promise.resolve({ id: 'sm-01', ...args.data });
          }),
        },
        invoiceEvent: { create: vi.fn().mockResolvedValue({ id: 'ie-01' }) },
      };

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: customerId,
        tenantId,
      } as any);

      vi.spyOn(prismaModule.prisma.product, 'findMany').mockResolvedValue([
        { id: productId, tenantId }
      ] as any);

      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (cb) => cb(mockTx));

      const payload = {
        customerId,
        items: [{ productId, name: 'Battery 12V', qty: 3, ratePaise: 20000 }],
      };

      const res = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));

      expect(res.status).toBe(201);
      expect(capturedMovements.length).toBe(1);
      // Exactly -3, not coerced by Math.max or rounded
      expect(capturedMovements[0].qty).toBe(-3);
      expect(capturedMovements[0].reason).toBe(StockReason.SALE);
    });

    it('repeated cancellation is idempotent: does not restore stock or reverse ledger twice', async () => {
      // 1. Create invoice in local store
      localStore.createProduct({
        id: 'prod-cancel-01',
        tenantId,
        name: 'Headlight Bulb',
        salePricePaise: '15000',
        stockQty: 5,
      } as any);

      localStore.createCustomer({
        id: 'cust-cancel-01',
        tenantId,
        name: 'Rohan Auto',
        balancePaise: '0',
      } as any);

      const inv = localStore.createInvoice({
        tenantId,
        customerId: 'cust-cancel-01',
        invoiceNumber: 'INV/2026-27/00050',
        grandTotalPaise: '15000',
        paidNowPaise: '0',
        creditBalancePaise: '15000',
        items: [{ productId: 'prod-cancel-01', name: 'Headlight Bulb', qty: 2, ratePaise: '15000' }],
      } as any);

      localStore.addLedgerEntry({
        tenantId,
        customerId: 'cust-cancel-01',
        type: 'INVOICE',
        refNo: inv.invoiceNumber,
        narration: 'Test Bill',
        debitPaise: '15000',
        creditPaise: '0',
      } as any);

      // Initial state after bill: stock was 5 - 2 = 3. Balance is 15000 paise.
      expect(localStore.getProductById('prod-cancel-01', tenantId)?.stockQty).toBe(3);
      expect(localStore.getCustomerById('cust-cancel-01', tenantId)?.balancePaise).toBe('15000');

      // First cancellation
      const cancelReq1 = new NextRequest(`http://localhost/api/v1/invoices?id=${inv.id}&reason=Customer%20returned`, {
        method: 'DELETE',
      });
      const cancelRes1 = await cancelInvoice(cancelReq1);
      expect(cancelRes1.status).toBe(200);

      // Stock should be restored back to 5. Balance should be reversed to 0.
      expect(localStore.getProductById('prod-cancel-01', tenantId)?.stockQty).toBe(5);
      expect(localStore.getCustomerById('cust-cancel-01', tenantId)?.balancePaise).toBe('0');

      // Second cancellation on SAME invoice
      const cancelReq2 = new NextRequest(`http://localhost/api/v1/invoices?id=${inv.id}&reason=Accidental%20second%20click`, {
        method: 'DELETE',
      });
      const cancelRes2 = await cancelInvoice(cancelReq2);
      expect(cancelRes2.status).toBe(200);
      const cancelData2 = await cancelRes2.json();
      expect(cancelData2.alreadyCancelled).toBe(true);

      // Stock must STILL be 5 (NOT 7), and balance must STILL be 0 (NOT -15000)
      expect(localStore.getProductById('prod-cancel-01', tenantId)?.stockQty).toBe(5);
      expect(localStore.getCustomerById('cust-cancel-01', tenantId)?.balancePaise).toBe('0');
    });

    it('rolls back all writes together if any step in PostgreSQL transaction fails', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: customerId,
        tenantId,
      } as any);

      vi.spyOn(prismaModule.prisma.product, 'findMany').mockResolvedValue([
        { id: productId, tenantId }
      ] as any);

      vi.spyOn(prismaModule.prisma, '$transaction').mockRejectedValue(new Error('Simulated disk/network error'));

      const payload = {
        customerId,
        items: [{ productId, name: 'Disk Brake Oil', qty: 1, ratePaise: 18000 }],
      };

      const res = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to create invoice');

      // Ensure no localStore mutations leaked through
      expect(localStore.getInvoices(tenantId).length).toBe(0);
    });

    it('rejects conflicting payload with HTTP 409 when the same key is reused with different customer', async () => {
      localStore.createProduct({
        id: 'prod-conflict-01',
        tenantId,
        name: 'Clutch Wire',
        salePricePaise: '20000',
        stockQty: 10,
      } as any);

      localStore.createCustomer({
        id: '00000000-0000-0000-0000-000000000010',
        tenantId,
        name: 'Initial Customer',
      } as any);

      const conflictKey = 'key-conflict-local-01';
      const initialPayload = {
        idempotencyKey: conflictKey,
        customerId: '00000000-0000-0000-0000-000000000010',
        items: [{ productId: 'prod-conflict-01', name: 'Clutch Wire', qty: 1, ratePaise: 20000 }],
      };

      const res1 = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialPayload),
      }));
      expect(res1.status).toBe(201);

      // Reusing SAME key with a DIFFERENT customer
      const conflictingPayload = {
        idempotencyKey: conflictKey,
        customerId: '00000000-0000-0000-0000-000000000999',
        items: [{ productId: 'prod-conflict-01', name: 'Clutch Wire', qty: 1, ratePaise: 20000 }],
      };

      const res2 = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conflictingPayload),
      }));

      expect(res2.status).toBe(409);
      const data2 = await res2.json();
      expect(data2.error).toContain('Idempotency key conflict');
    });

    it('returns HTTP 503 and never falls through to localStore when STORAGE_MODE=postgres and database is down', async () => {
      const originalStorageMode = process.env.STORAGE_MODE;
      process.env.STORAGE_MODE = 'postgres';

      try {
        vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);

        const payload = {
          customerId,
          items: [{ name: 'Engine Gasket', qty: 1, ratePaise: 5000 }],
        };

        const res = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }));

        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.error).toContain('Database service unavailable');

        // Confirm ZERO invoices written to localStore
        expect(localStore.getInvoices(tenantId).length).toBe(0);
      } finally {
        process.env.STORAGE_MODE = originalStorageMode;
      }
    });
  });
});
