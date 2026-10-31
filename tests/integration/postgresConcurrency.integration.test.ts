import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createInvoice, DELETE as cancelInvoice } from '@/app/api/v1/invoices/route';
import { POST as createPayment } from '@/app/api/v1/payments/route';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { StockReason, InvoiceStatus, Role, LedgerEntryType } from '@prisma/client';

// We do NOT mock prisma here — this is a real PostgreSQL integration test!
import * as authModule from '@/server/lib/auth';
import { vi } from 'vitest';

vi.mock('@/server/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));

describe('FIX 08 — Real PostgreSQL Integration & Concurrency Tests', { timeout: 30000 }, () => {
  const testTenantId = '88888888-8888-4888-8888-888888888888';
  const foreignTenantId = '77777777-7777-4777-7777-777777777777';

  const testUserId = '88888888-8888-4888-8888-888888888801';
  const testCustomerId = '88888888-8888-4888-8888-888888888802';
  const testProductId = '88888888-8888-4888-8888-888888888803';
  const foreignProductId = '77777777-7777-4777-7777-777777777701';

  let dbAvailable = false;

  async function cleanupTestData() {
    const tenantIds = [testTenantId, foreignTenantId];
    try {
      await prisma.$transaction([
        prisma.stockMovement.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.ledgerEntry.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.invoiceEvent.deleteMany({ where: { invoice: { tenantId: { in: tenantIds } } } }),
        prisma.paymentAllocation.deleteMany({ where: { payment: { tenantId: { in: tenantIds } } } }),
        prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: { in: tenantIds } } } }),
        prisma.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.invoiceSeries.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }),
      ]);
    } catch {
      // Ignore cleanup error if tables are already empty
    }
  }

  beforeAll(async () => {
    dbAvailable = await isPostgresAvailable();
    if (!dbAvailable) {
      console.warn('PostgreSQL database not available — skipping live integration tests');
      return;
    }

    // Clean up any stale test tenants from previous runs safely
    await cleanupTestData();

    // 1-5. Create isolated test entities in single transaction batch
    await prisma.$transaction([
      prisma.tenant.create({
        data: {
          id: testTenantId,
          name: 'Live Integration Test Tenant',
        },
      }),
      prisma.tenant.create({
        data: {
          id: foreignTenantId,
          name: 'Foreign Test Tenant',
        },
      }),
      prisma.user.create({
        data: {
          id: testUserId,
          tenantId: testTenantId,
          name: 'Live Test Staff',
          phone: '9888888888',
          role: Role.OWNER,
        },
      }),
      prisma.customer.create({
        data: {
          id: testCustomerId,
          tenantId: testTenantId,
          name: 'Integration Test Customer',
          phone: '9777777777',
        },
      }),
      prisma.product.create({
        data: {
          id: testProductId,
          tenantId: testTenantId,
          name: 'Disc Brake Pad (Live Test)',
          partNumber: 'DBP-TEST-001',
          salePrice: 35000n,
        },
      }),
      prisma.product.create({
        data: {
          id: foreignProductId,
          tenantId: foreignTenantId,
          name: 'Foreign Brake Disc',
          partNumber: 'FBD-TEST-001',
          salePrice: 90000n,
        },
      }),
    ]);

    // Mock auth to represent test user
    (authModule.getAuthenticatedUser as any).mockResolvedValue({
      id: testUserId,
      tenantId: testTenantId,
      name: 'Live Test Staff',
      role: 'OWNER',
      phone: '9888888888',
    });
  }, 60000);

  afterAll(async () => {
    if (dbAvailable) {
      try {
        await cleanupTestData();
      } catch (err) {
        console.error('Failed to clean up test tenant:', err);
      } finally {
        await prisma.$disconnect();
      }
    }
  }, 60000);

  it('handles simultaneous concurrent requests with the SAME idempotency key creating exactly one invoice and one set of stock/ledger writes', async () => {
    if (!dbAvailable) return;

    const idempotencyKey = `live-race-${Date.now()}`;
    const payload = {
      customerId: testCustomerId,
      idempotencyKey,
      items: [{ productId: testProductId, name: 'Disc Brake Pad (Live Test)', qty: 2, ratePaise: 35000 }],
      cashPaidPaise: 70000,
    };

    // Launch two simultaneous requests concurrently
    const [resA, resB] = await Promise.all([
      createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })),
      createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })),
    ]);

    expect([200, 201]).toContain(resA.status);
    expect([200, 201]).toContain(resB.status);

    const dataA = await resA.json();
    const dataB = await resB.json();

    expect(dataA.success).toBe(true);
    expect(dataB.success).toBe(true);

    const invA = dataA.invoice;
    const invB = dataB.invoice;
    expect(invA.id).toBe(invB.id);
    expect(invA.number || invA.invoiceNumber).toBe(invB.number || invB.invoiceNumber);

    // Verify database side effects: exactly ONE invoice created
    const dbInvoices = await prisma.invoice.findMany({
      where: { tenantId: testTenantId, idempotencyKey },
    });
    expect(dbInvoices.length).toBe(1);

    // Verify stock movements: exactly ONE negative movement for 2 units
    const stockMovements = await prisma.stockMovement.findMany({
      where: { tenantId: testTenantId, refId: dbInvoices[0].id },
    });
    expect(stockMovements.length).toBe(1);
    expect(stockMovements[0].qty).toBe(-2);
    expect(stockMovements[0].reason).toBe(StockReason.SALE);

    // Verify ledger: exactly ONE invoice debit and ONE payment credit (total 2 entries, balanced)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { tenantId: testTenantId, refId: dbInvoices[0].id },
    });
    expect(ledgerEntries.length).toBe(2);
    const invoiceDebit = ledgerEntries.find(e => e.entryType === LedgerEntryType.INVOICE);
    const paymentCredit = ledgerEntries.find(e => e.entryType === LedgerEntryType.PAYMENT);
    expect(invoiceDebit?.debit).toBe(70000n);
    expect(paymentCredit?.credit).toBe(70000n);
  });

  it('permits a new operation and creates a separate sale when a DIFFERENT idempotency key is submitted', async () => {
    if (!dbAvailable) return;

    const idempotencyKey1 = `live-diff-A-${Date.now()}`;
    const idempotencyKey2 = `live-diff-B-${Date.now()}`;

    const res1 = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        idempotencyKey: idempotencyKey1,
        items: [{ productId: testProductId, name: 'Disc Brake Pad', qty: 1, ratePaise: 35000 }],
      }),
    }));
    expect(res1.status).toBe(201);
    const data1 = await res1.json();

    const res2 = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        idempotencyKey: idempotencyKey2,
        items: [{ productId: testProductId, name: 'Disc Brake Pad', qty: 1, ratePaise: 35000 }],
      }),
    }));
    expect(res2.status).toBe(201);
    const data2 = await res2.json();

    expect(data1.invoice.id).not.toBe(data2.invoice.id);
    expect(data1.invoiceNumber).not.toBe(data2.invoiceNumber);

    const totalInvoices = await prisma.invoice.count({
      where: { tenantId: testTenantId, idempotencyKey: { in: [idempotencyKey1, idempotencyKey2] } },
    });
    expect(totalInvoices).toBe(2);
  });

  it('detects idempotency key payload conflict and returns HTTP 409 when the same key is reused with a different payload', async () => {
    if (!dbAvailable) return;

    const conflictKey = `live-conflict-${Date.now()}`;

    // First request: 1 unit
    const resInitial = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        idempotencyKey: conflictKey,
        items: [{ productId: testProductId, name: 'Disc Brake Pad', qty: 1, ratePaise: 35000 }],
      }),
    }));
    expect(resInitial.status).toBe(201);

    // Conflicting request with DIFFERENT customer or line items using the SAME key
    const otherCustomerId = '00000000-0000-0000-0000-000000000888';
    const resConflicting = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: otherCustomerId,
        idempotencyKey: conflictKey,
        items: [{ productId: testProductId, name: 'Disc Brake Pad', qty: 1, ratePaise: 35000 }],
      }),
    }));

    expect(resConflicting.status).toBe(409);
    const errData = await resConflicting.json();
    expect(errData.error).toContain('Idempotency key conflict');
  });

  it('prevents double-crediting customer on concurrent payment requests with the same idempotency key', async () => {
    if (!dbAvailable) return;

    const payKey = `live-pay-race-${Date.now()}`;
    const payload = {
      customerId: testCustomerId,
      amountPaise: 15000,
      mode: 'UPI',
      idempotencyKey: payKey,
    };

    const [resA, resB] = await Promise.all([
      createPayment(new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })),
      createPayment(new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })),
    ]);

    expect([200, 201]).toContain(resA.status);
    expect([200, 201]).toContain(resB.status);

    const dataA = await resA.json();
    const dataB = await resB.json();

    expect(dataA.paymentId).toBe(dataB.paymentId);

    // Confirm in PostgreSQL: exactly ONE payment row exists
    const dbPayments = await prisma.payment.findMany({
      where: { tenantId: testTenantId, idempotencyKey: payKey },
    });
    expect(dbPayments.length).toBe(1);
    expect(dbPayments[0].amount).toBe(15000n);

    // Confirm in PostgreSQL: exactly ONE ledger credit
    const dbLedgers = await prisma.ledgerEntry.findMany({
      where: { tenantId: testTenantId, refId: dbPayments[0].id },
    });
    expect(dbLedgers.length).toBe(1);
    expect(dbLedgers[0].credit).toBe(15000n);
  });

  it('permits selling below zero stock according to the documented auto parts counter sales policy', async () => {
    if (!dbAvailable) return;

    // Test product with 0 starting movements
    const zeroStockKey = `live-neg-stock-${Date.now()}`;
    const res = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        idempotencyKey: zeroStockKey,
        items: [{ productId: testProductId, name: 'Disc Brake Pad', qty: 5, ratePaise: 35000 }],
      }),
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);

    const movement = await prisma.stockMovement.findFirst({
      where: { tenantId: testTenantId, refId: data.invoice.id },
    });
    expect(movement).toBeDefined();
    expect(movement?.qty).toBe(-5);
  });

  it('rejects foreign-tenant product IDs to enforce strict tenant isolation in live PostgreSQL', async () => {
    if (!dbAvailable) return;

    const res = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        items: [{ productId: foreignProductId, name: 'Foreign Disc', qty: 1, ratePaise: 90000 }],
      }),
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Product not found in your organization|One or more products do not belong/);
  });

  it('repeated cancellation is idempotent: does not restore stock or reverse ledger twice in PostgreSQL', async () => {
    if (!dbAvailable) return;

    // 1. Create an invoice to cancel
    const cancelInvKey = `live-cancel-test-${Date.now()}`;
    const createRes = await createInvoice(new NextRequest('http://localhost/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        idempotencyKey: cancelInvKey,
        items: [{ productId: testProductId, name: 'Disc Brake Pad', qty: 2, ratePaise: 35000 }],
      }),
    }));

    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const invoiceId = createData.invoice.id;

    // First cancellation
    const cancelRes1 = await cancelInvoice(new NextRequest(`http://localhost/api/v1/invoices?id=${invoiceId}&reason=Customer%20Return`, {
      method: 'DELETE',
    }));
    expect(cancelRes1.status).toBe(200);

    const cancelMovements1 = await prisma.stockMovement.findMany({
      where: { tenantId: testTenantId, refId: invoiceId, reason: StockReason.RETURN_IN },
    });
    expect(cancelMovements1.length).toBe(1);
    expect(cancelMovements1[0].qty).toBe(2);

    // Second cancellation attempt on same invoice
    const cancelRes2 = await cancelInvoice(new NextRequest(`http://localhost/api/v1/invoices?id=${invoiceId}&reason=Duplicate%20Click`, {
      method: 'DELETE',
    }));
    expect(cancelRes2.status).toBe(200);
    const cancelData2 = await cancelRes2.json();
    expect(cancelData2.alreadyCancelled).toBe(true);

    // Stock movements count must STILL be exactly 1
    const cancelMovements2 = await prisma.stockMovement.findMany({
      where: { tenantId: testTenantId, refId: invoiceId, reason: StockReason.RETURN_IN },
    });
    expect(cancelMovements2.length).toBe(1);
  });
});
