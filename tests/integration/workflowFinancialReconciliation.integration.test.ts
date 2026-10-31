import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createInvoice, DELETE as cancelInvoice } from '@/app/api/v1/invoices/route';
import { POST as createPayment } from '@/app/api/v1/payments/route';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { StockReason, InvoiceStatus, Role, LedgerEntryType } from '@prisma/client';
import * as authModule from '@/server/lib/auth';
import { vi } from 'vitest';

vi.mock('@/server/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));

describe('FIX 12 — Real PostgreSQL End-to-End Workflow & Financial Reconciliation Integration Tests', { timeout: 45000 }, () => {
  const testTenantId = '99999999-9999-4999-9999-999999999999';
  const testUserId = '99999999-9999-4999-9999-999999999901';
  const testCustomerId = '99999999-9999-4999-9999-999999999902';
  const testProductId1 = '99999999-9999-4999-9999-999999999903';
  const testProductId2 = '99999999-9999-4999-9999-999999999904';

  let dbAvailable = false;

  async function cleanupTestData() {
    try {
      await prisma.$transaction([
        prisma.stockMovement.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.ledgerEntry.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.invoiceEvent.deleteMany({ where: { invoice: { tenantId: testTenantId } } }),
        prisma.paymentAllocation.deleteMany({ where: { payment: { tenantId: testTenantId } } }),
        prisma.payment.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: testTenantId } } }),
        prisma.invoice.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.invoiceSeries.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.product.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.customer.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.user.deleteMany({ where: { tenantId: testTenantId } }),
        prisma.tenant.deleteMany({ where: { id: testTenantId } }),
      ]);
    } catch {
      // Ignore if empty
    }
  }

  beforeAll(async () => {
    dbAvailable = await isPostgresAvailable();
    if (!dbAvailable) {
      console.warn('PostgreSQL database not available — skipping live integration tests');
      return;
    }

    await cleanupTestData();

    // Seed test tenant & catalog
    await prisma.$transaction([
      prisma.tenant.create({
        data: {
          id: testTenantId,
          name: 'Live PG Reconciliation Dealership',
          stateCode: '27',
        },
      }),
      prisma.user.create({
        data: {
          id: testUserId,
          tenantId: testTenantId,
          phone: '9822990001',
          name: 'PG Audit Owner',
          role: Role.OWNER,
        },
      }),
      prisma.customer.create({
        data: {
          id: testCustomerId,
          tenantId: testTenantId,
          name: 'Kisan Auto Repairs',
          shopName: 'Kisan Workshop',
          phone: '9822990002',
          creditLimit: 10000000n, // ₹1,00,000
        },
      }),
      prisma.product.create({
        data: {
          id: testProductId1,
          tenantId: testTenantId,
          name: 'Front Fork Oil 175ml',
          partNumber: 'OIL-FORK-01',
          unit: 'pcs',
          salePrice: 15000n, // ₹150.00
          mrp: 18000n,
        },
      }),
      prisma.product.create({
        data: {
          id: testProductId2,
          tenantId: testTenantId,
          name: 'Disc Brake Pad Set',
          partNumber: 'PAD-DISC-02',
          unit: 'set',
          salePrice: 40000n, // ₹400.00
          mrp: 45000n,
        },
      }),
      // Initial stock inward: 20 units of Fork Oil, 10 units of Brake Pads
      prisma.stockMovement.create({
        data: {
          tenantId: testTenantId,
          productId: testProductId1,
          qty: 20,
          reason: StockReason.OPENING,
          createdBy: testUserId,
        },
      }),
      prisma.stockMovement.create({
        data: {
          tenantId: testTenantId,
          productId: testProductId2,
          qty: 10,
          reason: StockReason.OPENING,
          createdBy: testUserId,
        },
      }),
    ]);
  }, 45000);

  afterAll(async () => {
    if (dbAvailable) {
      await cleanupTestData();
    }
  }, 45000);

  it('verifies complete live PostgreSQL sales bill lifecycle, stock movements, Khata ledger, and subsequent settlement', async () => {
    if (!dbAvailable) return;

    // 1. Authenticate as Dealership Owner
    vi.mocked(authModule.getAuthenticatedUser).mockResolvedValue({
      id: testUserId,
      tenantId: testTenantId,
      name: 'PG Audit Owner',
      role: 'OWNER',
      isActive: true,
      tenant: { id: testTenantId, name: 'Live PG Reconciliation Dealership', stateCode: '27' },
    } as any);

    // 2. Issue multi-item Non-GST Sales Bill:
    // Item 1: 4 Fork Oil @ ₹150.00 = ₹600.00
    // Item 2: 2 Brake Pads @ ₹400.00 = ₹800.00
    // Total Bill: ₹1,400.00 (140000 paise)
    // Counter Payment: Split ₹400 Cash + ₹500 UPI = ₹900 paid now
    // Expected Khata Balance: ₹1,400 - ₹900 = ₹500 (50000 paise)
    const billReq = new NextRequest('http://localhost:3000/api/v1/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        items: [
          { productId: testProductId1, qty: 4, ratePaise: 15000 },
          { productId: testProductId2, qty: 2, ratePaise: 40000 },
        ],
        cashPaidPaise: 40000,
        upiPaidPaise: 50000,
        upiRef: 'UPI-PG-TEST-001',
      }),
    });

    const billRes = await createInvoice(billReq);
    expect(billRes.status).toBe(201);
    const billData = await billRes.json();
    const invoiceId = billData.invoice.id;

    // 3. PostgreSQL Database Reconciliation: Invariant Check A (Invoice Record)
    const dbInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, allocations: { include: { payment: true } } },
    });
    expect(dbInvoice).not.toBeNull();
    expect(dbInvoice!.grandTotal).toBe(140000n);
    expect(dbInvoice!.paidNow).toBe(90000n);
    expect(dbInvoice!.balanceDue).toBe(50000n);
    expect(dbInvoice!.status).toBe(InvoiceStatus.ISSUED);

    // 4. Invariant Check B (Inventory Stock Movements)
    // Product 1 stock: 20 opening - 4 sold = 16
    // Product 2 stock: 10 opening - 2 sold = 8
    const movementsP1 = await prisma.stockMovement.findMany({
      where: { tenantId: testTenantId, productId: testProductId1 },
    });
    const currentStockP1 = movementsP1.reduce((sum, m) => sum + m.qty, 0);
    expect(currentStockP1).toBe(16);

    const movementsP2 = await prisma.stockMovement.findMany({
      where: { tenantId: testTenantId, productId: testProductId2 },
    });
    const currentStockP2 = movementsP2.reduce((sum, m) => sum + m.qty, 0);
    expect(currentStockP2).toBe(8);

    // 5. Invariant Check C (Customer Khata Ledger Entries)
    // Debit entry for Invoice: ₹1,400 (140000)
    // Credit entry for Counter Payment: ₹900 (90000)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { tenantId: testTenantId, customerId: testCustomerId },
      orderBy: { createdAt: 'asc' },
    });
    expect(ledgerEntries.length).toBe(2);
    expect(ledgerEntries[0].entryType).toBe(LedgerEntryType.INVOICE);
    expect(ledgerEntries[0].debit).toBe(140000n);
    expect(ledgerEntries[1].entryType).toBe(LedgerEntryType.PAYMENT);
    expect(ledgerEntries[1].credit).toBe(90000n);

    // Customer running balance = 140000 - 90000 = 50000 paise (₹500.00)
    const runningBal = ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0n);
    expect(runningBal).toBe(50000n);

    // 6. Invariant Check D: Standalone Payment Allocation
    // Customer clears remaining ₹500.00 via UPI
    const payReq = new NextRequest('http://localhost:3000/api/v1/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        amountPaise: '50000',
        mode: 'UPI',
        referenceNumber: 'UPI-PG-CLEAR-999',
      }),
    });

    const payRes = await createPayment(payReq);
    expect(payRes.status).toBe(201);

    // Reconcile Invoice in Database: Balance due becomes 0, status transitions to PAID
    const dbInvoiceAfterPayment = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    expect(dbInvoiceAfterPayment!.balanceDue).toBe(0n);
    expect(dbInvoiceAfterPayment!.status).toBe(InvoiceStatus.PAID);

    // Reconcile Customer Running Balance in Database: Exactly 0n
    const ledgerAfterPay = await prisma.ledgerEntry.findMany({
      where: { tenantId: testTenantId, customerId: testCustomerId },
    });
    const finalBal = ledgerAfterPay.reduce((sum, e) => sum + e.debit - e.credit, 0n);
    expect(finalBal).toBe(0n);
  });

  it('verifies live PostgreSQL invoice cancellation: stock restoration, ledger credit, and balanceDue zeroing', async () => {
    if (!dbAvailable) return;

    vi.mocked(authModule.getAuthenticatedUser).mockResolvedValue({
      id: testUserId,
      tenantId: testTenantId,
      name: 'PG Audit Owner',
      role: 'OWNER',
      isActive: true,
      tenant: { id: testTenantId, name: 'Live PG Reconciliation Dealership', stateCode: '27' },
    } as any);

    // 1. Issue a bill for 2 Fork Oils @ ₹150 = ₹300 total
    const billReq = new NextRequest('http://localhost:3000/api/v1/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        items: [{ productId: testProductId1, qty: 2, ratePaise: 15000 }],
        cashPaidPaise: 10000, // ₹100 cash paid
      }),
    });

    const billRes = await createInvoice(billReq);
    expect(billRes.status).toBe(201);
    const { invoice } = await billRes.json();

    // 2. Cancel the bill
    const cancelReq = new NextRequest(
      `http://localhost:3000/api/v1/invoices?id=${invoice.id}&reason=Defective+packaging+returned`,
      { method: 'DELETE' }
    );
    const cancelRes = await cancelInvoice(cancelReq);
    expect(cancelRes.status).toBe(200);

    // 3. Reconcile Database State:
    const dbInv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(dbInv!.status).toBe(InvoiceStatus.CANCELLED);
    expect(dbInv!.balanceDue).toBe(0n); // balanceDue zeroed out on cancelled invoice

    // 4. Verify Stock Restoration Movement:
    const returnMovement = await prisma.stockMovement.findFirst({
      where: {
        tenantId: testTenantId,
        productId: testProductId1,
        refType: 'INVOICE_CANCEL',
        refId: invoice.id,
      },
    });
    expect(returnMovement).not.toBeNull();
    expect(returnMovement!.qty).toBe(2);
    expect(returnMovement!.reason).toBe(StockReason.RETURN_IN);

    // 5. Verify Customer Ledger Reversal:
    const cancelLedger = await prisma.ledgerEntry.findFirst({
      where: {
        tenantId: testTenantId,
        customerId: testCustomerId,
        entryType: LedgerEntryType.ADJUSTMENT,
        refId: invoice.id,
      },
    });
    expect(cancelLedger).not.toBeNull();
    expect(cancelLedger!.credit).toBe(30000n); // Full invoice reversal credit
  });
});
