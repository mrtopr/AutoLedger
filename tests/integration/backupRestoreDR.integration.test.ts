import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBackup, POST as restoreBackup } from '@/app/api/v1/backup/route';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import {
  StockReason,
  InvoiceStatus,
  InvoiceType,
  PaymentMode,
  PaymentStatus,
  LedgerEntryType,
  Role,
  CustomerType,
  CreditStatus,
} from '@prisma/client';
import * as authModule from '@/server/lib/auth';
import { vi } from 'vitest';

vi.mock('@/server/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));

describe('FIX 10 — Real PostgreSQL Backup, Restore & Financial Reconciliation', { timeout: 120000 }, () => {
  const SOURCE_TENANT_ID = '99999999-9999-4999-9999-999999999999';
  const TARGET_TENANT_ID = '99999999-9999-4999-9999-999999999998';

  const SOURCE_OWNER = {
    id: '99999999-9999-4999-9999-999999999901',
    tenantId: SOURCE_TENANT_ID,
    name: 'Source Owner',
    phone: '9999999901',
    email: 'owner@source.com',
    role: 'OWNER' as const,
    tenant: { id: SOURCE_TENANT_ID, name: 'Source Hub' } as any,
  };

  const TARGET_OWNER = {
    id: '99999999-9999-4999-9999-999999999902',
    tenantId: TARGET_TENANT_ID,
    name: 'Target Owner',
    phone: '9999999902',
    email: 'owner@target.com',
    role: 'OWNER' as const,
    tenant: { id: TARGET_TENANT_ID, name: 'Target Hub' } as any,
  };

  const PRODUCT_ID = '99999999-9999-4999-9999-999999999910';
  const BIKE_MODEL_ID = '99999999-9999-4999-9999-999999999911';
  const CUSTOMER_ID = '99999999-9999-4999-9999-999999999912';
  const INVOICE_1_ID = '99999999-9999-4999-9999-999999999921';
  const INVOICE_2_CANCELLED_ID = '99999999-9999-4999-9999-999999999922';
  const ITEM_1_ID = '99999999-9999-4999-9999-999999999931';
  const ITEM_2_ID = '99999999-9999-4999-9999-999999999932';
  const PAYMENT_ID = '99999999-9999-4999-9999-999999999941';
  const ALLOCATION_ID = '99999999-9999-4999-9999-999999999951';
  const MOVEMENT_OPENING_ID = '99999999-9999-4999-9999-999999999961';
  const MOVEMENT_SALE_1_ID = '99999999-9999-4999-9999-999999999962';
  const MOVEMENT_CANCEL_REV_ID = '99999999-9999-4999-9999-999999999963';
  const EVENT_CANCEL_ID = '99999999-9999-4999-9999-999999999971';
  const LEDGER_1_DEBIT_ID = '99999999-9999-4999-9999-999999999981';
  const LEDGER_2_CREDIT_ID = '99999999-9999-4999-9999-999999999982';
  const LEDGER_3_CREDIT_ID = '99999999-9999-4999-9999-999999999983';

  let dbAvailable = false;

  async function cleanupTestData() {
    const tenantIds = [SOURCE_TENANT_ID, TARGET_TENANT_ID];
    try {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.stockMovement.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.ledgerEntry.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.invoiceEvent.deleteMany({ where: { invoice: { tenantId: { in: tenantIds } } } }),
        prisma.paymentAllocation.deleteMany({ where: { payment: { tenantId: { in: tenantIds } } } }),
        prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: { in: tenantIds } } } }),
        prisma.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.invoiceSeries.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.productCompatibility.deleteMany({ where: { product: { tenantId: { in: tenantIds } } } }),
        prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.bikeModel.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }),
      ]);
    } catch {
      // Ignored
    }
  }

  function createReq(url: string, method: string, body?: any): NextRequest {
    return new NextRequest(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeAll(async () => {
    dbAvailable = await isPostgresAvailable();
    if (!dbAvailable) {
      console.warn('PostgreSQL database not available — skipping live integration tests');
      return;
    }

    await cleanupTestData();

    // 1. Setup synthetic source tenant with complete business fixtures
    await prisma.tenant.upsert({
      where: { id: SOURCE_TENANT_ID },
      update: {},
      create: {
        id: SOURCE_TENANT_ID,
        name: 'AutoSpares Hub Synthetic',
        legalName: 'AutoSpares Hub Private Limited',
        gstin: '27AABCA1234F1Z1',
        address: '101 Motor Market, Pune',
        stateCode: '27 - Maharashtra',
        upiId: 'autospares@upi',
      },
    });

    await prisma.user.create({
      data: {
        id: SOURCE_OWNER.id,
        tenantId: SOURCE_TENANT_ID,
        name: SOURCE_OWNER.name,
        phone: SOURCE_OWNER.phone,
        role: Role.OWNER,
      },
    });

    await prisma.invoiceSeries.create({
      data: {
        tenantId: SOURCE_TENANT_ID,
        seriesCode: 'INV',
        fy: '2026-27',
        prefix: 'INV/2026-27/',
        lastNumber: 15,
      },
    });

    await prisma.bikeModel.create({
      data: {
        id: BIKE_MODEL_ID,
        tenantId: SOURCE_TENANT_ID,
        make: 'Hero',
        model: 'Splendor Plus',
        yearFrom: 2018,
        yearTo: 2024,
      },
    });

    await prisma.product.create({
      data: {
        id: PRODUCT_ID,
        tenantId: SOURCE_TENANT_ID,
        name: 'Front Brake Shoe Set',
        partNumber: 'BRK-SH-001',
        brand: 'Hero Genuine',
        category: 'Brakes',
        hsnCode: '8714',
        gstRateBp: 1800,
        unit: 'set',
        purchasePrice: 12000n, // 120 INR
        salePrice: 25000n, // 250 INR
        mrp: 30000n, // 300 INR
        reorderLevel: 10,
        compatibilities: {
          create: {
            bikeModelId: BIKE_MODEL_ID,
          },
        },
      },
    });

    await prisma.stockMovement.create({
      data: {
        id: MOVEMENT_OPENING_ID,
        tenantId: SOURCE_TENANT_ID,
        productId: PRODUCT_ID,
        qty: 50,
        reason: StockReason.OPENING,
        unitCost: 12000n,
      },
    });

    await prisma.customer.create({
      data: {
        id: CUSTOMER_ID,
        tenantId: SOURCE_TENANT_ID,
        name: 'Sharma Two Wheeler Garage',
        shopName: 'Sharma Garage',
        phone: '9822001122',
        customerType: CustomerType.GARAGE,
        creditLimit: 5000000n, // 50,000 INR
        paymentTermsDays: 15,
        status: CreditStatus.GREEN,
      },
    });

    // Invoice 1: Non-GST Bill (2 items, 250 each = 500 total, 50 discount, grand total = 450, 200 paid now, 250 balance)
    await prisma.invoice.create({
      data: {
        id: INVOICE_1_ID,
        tenantId: SOURCE_TENANT_ID,
        customerId: CUSTOMER_ID,
        invoiceType: InvoiceType.RETAIL_BILL,
        number: 'INV/2026-27/00014',
        seriesCode: 'INV',
        fy: '2026-27',
        status: InvoiceStatus.PARTIALLY_PAID,
        subtotal: 50000n,
        discountTotal: 5000n,
        taxableValue: 45000n,
        grandTotal: 45000n,
        paidNow: 20000n,
        amountPaid: 30000n, // 200 paidNow + 100 payment allocation
        balanceDue: 15000n,
        idempotencyKey: 'idemp-synth-inv-014',
        items: {
          create: {
            id: ITEM_1_ID,
            productId: PRODUCT_ID,
            description: 'Front Brake Shoe Set',
            hsnCode: '8714',
            qty: 2,
            rate: 25000n,
            discount: 5000n,
            taxableValue: 45000n,
            gstRateBp: 0,
            taxAmount: 0n,
            lineTotal: 45000n,
          },
        },
      },
    });

    await prisma.stockMovement.create({
      data: {
        id: MOVEMENT_SALE_1_ID,
        tenantId: SOURCE_TENANT_ID,
        productId: PRODUCT_ID,
        qty: -2,
        reason: StockReason.SALE,
        refType: 'INVOICE',
        refId: INVOICE_1_ID,
      },
    });

    // Invoice 2: Cancelled Bill
    await prisma.invoice.create({
      data: {
        id: INVOICE_2_CANCELLED_ID,
        tenantId: SOURCE_TENANT_ID,
        customerId: CUSTOMER_ID,
        invoiceType: InvoiceType.RETAIL_BILL,
        number: 'INV/2026-27/00015',
        seriesCode: 'INV',
        fy: '2026-27',
        status: InvoiceStatus.CANCELLED,
        cancelReason: 'Customer returned damaged goods',
        subtotal: 25000n,
        grandTotal: 25000n,
        balanceDue: 0n,
        items: {
          create: {
            id: ITEM_2_ID,
            productId: PRODUCT_ID,
            description: 'Front Brake Shoe Set',
            qty: 1,
            rate: 25000n,
            discount: 0n,
            taxableValue: 25000n,
            gstRateBp: 0,
            taxAmount: 0n,
            lineTotal: 25000n,
          },
        },
        events: {
          create: {
            id: EVENT_CANCEL_ID,
            event: 'CANCELLED',
            meta: { reason: 'Customer returned damaged goods' },
          },
        },
      },
    });

    await prisma.stockMovement.create({
      data: {
        id: MOVEMENT_CANCEL_REV_ID,
        tenantId: SOURCE_TENANT_ID,
        productId: PRODUCT_ID,
        qty: 0, // cancelled netted out
        reason: StockReason.RETURN_IN,
        refType: 'INVOICE',
        refId: INVOICE_2_CANCELLED_ID,
      },
    });

    // Payment: Cash receipt of 100 INR (10000 paise) allocated to Invoice 1
    await prisma.payment.create({
      data: {
        id: PAYMENT_ID,
        tenantId: SOURCE_TENANT_ID,
        customerId: CUSTOMER_ID,
        amount: 10000n,
        mode: PaymentMode.CASH,
        reference: 'RCPT-001',
        status: PaymentStatus.CLEARED,
        allocations: {
          create: {
            id: ALLOCATION_ID,
            invoiceId: INVOICE_1_ID,
            amount: 10000n,
            strategy: 'MANUAL',
          },
        },
      },
    });

    // Khata Ledger: Debit 45000, Credit 20000, Credit 10000 -> Net balance 15000
    await prisma.ledgerEntry.createMany({
      data: [
        {
          id: LEDGER_1_DEBIT_ID,
          tenantId: SOURCE_TENANT_ID,
          customerId: CUSTOMER_ID,
          entryType: LedgerEntryType.INVOICE,
          refId: INVOICE_1_ID,
          debit: 45000n,
          credit: 0n,
          narration: 'Invoice #INV/2026-27/00014',
        },
        {
          id: LEDGER_2_CREDIT_ID,
          tenantId: SOURCE_TENANT_ID,
          customerId: CUSTOMER_ID,
          entryType: LedgerEntryType.PAYMENT,
          debit: 0n,
          credit: 20000n,
          narration: 'Cash Payment on Invoice #INV/2026-27/00014',
        },
        {
          id: LEDGER_3_CREDIT_ID,
          tenantId: SOURCE_TENANT_ID,
          customerId: CUSTOMER_ID,
          entryType: LedgerEntryType.PAYMENT,
          refId: PAYMENT_ID,
          debit: 0n,
          credit: 10000n,
          narration: 'Cash Receipt RCPT-001',
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (dbAvailable) {
      await cleanupTestData();
    }
  }, 60000);

  it('exports, restores into disposable target tenant, and reconciles financial & inventory balances', async () => {
    if (!dbAvailable) {
      console.warn('Skipping integration test: PostgreSQL not available');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Export Backup from Synthetic Source Tenant
    // ─────────────────────────────────────────────────────────────────────────
    vi.mocked(authModule.getAuthenticatedUser).mockResolvedValue(SOURCE_OWNER);
    const exportReq = createReq('http://localhost/api/v1/backup', 'GET');
    const exportRes = await getBackup(exportReq);
    expect(exportRes.status).toBe(200);

    const exportBody = await exportRes.json();
    expect(exportBody.success).toBe(true);
    const backupSnapshot = exportBody.backup;

    expect(backupSnapshot.version).toBe('1.1.0');
    expect(backupSnapshot.data.invoices.length).toBe(2);
    expect(backupSnapshot.data.payments.length).toBe(1);
    expect(backupSnapshot.data.customers.length).toBe(1);
    expect(backupSnapshot.data.products.length).toBe(1);
    expect(backupSnapshot.data.stockMovements.length).toBe(3);
    expect(backupSnapshot.data.ledgerEntries.length).toBe(3);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Initialize Clean Target Synthetic Tenant
    // ─────────────────────────────────────────────────────────────────────────
    await prisma.tenant.create({
      data: {
        id: TARGET_TENANT_ID,
        name: 'Target Recovery Dealership',
      },
    });

    await prisma.user.create({
      data: {
        id: TARGET_OWNER.id,
        tenantId: TARGET_TENANT_ID,
        name: TARGET_OWNER.name,
        phone: TARGET_OWNER.phone,
        role: Role.OWNER,
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Test Cross-Tenant Safety & Clean Disposable DB Restore
    // ─────────────────────────────────────────────────────────────────────────
    vi.mocked(authModule.getAuthenticatedUser).mockResolvedValue(TARGET_OWNER);

    // 3a. Attempting to restore while SOURCE_TENANT_ID still exists in DB must be rejected with 409
    const collReq = createReq('http://localhost/api/v1/backup', 'POST', { backup: backupSnapshot });
    const collRes = await restoreBackup(collReq);
    expect(collRes.status).toBe(409);
    const collJson = await collRes.json();
    expect(collJson.error).toMatch(/cross-tenant collision/i);

    // 3b. Wipe source tenant to simulate a clean disposable database environment
    await prisma.$transaction([
      prisma.stockMovement.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.ledgerEntry.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.invoiceEvent.deleteMany({ where: { invoice: { tenantId: SOURCE_TENANT_ID } } }),
      prisma.paymentAllocation.deleteMany({ where: { payment: { tenantId: SOURCE_TENANT_ID } } }),
      prisma.payment.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: SOURCE_TENANT_ID } } }),
      prisma.invoice.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.invoiceSeries.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.productCompatibility.deleteMany({ where: { product: { tenantId: SOURCE_TENANT_ID } } }),
      prisma.product.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.bikeModel.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.customer.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.user.deleteMany({ where: { tenantId: SOURCE_TENANT_ID } }),
      prisma.tenant.deleteMany({ where: { id: SOURCE_TENANT_ID } }),
    ]);

    // 3c. Restore snapshot into the clean disposable environment
    const restoreReq = createReq('http://localhost/api/v1/backup', 'POST', { backup: backupSnapshot });
    const restoreRes = await restoreBackup(restoreReq);
    expect(restoreRes.status).toBe(200);

    const restoreBody = await restoreRes.json();
    expect(restoreBody.success).toBe(true);
    expect(restoreBody.restoredStats.invoices).toBe(2);
    expect(restoreBody.restoredStats.payments).toBe(1);
    expect(restoreBody.restoredStats.products).toBe(1);
    expect(restoreBody.restoredStats.customers).toBe(1);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Full Reconciliation Verification in PostgreSQL
    // ─────────────────────────────────────────────────────────────────────────

    // 4.1 Invoices & Financial Totals
    const restoredInvoices = await prisma.invoice.findMany({
      where: { tenantId: TARGET_TENANT_ID },
      include: { items: true, events: true },
      orderBy: { number: 'asc' },
    });
    expect(restoredInvoices.length).toBe(2);

    const inv1 = restoredInvoices.find((i) => i.number === 'INV/2026-27/00014');
    expect(inv1).toBeDefined();
    expect(inv1?.grandTotal).toBe(45000n);
    expect(inv1?.paidNow).toBe(20000n);
    expect(inv1?.amountPaid).toBe(30000n);
    expect(inv1?.balanceDue).toBe(15000n);
    expect(inv1?.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(inv1?.items.length).toBe(1);
    expect(inv1?.items[0].lineTotal).toBe(45000n);

    const inv2 = restoredInvoices.find((i) => i.number === 'INV/2026-27/00015');
    expect(inv2).toBeDefined();
    expect(inv2?.status).toBe(InvoiceStatus.CANCELLED);
    expect(inv2?.cancelReason).toBe('Customer returned damaged goods');
    expect(inv2?.events.length).toBeGreaterThanOrEqual(1);

    // 4.2 Payments & Payment Allocations
    const restoredPayments = await prisma.payment.findMany({
      where: { tenantId: TARGET_TENANT_ID },
      include: { allocations: true },
    });
    expect(restoredPayments.length).toBe(1);
    expect(restoredPayments[0].amount).toBe(10000n);
    expect(restoredPayments[0].allocations.length).toBe(1);
    expect(restoredPayments[0].allocations[0].amount).toBe(10000n);
    expect(restoredPayments[0].allocations[0].invoiceId).toBe(INVOICE_1_ID);

    // 4.3 Khata Ledger Balance & Double-Entry Integrity
    const restoredLedger = await prisma.ledgerEntry.findMany({
      where: { tenantId: TARGET_TENANT_ID },
    });
    expect(restoredLedger.length).toBe(3);

    const totalDebits = restoredLedger.reduce((sum, l) => sum + l.debit, 0n);
    const totalCredits = restoredLedger.reduce((sum, l) => sum + l.credit, 0n);
    const netKhataOutstanding = totalDebits - totalCredits;

    expect(totalDebits).toBe(45000n);
    expect(totalCredits).toBe(30000n);
    expect(netKhataOutstanding).toBe(15000n); // exactly 150 INR outstanding!

    // 4.4 Stock Movement & Derived Inventory
    const restoredMovements = await prisma.stockMovement.findMany({
      where: { tenantId: TARGET_TENANT_ID },
    });
    expect(restoredMovements.length).toBe(3);
    const derivedStock = restoredMovements.reduce((sum, m) => sum + m.qty, 0);
    expect(derivedStock).toBe(48); // 50 opening - 2 sale = 48!

    // 4.5 Invoice Numbering Continuity
    const restoredSeries = await prisma.invoiceSeries.findUnique({
      where: {
        tenantId_seriesCode_fy: {
          tenantId: TARGET_TENANT_ID,
          seriesCode: 'INV',
          fy: '2026-27',
        },
      },
    });
    expect(restoredSeries).toBeDefined();
    expect(restoredSeries?.lastNumber).toBe(15);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: Test Repeated Restore Idempotence
    // ─────────────────────────────────────────────────────────────────────────
    const repeatedRestoreReq = createReq('http://localhost/api/v1/backup', 'POST', { backup: backupSnapshot });
    const repeatedRestoreRes = await restoreBackup(repeatedRestoreReq);
    expect(repeatedRestoreRes.status).toBe(200);

    const invoiceCountAfterRepeat = await prisma.invoice.count({ where: { tenantId: TARGET_TENANT_ID } });
    const paymentCountAfterRepeat = await prisma.payment.count({ where: { tenantId: TARGET_TENANT_ID } });
    const ledgerCountAfterRepeat = await prisma.ledgerEntry.count({ where: { tenantId: TARGET_TENANT_ID } });
    const stockCountAfterRepeat = await prisma.stockMovement.count({ where: { tenantId: TARGET_TENANT_ID } });

    // Ensure ZERO duplication occurs on repeated restore
    expect(invoiceCountAfterRepeat).toBe(2);
    expect(paymentCountAfterRepeat).toBe(1);
    expect(ledgerCountAfterRepeat).toBe(3);
    expect(stockCountAfterRepeat).toBe(3);
  });
});
