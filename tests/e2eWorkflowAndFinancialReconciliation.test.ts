import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { localStore } from '@/server/lib/store';
import * as authModule from '@/server/lib/auth';
import * as prismaModule from '@/server/lib/prisma';
import { signCustomerToken } from '@/server/lib/portalAuth';

import { POST as createProduct, GET as getProducts } from '@/app/api/v1/products/route';
import { POST as adjustStock } from '@/app/api/v1/products/[id]/stock/route';
import { POST as createCustomer, GET as getCustomers } from '@/app/api/v1/customers/route';
import { POST as createInvoice, DELETE as cancelInvoice, GET as getInvoices } from '@/app/api/v1/invoices/route';
import { POST as createPayment, GET as getPayments } from '@/app/api/v1/payments/route';
import { POST as createPortalOrder } from '@/app/api/v1/portal/orders/route';
import { GET as getSettlementReport, POST as saveSettlement } from '@/app/api/v1/reports/settlement/route';
import { GET as getDashboardMetrics } from '@/app/api/v1/dashboard/route';

const TENANT_E2E_A = 'tenant-e2e-dealership-a';
const TENANT_E2E_B = 'tenant-e2e-dealership-b';

const USER_OWNER_A = {
  id: 'usr-e2e-owner-a',
  tenantId: TENANT_E2E_A,
  name: 'Rajesh Owner',
  email: 'rajesh@dealership-a.com',
  role: 'OWNER' as const,
  isActive: true,
  tenant: { id: TENANT_E2E_A, name: 'Dealership A Motors', stateCode: '27' },
};

const USER_STAFF_A = {
  id: 'usr-e2e-staff-a',
  tenantId: TENANT_E2E_A,
  name: 'Suresh Staff',
  email: 'suresh@dealership-a.com',
  role: 'COUNTER_STAFF' as const,
  isActive: true,
  tenant: { id: TENANT_E2E_A, name: 'Dealership A Motors', stateCode: '27' },
};

const USER_OWNER_B = {
  id: 'usr-e2e-owner-b',
  tenantId: TENANT_E2E_B,
  name: 'Vikram Owner B',
  email: 'vikram@dealership-b.com',
  role: 'OWNER' as const,
  isActive: true,
  tenant: { id: TENANT_E2E_B, name: 'Dealership B Motors', stateCode: '27' },
};

function createReq(url: string, method: string = 'GET', body?: any, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makePortalRequest(
  url: string,
  customer: { customerId: string; phone: string; tenantId: string },
  options: { method?: string; body?: any; headers?: Record<string, string> } = {}
): NextRequest {
  const token = signCustomerToken({
    customerId: customer.customerId,
    phone: customer.phone,
    tenantId: customer.tenantId,
    role: 'CUSTOMER',
  });

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe('FIX 12 — End-to-End Business Workflow & Financial Reconciliation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);

    // Reset tenant-specific in-memory test states
    localStore.getProducts(TENANT_E2E_A).forEach((p) => localStore.deleteProduct(p.id, TENANT_E2E_A));
    localStore.getCustomers(TENANT_E2E_A).forEach((c) => localStore.deleteCustomer(c.id, TENANT_E2E_A));
    localStore.getProducts(TENANT_E2E_B).forEach((p) => localStore.deleteProduct(p.id, TENANT_E2E_B));
    localStore.getCustomers(TENANT_E2E_B).forEach((c) => localStore.deleteCustomer(c.id, TENANT_E2E_B));

    // Clear tenant-scoped transactions
    const rawData = (localStore as any).data;
    if (rawData) {
      if (Array.isArray(rawData.invoices)) {
        rawData.invoices = rawData.invoices.filter((i: any) => i.tenantId !== TENANT_E2E_A && i.tenantId !== TENANT_E2E_B);
      }
      if (Array.isArray(rawData.payments)) {
        rawData.payments = rawData.payments.filter((p: any) => p.tenantId !== TENANT_E2E_A && p.tenantId !== TENANT_E2E_B);
      }
      if (Array.isArray(rawData.ledgerEntries)) {
        rawData.ledgerEntries = rawData.ledgerEntries.filter((l: any) => l.tenantId !== TENANT_E2E_A && l.tenantId !== TENANT_E2E_B);
      }
      if (Array.isArray(rawData.cashSettlements)) {
        rawData.cashSettlements = rawData.cashSettlements.filter((s: any) => s.tenantId !== TENANT_E2E_A && s.tenantId !== TENANT_E2E_B);
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Product Lifecycle & Inventory Stock Invariants', () => {
    it('creates product and updates inventory through manual adjustments with exact stock accounting', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_OWNER_A as any);

      // Create product with opening stock = 20
      const createReqObj = createReq('http://localhost:3000/api/v1/products', 'POST', {
        name: 'Hero Splendor Brake Shoes',
        partNumber: 'BS-SPL-001',
        salePricePaise: '25000', // ₹250.00
        mrpPaise: '30000',
        purchasePricePaise: '18000',
        stockQty: 20,
        reorderLevel: 5,
      });

      const createRes = await createProduct(createReqObj);
      expect(createRes.status).toBe(201);
      const { product } = await createRes.json();
      expect(product.stockQty).toBe(20);

      // Inward adjustment: +10 units received from distributor
      const inwardReq = createReq(`http://localhost:3000/api/v1/products/${product.id}/stock`, 'POST', {
        qty: 10,
        type: 'INWARD',
        reason: 'Distributor delivery challan',
      });
      const inwardRes = await adjustStock(inwardReq, { params: { id: product.id } });
      expect(inwardRes.status).toBe(200);
      const inwardData = await inwardRes.json();
      expect(inwardData.product.stockQty).toBe(30);

      // Reconcile Inventory Invariant: Opening (20) + Inward (10) = 30
      const current = localStore.getProductById(product.id, TENANT_E2E_A);
      expect(current?.stockQty).toBe(30);
    });

    it('enforces dealership policy: selling below zero stock is permitted and tracked accurately', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_OWNER_A as any);

      // Create product with low stock = 2
      const createRes = await createProduct(
        createReq('http://localhost:3000/api/v1/products', 'POST', {
          name: 'Bajaj Pulsar Spark Plug',
          partNumber: 'SP-PUL-002',
          salePricePaise: '15000', // ₹150.00
          stockQty: 2,
        })
      );
      const { product } = await createRes.json();

      // Counter sale of 5 units (exceeds computer stock of 2)
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);
      const billRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ productId: product.id, qty: 5, ratePaise: '15000' }],
          cashPaidPaise: 75000,
        })
      );
      expect(billRes.status).toBe(201);

      // Inventory invariant: 2 - 5 = -3 (selling below zero permitted per auto parts counter sales policy)
      const updated = localStore.getProductById(product.id, TENANT_E2E_A);
      expect(updated?.stockQty).toBe(-3);
    });
  });

  describe('2. Customer Accounts, Walk-In Sales & Khata Invariants', () => {
    it('creates B2B workshop customer with credit limit and verifies walk-in sales leave ledger untouched', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_OWNER_A as any);

      // Create customer
      const custRes = await createCustomer(
        createReq('http://localhost:3000/api/v1/customers', 'POST', {
          name: 'Anil Mechanic',
          shopName: 'Anil Auto Garage',
          phone: '9822998877',
          creditLimitPaise: '5000000', // ₹50,000 credit limit
        })
      );
      expect(custRes.status).toBe(201);
      const { customer } = await custRes.json();
      expect(customer.balancePaise).toBe('0');

      // Create product
      const prodRes = await createProduct(
        createReq('http://localhost:3000/api/v1/products', 'POST', {
          name: 'Engine Oil 20W40 1L',
          salePricePaise: '35000',
          stockQty: 50,
        })
      );
      const { product } = await prodRes.json();

      // Walk-in retail counter sale (no customerId)
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);
      const walkInRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ productId: product.id, qty: 2, ratePaise: '35000' }],
          cashPaidPaise: 70000, // ₹700 full cash payment
        })
      );
      expect(walkInRes.status).toBe(201);
      const walkInData = await walkInRes.json();
      expect(walkInData.invoice.customerId).toBeFalsy();

      // Reconcile Customer Invariant: Registered customer balance remains unchanged at ₹0
      const customerAfter = localStore.getCustomerById(customer.id, TENANT_E2E_A);
      expect(customerAfter?.balancePaise).toBe('0');
      const ledger = localStore.getLedger(customer.id, TENANT_E2E_A);
      expect(ledger.length).toBe(0);
    });

    it('rejects walk-in overpayment (cannot carry unallocated credit without a registered account)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      const overpayRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Clutch Wire', qty: 1, ratePaise: '10000' }],
          cashPaidPaise: 15000, // Paid ₹150 on a ₹100 bill without customerId
        })
      );
      expect(overpayRes.status).toBe(400);
      const data = await overpayRes.json();
      expect(data.error).toContain('Walk-in cash/UPI payment cannot exceed the bill grand total');
    });
  });

  describe('3. Multi-Item Billing, Discounts & Validation Failures', () => {
    it('calculates multi-item non-GST sales bill with item discounts and exact totals', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      // 2 items:
      // Item 1: 3 x ₹200.00 = ₹600.00, discount ₹50.00 = ₹550.00
      // Item 2: 2 x ₹450.00 = ₹900.00, discount 10% (₹90.00) = ₹810.00
      // Expected Subtotal: ₹1,500.00 (150000 paise)
      // Expected Discount: ₹140.00 (14000 paise)
      // Expected Grand Total: ₹1,360.00 (136000 paise)
      const billRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [
            { name: 'Brake Cable', qty: 3, ratePaise: 20000, discountPaise: 5000 },
            { name: 'Drive Chain', qty: 2, ratePaise: 45000, discountPercent: 10 },
          ],
          cashPaidPaise: 136000,
        })
      );
      expect(billRes.status).toBe(201);
      const data = await billRes.json();

      // Financial invariant reconciliation:
      expect(data.grandTotalPaise).toBe('136000');
      expect(data.taxSummary.grandTotal).toBe('136000');
      expect(data.taxSummary.subtotal).toBe('150000');
      expect(data.taxSummary.discountTotal).toBe('14000');
      expect(data.taxSummary.totalTax).toBe('0'); // Strictly non-GST Sales Bill
    });

    it('rejects edge cases: negative quantity, fractional quantity, and excessive discounts', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      // Negative quantity
      const negQty = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Oil Filter', qty: -1, ratePaise: 10000 }],
        })
      );
      expect(negQty.status).toBe(400);

      // Fractional quantity
      const fracQty = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Oil Filter', qty: 1.5, ratePaise: 10000 }],
        })
      );
      expect(fracQty.status).toBe(400);

      // Excessive discount exceeding line gross
      const excessDisc = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Oil Filter', qty: 1, ratePaise: 10000, discountPaise: 15000 }],
        })
      );
      expect(excessDisc.status).toBe(400);
      const discData = await excessDisc.json();
      expect(discData.error).toContain('Discount cannot exceed item gross total');
    });
  });

  describe('4. Payment Methods, Split Payments, Ledger Debits & Subsequent Clearances', () => {
    it('handles partial split payment (Cash + UPI) and verifies remaining balance in customer Khata', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      // Create customer
      const cust = localStore.createCustomer({
        tenantId: TENANT_E2E_A,
        name: 'Sunil Garage',
        shopName: 'Sunil Bike Point',
        phone: '9822112233',
        customerType: 'GARAGE',
        balancePaise: '0',
        creditLimitPaise: '5000000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      // Bill for ₹2,500.00 (250000 paise)
      // Paid now: Cash ₹500.00 (50000 paise) + UPI ₹1,000.00 (100000 paise) = ₹1,500.00 paid
      // Credit balance (Khata remaining): ₹1,000.00 (100000 paise)
      const billRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          customerId: cust.id,
          items: [{ name: 'Battery 12V 4Ah', qty: 1, ratePaise: 250000 }],
          cashPaidPaise: 50000,
          upiPaidPaise: 100000,
          upiRef: 'UPI-REF-998877',
        })
      );
      expect(billRes.status).toBe(201);
      const billData = await billRes.json();
      expect(billData.invoice.creditBalancePaise).toBe('100000');

      // Reconcile Khata Financial Invariant:
      // Customer balance must be exactly ₹1,000.00 (2500 - 1500)
      const custAfterBill = localStore.getCustomerById(cust.id, TENANT_E2E_A);
      expect(custAfterBill?.balancePaise).toBe('100000');

      // Reconcile Ledger Entries posted:
      const ledger = localStore.getLedger(cust.id, TENANT_E2E_A);
      expect(ledger.length).toBe(2); // 1 DEBIT (250000) for Bill, 1 CREDIT (150000) for Counter Payment
      const debitEntry = ledger.find((e) => e.type === 'INVOICE' || BigInt(e.debitPaise) > 0n);
      const creditEntry = ledger.find((e) => e.type === 'PAYMENT' || BigInt(e.creditPaise) > 0n);
      expect(debitEntry?.debitPaise).toBe('250000');
      expect(creditEntry?.creditPaise).toBe('150000');

      // Subsequent standalone payment: customer returns 3 days later and pays remaining ₹1,000 via UPI
      const payRes = await createPayment(
        createReq('http://localhost:3000/api/v1/payments', 'POST', {
          customerId: cust.id,
          amountPaise: '100000',
          mode: 'UPI',
          referenceNumber: 'UPI-CLEARANCE-12345',
          notes: 'Clearance of Bill balance',
        })
      );
      expect(payRes.status).toBe(201);

      // Reconcile final customer Khata balance: ₹1,000 - ₹1,000 = ₹0.00
      const finalCust = localStore.getCustomerById(cust.id, TENANT_E2E_A);
      expect(finalCust?.balancePaise).toBe('0');
    });

    it('handles payment idempotency and rejects conflicting retries', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      const cust = localStore.createCustomer({
        tenantId: TENANT_E2E_A,
        name: 'Pooja Auto',
        shopName: 'Pooja Spares',
        phone: '9822334455',
        customerType: 'GARAGE',
        balancePaise: '500000', // ₹5,000 initial balance
        creditLimitPaise: '1000000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      const idempotencyKey = `pay-retry-key-${Date.now()}`;

      // First payment submission: ₹2,000
      const payRes1 = await createPayment(
        createReq('http://localhost:3000/api/v1/payments', 'POST', {
          customerId: cust.id,
          amountPaise: '200000',
          mode: 'CASH',
          idempotencyKey,
        })
      );
      expect(payRes1.status).toBe(201);
      const data1 = await payRes1.json();
      expect(data1.isDuplicate).toBeFalsy();

      // Customer balance after ₹2,000 payment: 5000 - 2000 = 3000
      const custAfter1 = localStore.getCustomerById(cust.id, TENANT_E2E_A);
      expect(custAfter1?.balancePaise).toBe('300000');

      // Duplicate payment submission with SAME idempotency key
      const payRes2 = await createPayment(
        createReq('http://localhost:3000/api/v1/payments', 'POST', {
          customerId: cust.id,
          amountPaise: '200000',
          mode: 'CASH',
          idempotencyKey,
        })
      );
      expect(payRes2.status).toBe(200);
      const data2 = await payRes2.json();
      expect(data2.isDuplicate).toBe(true);

      // Financial invariant: Customer was NOT double-credited; balance remains ₹3,000
      const custAfter2 = localStore.getCustomerById(cust.id, TENANT_E2E_A);
      expect(custAfter2?.balancePaise).toBe('300000');

      // Conflicting payment submission with same idempotency key but different amount
      const payResConflict = await createPayment(
        createReq('http://localhost:3000/api/v1/payments', 'POST', {
          customerId: cust.id,
          amountPaise: '450000', // Changed amount
          mode: 'CASH',
          idempotencyKey,
        })
      );
      expect(payResConflict.status).toBe(409);
    });
  });

  describe('5. Bill Cancellation & Financial / Stock Reversal Consequences', () => {
    it('cancels bill, restores inventory, reverses customer ledger, and remains idempotent on repeated cancellations', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      // 1. Setup product with stock = 15
      const product = localStore.createProduct({
        tenantId: TENANT_E2E_A,
        name: 'Clutch Plate Set',
        hsnCode: '8714',
        gstRateBp: 0,
        unit: 'pcs',
        purchasePricePaise: '40000',
        salePricePaise: '60000', // ₹600.00
        mrpPaise: '75000',
        stockQty: 15,
        reorderLevel: 3,
        models: ['Universal'],
      });

      // 2. Setup customer with 0 balance
      const customer = localStore.createCustomer({
        tenantId: TENANT_E2E_A,
        name: 'Bharat Motors',
        shopName: 'Bharat Workshop',
        phone: '9822445566',
        customerType: 'GARAGE',
        balancePaise: '0',
        creditLimitPaise: '5000000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      // 3. Issue sales bill: 3 clutch plates @ ₹600 = ₹1,800.00 total
      // Customer pays ₹800.00 cash; ₹1,000.00 remains on Khata
      const billRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          customerId: customer.id,
          items: [{ productId: product.id, qty: 3, ratePaise: 60000 }],
          cashPaidPaise: 80000,
        })
      );
      expect(billRes.status).toBe(201);
      const { invoice } = await billRes.json();

      // Check interim invariants:
      // Stock: 15 - 3 = 12
      expect(localStore.getProductById(product.id, TENANT_E2E_A)?.stockQty).toBe(12);
      // Customer balance: ₹1,000 (100000 paise)
      expect(localStore.getCustomerById(customer.id, TENANT_E2E_A)?.balancePaise).toBe('100000');

      // 4. Cancel bill (by OWNER)
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_OWNER_A as any);
      const cancelRes = await cancelInvoice(
        createReq(`http://localhost:3000/api/v1/invoices?id=${invoice.id}&reason=Customer+returned+unopened+part`, 'DELETE')
      );
      expect(cancelRes.status).toBe(200);

      // 5. Reconcile Stock Restoration Invariant: 12 + 3 = 15
      expect(localStore.getProductById(product.id, TENANT_E2E_A)?.stockQty).toBe(15);

      // 6. Reconcile Khata Reversal Invariant:
      // Bill was ₹1,800 total, customer had paid ₹800 counter cash.
      // Reversal credits ₹1,800.
      // Net customer balance: +1,000 - 1,800 = -800 (₹800 refundable credit balance).
      const customerAfterCancel = localStore.getCustomerById(customer.id, TENANT_E2E_A);
      expect(customerAfterCancel?.balancePaise).toBe('-80000');

      // 7. Verify Cancelled Invoice state:
      const cancelledInv = localStore.getInvoiceById(invoice.id, TENANT_E2E_A);
      expect(cancelledInv?.status).toBe('CANCELLED');
      expect(cancelledInv?.creditBalancePaise).toBe('0'); // Zero remaining balance due on cancelled bill

      // 8. Idempotent repeat cancellation: does NOT duplicate stock restoration or ledger credit
      const repeatCancelRes = await cancelInvoice(
        createReq(`http://localhost:3000/api/v1/invoices?id=${invoice.id}&reason=Accidental+repeat`, 'DELETE')
      );
      expect(repeatCancelRes.status).toBe(200);
      const repeatData = await repeatCancelRes.json();
      expect(repeatData.alreadyCancelled).toBe(true);

      // Stock remains exactly 15 (not 18)
      expect(localStore.getProductById(product.id, TENANT_E2E_A)?.stockQty).toBe(15);
      // Balance remains exactly -₹800 (not -₹2,600)
      expect(localStore.getCustomerById(customer.id, TENANT_E2E_A)?.balancePaise).toBe('-80000');
    });
  });

  describe('6. Customer Portal Requisitions vs Finalized Sales Bills', () => {
    it('creates portal requisition order in DRAFT status without deducting stock or affecting customer Khata', async () => {
      // 1. Setup product with stock = 25
      const product = localStore.createProduct({
        tenantId: TENANT_E2E_A,
        name: 'Castrol 4T Engine Oil',
        hsnCode: '2710',
        gstRateBp: 0,
        unit: 'ltr',
        purchasePricePaise: '28000',
        salePricePaise: '42000', // ₹420.00
        mrpPaise: '49000',
        stockQty: 25,
        reorderLevel: 5,
        models: ['Universal'],
      });

      // 2. Setup customer
      const customer = localStore.createCustomer({
        tenantId: TENANT_E2E_A,
        name: 'Kailash Workshop',
        shopName: 'Kailash Two Wheeler',
        phone: '9822556677',
        customerType: 'GARAGE',
        balancePaise: '0',
        creditLimitPaise: '5000000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      // 3. Customer places requisition order via Customer Portal
      const portalReq = makePortalRequest('http://localhost:3000/api/v1/portal/orders', {
        customerId: customer.id,
        phone: customer.phone,
        tenantId: TENANT_E2E_A,
      }, {
        method: 'POST',
        body: {
          items: [{ productId: product.id, name: product.name, quantity: 4, salePricePaise: '42000' }],
          notes: 'Please keep ready for pickup at 4 PM',
        },
      });

      const portalRes = await createPortalOrder(portalReq);
      expect(portalRes.status).toBe(200);
      const portalData = await portalRes.json();
      expect(portalData.success).toBe(true);
      expect(portalData.order.invoiceNumber).toContain('REQ/');

      // Invariant Check A: Draft order must NOT deduct inventory stock!
      const productAfterOrder = localStore.getProductById(product.id, TENANT_E2E_A);
      expect(productAfterOrder?.stockQty).toBe(25); // Stock remains 25

      // Invariant Check B: Draft order must NOT post to customer Khata!
      const customerAfterOrder = localStore.getCustomerById(customer.id, TENANT_E2E_A);
      expect(customerAfterOrder?.balancePaise).toBe('0'); // Khata debt remains 0

      // Invariant Check C: Invoice status must be DRAFT
      const orderInvoice = localStore.getInvoiceById(portalData.order.id, TENANT_E2E_A);
      expect(orderInvoice?.status).toBe('DRAFT');
    });
  });

  describe('7. Day-End Till Settlement & Financial Reporting Invariants', () => {
    it('reconciles day-end settlement totals and strictly excludes cancelled bills and draft requisitions', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_STAFF_A as any);

      // 1. Issue finalized cash bill for ₹500
      await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Headlight Bulb', qty: 2, ratePaise: 25000 }],
          cashPaidPaise: 50000,
        })
      );

      // 2. Issue finalized UPI bill for ₹1,200
      await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Chain Sprocket Kit', qty: 1, ratePaise: 120000 }],
          upiPaidPaise: 120000,
          upiRef: 'UPI-SETTLE-001',
        })
      );

      // 3. Issue a bill for ₹800 that is immediately CANCELLED
      const voidBillRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ name: 'Mirrors Pair', qty: 1, ratePaise: 80000 }],
          cashPaidPaise: 80000,
        })
      );
      const voidData = await voidBillRes.json();

      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_OWNER_A as any);
      await cancelInvoice(
        createReq(`http://localhost:3000/api/v1/invoices?id=${voidData.invoice.id}&reason=Voided+test`, 'DELETE')
      );

      // 4. Create a DRAFT requisition order for ₹2,000
      localStore.createInvoice({
        tenantId: TENANT_E2E_A,
        invoiceNumber: `REQ/${new Date().getFullYear()}/TEST-DRAFT`,
        status: 'DRAFT',
        grandTotalPaise: '200000',
        paidNowPaise: '0',
        creditBalancePaise: '200000',
        items: [{ name: 'Piston Kit', qty: 1, ratePaise: '200000' }],
      });

      // 5. Query Day-End Till Settlement report
      const settleReportRes = await getSettlementReport(
        createReq(`http://localhost:3000/api/v1/reports/settlement?date=${todayStr}`, 'GET')
      );
      expect(settleReportRes.status).toBe(200);
      const { summary } = await settleReportRes.json();

      // Financial Reconciliation of Day Till Invariants:
      // Gross sales must equal ONLY the 2 active finalized bills: ₹500 + ₹1,200 = ₹1,700 (170000 paise)
      // Cancelled bill (₹800) and Draft requisition (₹2,000) MUST BE EXCLUDED
      expect(summary.grossSalesPaise).toBe('170000');
      expect(summary.totalInvoicesCount).toBe(2);

      // 6. Save final day settlement
      const saveRes = await saveSettlement(
        createReq('http://localhost:3000/api/v1/reports/settlement', 'POST', {
          date: todayStr,
          openingFloatPaise: '200000', // ₹2,000 opening till float
          cashSalesPaise: '50000',     // ₹500 cash collected
          cashExpensesPaise: '10000',  // ₹100 tea / courier expense
          countedCashPaise: '240000',  // ₹2,000 + ₹500 - ₹100 = ₹2,400 counted in drawer
          retainedFloatPaise: '200000',
          withdrawnPaise: '40000',
          status: 'BALANCED',
        })
      );
      expect(saveRes.status).toBe(200);
    });
  });

  describe('8. Cross-Tenant Workflow Isolation', () => {
    it('strictly isolates products, customers, and settlement metrics between dealerships', async () => {
      // Setup Product in Dealership A
      const prodA = localStore.createProduct({
        tenantId: TENANT_E2E_A,
        name: 'Dealership A Exclusive Spare',
        hsnCode: '8714',
        gstRateBp: 0,
        unit: 'pcs',
        purchasePricePaise: '10000',
        salePricePaise: '15000',
        mrpPaise: '20000',
        stockQty: 10,
        reorderLevel: 2,
        models: ['Universal'],
      });

      // Setup Customer in Dealership A
      const custA = localStore.createCustomer({
        tenantId: TENANT_E2E_A,
        name: 'Dealership A Workshop',
        shopName: 'A Garage',
        phone: '9822000001',
        customerType: 'GARAGE',
        balancePaise: '0',
        creditLimitPaise: '5000000',
        status: 'GREEN',
        termsDays: 15,
        overduePaise: '0',
      });

      // Dealership B attempts to bill Dealership A's product
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_OWNER_B as any);
      const crossProdRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          items: [{ productId: prodA.id, qty: 1, ratePaise: 15000 }],
          cashPaidPaise: 15000,
        })
      );
      expect(crossProdRes.status).toBe(400);
      const crossProdData = await crossProdRes.json();
      expect(crossProdData.error).toContain('Product not found in your organization');

      // Dealership B attempts to bill to Dealership A's customer
      const crossCustRes = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          customerId: custA.id,
          items: [{ name: 'Local Part', qty: 1, ratePaise: 10000 }],
          cashPaidPaise: 10000,
        })
      );
      expect(crossCustRes.status).toBe(400);
      const crossCustData = await crossCustRes.json();
      expect(crossCustData.error).toContain('Customer does not belong to your organization');
    });
  });
});
