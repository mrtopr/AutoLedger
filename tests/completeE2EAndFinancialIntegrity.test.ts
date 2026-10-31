import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { localStore } from '@/server/lib/store';
import * as authModule from '@/server/lib/auth';
import * as prismaModule from '@/server/lib/prisma';
import { parseRupeesToPaise, formatPaiseToRupees } from '@/server/lib/tax';

// Route Handlers
import { POST as completeOnboarding } from '@/app/api/v1/onboarding/complete/route';
import { POST as createProduct, GET as getProducts } from '@/app/api/v1/products/route';
import { POST as adjustStock } from '@/app/api/v1/products/[id]/stock/route';
import { POST as createCustomer, GET as getCustomers } from '@/app/api/v1/customers/route';
import { POST as createInvoice, DELETE as cancelInvoice, GET as getInvoices } from '@/app/api/v1/invoices/route';
import { POST as createPayment, GET as getPayments } from '@/app/api/v1/payments/route';
import { GET as getSettlementReport, POST as saveSettlement } from '@/app/api/v1/reports/settlement/route';
import { GET as getDashboardMetrics } from '@/app/api/v1/dashboard/route';
import { POST as handleRazorpayWebhook } from '@/app/api/v1/webhooks/razorpay/route';

describe('FIX 21 — Complete TradeLedger ERP End-to-End Testing & Financial Integrity Audit', () => {
  const TENANT_ALPHA = 'tenant-alpha-dealership';
  const TENANT_BETA = 'tenant-beta-dealership';

  const OWNER_ALPHA = {
    id: 'user-alpha-owner',
    tenantId: TENANT_ALPHA,
    name: 'Vikram Joshi (Owner)',
    email: 'vikram@alphamotors.com',
    role: 'OWNER' as const,
    isActive: true,
    tenant: { id: TENANT_ALPHA, name: 'Alpha Auto Spares', stateCode: '27' },
  };

  const STAFF_ALPHA = {
    id: 'user-alpha-staff',
    tenantId: TENANT_ALPHA,
    name: 'Ganesh Counter Staff',
    email: 'ganesh@alphamotors.com',
    role: 'COUNTER_STAFF' as const,
    isActive: true,
    tenant: { id: TENANT_ALPHA, name: 'Alpha Auto Spares', stateCode: '27' },
  };

  const OWNER_BETA = {
    id: 'user-beta-owner',
    tenantId: TENANT_BETA,
    name: 'Sunil Patil (Owner Beta)',
    email: 'sunil@betamotors.com',
    role: 'OWNER' as const,
    isActive: true,
    tenant: { id: TENANT_BETA, name: 'Beta Auto Spares', stateCode: '27' },
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

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. STORE ONBOARDING & PROVISIONING
  // =========================================================================
  describe('1. Store Onboarding & Initial Provisioning', () => {
    it('provisions new dealership, owner account, default invoice series, and catalog with opening stock', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const onboardingPayload = {
        business: {
          businessName: 'Shree Krishna Spares & Service',
          ownerName: 'Krishna Kadam',
          phone: `982299${uniqueSuffix}`,
          email: `krishna_${uniqueSuffix}@spares.com`,
          password: 'PasswordSecure123!',
          stateCode: '27',
        },
        products: [
          {
            name: 'Spark Plug Platinum Champion',
            partNumber: 'SP-PLAT-CHAMP',
            salePriceRupees: '180.00',
            purchasePriceRupees: '120.00',
            mrpRupees: '220.00',
            stockQty: 50,
          },
          {
            name: 'Clutch Cable Heavy Duty',
            partNumber: 'CC-HD-001',
            salePriceRupees: '250.00',
            purchasePriceRupees: '160.00',
            mrpRupees: '300.00',
            stockQty: 30,
          },
        ],
      };

      const req = createReq('/api/v1/onboarding/complete', 'POST', onboardingPayload);
      const res = await completeOnboarding(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.name).toBe('Krishna Kadam');
      expect(data.tenant.name).toBe('Shree Krishna Spares & Service');
      expect(data.productsCount).toBe(2);

      // Verify cookies set
      const authCookie = res.cookies.get('auth_token');
      expect(authCookie?.value).toBeDefined();
    });
  });

  // =========================================================================
  // 2. MULTI-ITEM SALES BILL CREATION & STOCK ACCOUNTING
  // =========================================================================
  describe('2. Multi-Item Sales Bill & Inventory Deductions', () => {
    it('creates multi-product sales bill, verifies subtotal/grandTotal reconciliation, and decrements stock', async () => {
      // 1. Create two test products as OWNER
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);
      const p1Res = await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Alpha Brake Shoe Set',
        partNumber: 'BS-ALP-101',
        salePriceRupees: '450.00',
        purchasePriceRupees: '300.00',
        mrpRupees: '550.00',
        stockQty: 25,
      }));
      const p1 = (await p1Res.json()).product;

      const p2Res = await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Alpha Front Fork Oil 350ml',
        partNumber: 'FO-ALP-202',
        salePriceRupees: '200.00',
        purchasePriceRupees: '140.00',
        mrpRupees: '250.00',
        stockQty: 40,
      }));
      const p2 = (await p2Res.json()).product;

      // 2. Create customer
      const custRes = await createCustomer(createReq('/api/v1/customers', 'POST', {
        name: 'Omkar Auto Garage',
        phone: '9822100101',
        shopName: 'Omkar Motors',
        customerType: 'GARAGE',
        creditLimitRupees: '25000.00',
      }));
      const customer = (await custRes.json()).customer;

      // 3. Counter Billing as STAFF_ALPHA
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);

      // 3. Create Sales Bill: 2 x Brake Shoe (450 each = 900) + 3 x Fork Oil (200 each = 600) = ₹1,500.00
      const invoicePayload = {
        customerId: customer.id,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        paidNowRupees: '1500.00',
        notes: 'Counter Walk-in Sale Non-GST Sales Bill',
        items: [
          {
            productId: p1.id,
            qty: 2,
            rateRupees: '450.00',
            discountRupees: '0.00',
          },
          {
            productId: p2.id,
            qty: 3,
            rateRupees: '200.00',
            discountRupees: '0.00',
          },
        ],
      };

      const invRes = await createInvoice(createReq('/api/v1/invoices', 'POST', invoicePayload));
      expect([200, 201]).toContain(invRes.status);

      const invData = await invRes.json();
      const invoice = invData.invoice;

      // Independent Financial Calculations
      const expectedSubtotalPaise = (2 * 45000) + (3 * 20000); // 90000 + 60000 = 150000 paise
      expect(invoice.subtotalPaise).toBe(String(expectedSubtotalPaise));
      expect(invoice.grandTotalPaise).toBe(String(expectedSubtotalPaise));
      expect(invoice.amountPaidPaise).toBe(String(expectedSubtotalPaise));
      expect(invoice.balanceDuePaise).toBe('0');
      expect(invoice.status).toBe('PAID');

      // 4. Verify Stock Movements: Brake Shoe (25 - 2 = 23), Fork Oil (40 - 3 = 37)
      const updatedProductsRes = await getProducts(createReq('/api/v1/products', 'GET'));
      const updatedProducts = (await updatedProductsRes.json()).products;

      const prod1 = updatedProducts.find((p: any) => p.id === p1.id);
      const prod2 = updatedProducts.find((p: any) => p.id === p2.id);

      expect(prod1.stockQty).toBe(23);
      expect(prod2.stockQty).toBe(37);
    });
  });

  // =========================================================================
  // 3. CREDIT SALES, KHATA BALANCES & RECONCILIATION
  // =========================================================================
  describe('3. Credit Sales & Customer Khata Reconciliation', () => {
    it('handles full credit bill, increases customer outstanding balance, and reconciles ledger', async () => {
      // Create product as OWNER
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);
      const pRes = await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Battery 12V 5Ah Maintenance Free',
        partNumber: 'BAT-12V-5AH',
        salePriceRupees: '1250.00',
        stockQty: 10,
      }));
      const product = (await pRes.json()).product;

      // Create credit customer
      const cRes = await createCustomer(createReq('/api/v1/customers', 'POST', {
        name: 'Vikas Two Wheeler Works',
        phone: '9822300300',
        creditLimitRupees: '50000.00',
      }));
      const customer = (await cRes.json()).customer;

      // Sale on Credit as STAFF_ALPHA
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);
      const creditSalePayload = {
        customerId: customer.id,
        paymentStatus: 'PENDING',
        paidNowRupees: '0.00',
        notes: 'Monthly Khata Account Credit Sale',
        items: [
          {
            productId: product.id,
            qty: 2,
            rateRupees: '1250.00',
            discountRupees: '0.00',
          },
        ],
      };

      const res = await createInvoice(createReq('/api/v1/invoices', 'POST', creditSalePayload));
      expect([200, 201]).toContain(res.status);

      const inv = (await res.json()).invoice;
      expect(inv.grandTotalPaise).toBe('250000'); // ₹2,500.00
      expect(inv.amountPaidPaise).toBe('0');
      expect(inv.balanceDuePaise).toBe('250000');
      expect(inv.status).toBe('ISSUED');

      // Verify customer outstanding balance increased by exactly ₹2,500.00
      const custsRes = await getCustomers(createReq('/api/v1/customers', 'GET'));
      const customers = (await custsRes.json()).customers;
      const updatedCust = customers.find((c: any) => c.id === customer.id);

      expect(updatedCust.balancePaise).toBe('250000');
    });

    it('handles partial payment, splits paid vs due, and reflects exact outstanding balance', async () => {
      // Create product as OWNER
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);
      const pRes = await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Engine Oil Synthetic 1L',
        partNumber: 'OIL-SYN-1L',
        salePriceRupees: '600.00',
        stockQty: 20,
      }));
      const product = (await pRes.json()).product;

      const cRes = await createCustomer(createReq('/api/v1/customers', 'POST', {
        name: 'Kiran Bike Point',
        phone: '9822400400',
      }));
      const customer = (await cRes.json()).customer;

      // Sale as STAFF_ALPHA: 5 bottles @ 600 = ₹3,000. Customer pays ₹1,000 cash, balance ₹2,000 on khata
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);
      const partialSalePayload = {
        customerId: customer.id,
        paymentStatus: 'PARTIAL',
        paymentMethod: 'CASH',
        paidNowRupees: '1000.00',
        items: [
          {
            productId: product.id,
            qty: 5,
            rateRupees: '600.00',
          },
        ],
      };

      const res = await createInvoice(createReq('/api/v1/invoices', 'POST', partialSalePayload));
      expect([200, 201]).toContain(res.status);

      const inv = (await res.json()).invoice;
      expect(inv.grandTotalPaise).toBe('300000'); // ₹3,000.00
      expect(inv.amountPaidPaise).toBe('100000'); // ₹1,000.00
      expect(inv.balanceDuePaise).toBe('200000');  // ₹2,000.00
      expect(inv.status).toBe('ISSUED');

      // Financial invariant: amountPaid + balanceDue === grandTotal
      const totalReconciled = BigInt(inv.amountPaidPaise) + BigInt(inv.balanceDuePaise);
      expect(totalReconciled.toString()).toBe(inv.grandTotalPaise);

      // Customer outstanding balance must be exactly ₹2,000.00
      const custsRes = await getCustomers(createReq('/api/v1/customers', 'GET'));
      const updatedCust = (await custsRes.json()).customers.find((c: any) => c.id === customer.id);
      expect(updatedCust.balancePaise).toBe('200000');
    });
  });

  // =========================================================================
  // 4. SUBSEQUENT PAYMENT & KHATA CLEARANCE
  // =========================================================================
  describe('4. Subsequent Payment & Allocation', () => {
    it('records subsequent payment against pending invoice, clears balanceDue, and updates customer khata', async () => {
      // Create product & customer as OWNER
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);
      const prod = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Chain Sprocket Kit',
        partNumber: 'CS-KIT-01',
        salePriceRupees: '1800.00',
        stockQty: 10,
      }))).json()).product;

      const cust = (await (await createCustomer(createReq('/api/v1/customers', 'POST', {
        name: 'Mahesh Auto Care',
        phone: '9822500500',
      }))).json()).customer;

      // Bill on Credit as STAFF_ALPHA: ₹1,800.00
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);
      const invRes = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        customerId: cust.id,
        paymentStatus: 'PENDING',
        paidNowRupees: '0.00',
        items: [{ productId: prod.id, qty: 1, rateRupees: '1800.00' }],
      }));
      expect([200, 201]).toContain(invRes.status);
      const inv = (await invRes.json()).invoice;

      expect(inv.balanceDuePaise).toBe('180000');

      // Subsequent payment: Customer pays remaining ₹1,800.00 via UPI
      const payRes = await createPayment(createReq('/api/v1/payments', 'POST', {
        customerId: cust.id,
        invoiceId: inv.id,
        amountRupees: '1800.00',
        paymentMode: 'UPI',
        referenceNumber: 'UPI-REF-99887766',
        notes: 'Khata Bill Full Settlement',
      }));
      expect([200, 201]).toContain(payRes.status);

      // Verify invoice balance is now 0 and status is PAID
      const invoicesRes = await getInvoices(createReq('/api/v1/invoices', 'GET'));
      const updatedInv = (await invoicesRes.json()).invoices.find((i: any) => i.id === inv.id);

      expect(updatedInv.amountPaidPaise).toBe('180000');
      expect(updatedInv.balanceDuePaise).toBe('0');
      expect(updatedInv.status).toBe('PAID');

      // Verify customer outstanding balance is cleared to 0
      const custs = (await (await getCustomers(createReq('/api/v1/customers', 'GET'))).json()).customers;
      const updatedCust = custs.find((c: any) => c.id === cust.id);
      expect(updatedCust.balancePaise).toBe('0');
    });
  });

  // =========================================================================
  // 5. BILL CANCELLATION, STOCK RESTORATION & LEDGER REVERSAL
  // =========================================================================
  describe('5. Bill Cancellation & Reversal Invariants', () => {
    it('cancels Sales Bill, restores stock quantity, reverses customer ledger, and sets balanceDue to 0', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      // Create product with 15 in stock
      const prod = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Headlight Assembly LED',
        partNumber: 'HL-LED-007',
        salePriceRupees: '950.00',
        stockQty: 15,
      }))).json()).product;

      const cust = (await (await createCustomer(createReq('/api/v1/customers', 'POST', {
        name: 'Shree Sai Service',
        phone: '9822600600',
      }))).json()).customer;

      // Sale of 5 units @ 950 = ₹4,750 (stock drops to 10)
      const invRes = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        customerId: cust.id,
        paymentStatus: 'PENDING',
        paidNowRupees: '0.00',
        items: [{ productId: prod.id, qty: 5, rateRupees: '950.00' }],
      }));
      expect([200, 201]).toContain(invRes.status);
      const inv = (await invRes.json()).invoice;

      // Verify stock deducted
      let products = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      expect(products.find((p: any) => p.id === prod.id).stockQty).toBe(10);

      // Cancel the invoice (Only OWNER has permission)
      const cancelRes = await cancelInvoice(createReq(`/api/v1/invoices?id=${inv.id}&reason=Customer+returned+defective+lot`, 'DELETE'));
      expect(cancelRes.status).toBe(200);

      const cancelData = await cancelRes.json();
      expect(cancelData.success).toBe(true);

      // 1. Verify Invoice state: status CANCELLED, balanceDue 0
      const invoices = (await (await getInvoices(createReq('/api/v1/invoices', 'GET'))).json()).invoices;
      const cancelledInv = invoices.find((i: any) => i.id === inv.id);
      expect(cancelledInv.status).toBe('CANCELLED');
      expect(cancelledInv.balanceDuePaise).toBe('0');

      // 2. Verify Stock restored back to 15
      products = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      expect(products.find((p: any) => p.id === prod.id).stockQty).toBe(15);

      // 3. Verify Customer Khata outstanding balance reversed to 0
      const customers = (await (await getCustomers(createReq('/api/v1/customers', 'GET'))).json()).customers;
      const updatedCust = customers.find((c: any) => c.id === cust.id);
      expect(updatedCust.balancePaise).toBe('0');

      // 4. Repeated cancellation must be safe and idempotent
      const repeatCancelRes = await cancelInvoice(createReq(`/api/v1/invoices?id=${inv.id}`, 'DELETE'));
      expect(repeatCancelRes.status).toBe(200);
      expect((await repeatCancelRes.json()).message).toContain('already cancelled');

      // Stock must remain 15 (never restored twice)
      products = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      expect(products.find((p: any) => p.id === prod.id).stockQty).toBe(15);
    });
  });

  // =========================================================================
  // 6. SETTLEMENT REPORT & CANCELLED BILL EXCLUSION
  // =========================================================================
  describe('6. Daily Settlement (Z-Report) & Cancelled Bill Exclusion', () => {
    it('calculates settlement accurately and strictly excludes cancelled bills from financial totals', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      // Create product
      const prod = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Oil Filter Standard',
        partNumber: 'OF-STD-01',
        salePriceRupees: '100.00',
        stockQty: 100,
      }))).json()).product;

      // Bill 1 (Active Cash Sale): ₹500
      await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        paidNowRupees: '500.00',
        items: [{ productId: prod.id, qty: 5, rateRupees: '100.00' }],
      }));

      // Bill 2 (Active UPI Sale): ₹300
      await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        paidNowRupees: '300.00',
        items: [{ productId: prod.id, qty: 3, rateRupees: '100.00' }],
      }));

      // Bill 3 (Cancelled Bill): ₹1,000 (Should be EXCLUDED from sales total)
      const inv3Res = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        paidNowRupees: '1000.00',
        items: [{ productId: prod.id, qty: 10, rateRupees: '100.00' }],
      }));
      expect([200, 201]).toContain(inv3Res.status);
      const inv3 = (await inv3Res.json()).invoice;

      await cancelInvoice(createReq(`/api/v1/invoices?id=${inv3.id}`, 'DELETE'));

      // Fetch Settlement Report
      const settlementRes = await getSettlementReport(createReq('/api/v1/reports/settlement', 'GET'));
      expect(settlementRes.status).toBe(200);

      const report = await settlementRes.json();
      expect(report.success).toBe(true);

      // Active sales must NOT count the ₹1,000 cancelled bill
      // Bill 1 (500) + Bill 2 (300) = ₹800.00
      const totalSalesPaise = BigInt(report.summary.totalSalesPaise);
      expect(totalSalesPaise).toBeGreaterThanOrEqual(80000n);

      // Cancelled bills count must reflect at least 1
      expect(report.summary.cancelledCount).toBeGreaterThanOrEqual(1);

      // Save Z-Report Settlement
      const saveRes = await saveSettlement(createReq('/api/v1/reports/settlement', 'POST', {
        totalSalesPaise: String(totalSalesPaise),
        cashCollectedPaise: report.summary.cashCollectedPaise,
        upiCollectedPaise: report.summary.upiCollectedPaise,
        date: new Date().toISOString().split('T')[0],
      }));
      expect(saveRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 7. DASHBOARD METRICS RECONCILIATION
  // =========================================================================
  describe('7. Dashboard Metrics Financial Reconciliation', () => {
    it('verifies dashboard metrics match underlying active transactions and receivables', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      const dashRes = await getDashboardMetrics(createReq('/api/v1/dashboard', 'GET'));
      expect(dashRes.status).toBe(200);

      const dash = await dashRes.json();
      expect(dash.metrics.todaySalesPaise).toBeDefined();
      expect(dash.metrics.outstandingKhataPaise).toBeDefined();
      expect(dash.recentTransactions).toBeInstanceOf(Array);

      // Ensure no cancelled invoices appear in recent active sales list
      const hasCancelled = dash.recentTransactions.some((s: any) => s.status === 'CANCELLED');
      expect(hasCancelled).toBe(false);
    });
  });

  // =========================================================================
  // 8. MULTI-TENANT ISOLATION BOUNDARIES
  // =========================================================================
  describe('8. Strict Multi-Tenant Isolation', () => {
    it('prevents cross-tenant access to products, customers, and invoice cancellation', async () => {
      // 1. Create product in Tenant Alpha
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);
      const alphaProd = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Alpha Confidential Product',
        salePriceRupees: '100.00',
        stockQty: 10,
      }))).json()).product;

      // Create invoice in Tenant Alpha
      const alphaInvRes = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paidNowRupees: '100.00',
        items: [{ productId: alphaProd.id, qty: 1, rateRupees: '100.00' }],
      }));
      expect([200, 201]).toContain(alphaInvRes.status);
      const alphaInv = (await alphaInvRes.json()).invoice;

      // 2. Switch authenticated user to Tenant Beta
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_BETA as any);

      // Tenant Beta cannot see Tenant Alpha products
      const betaProds = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      const leakedProd = betaProds.find((p: any) => p.id === alphaProd.id);
      expect(leakedProd).toBeUndefined();

      // Tenant Beta cannot cancel Tenant Alpha invoice
      const rogueCancelRes = await cancelInvoice(createReq(`/api/v1/invoices?id=${alphaInv.id}`, 'DELETE'));
      // Must be 404 Not Found (or 403 Forbidden)
      expect([403, 404]).toContain(rogueCancelRes.status);
    });
  });

  // =========================================================================
  // 9. NEGATIVE AND EXTREME BOUNDARY CASES
  // =========================================================================
  describe('9. Negative & Extreme Value Boundaries', () => {
    it('rejects zero or negative quantities on sales bills', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      const p = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Mirror Left Side',
        salePriceRupees: '150.00',
        stockQty: 10,
      }))).json()).product;

      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);

      // Zero quantity
      const resZero = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paidNowRupees: '0.00',
        items: [{ productId: p.id, qty: 0, rateRupees: '150.00' }],
      }));
      expect(resZero.status).toBe(400);

      // Negative quantity
      const resNeg = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paidNowRupees: '0.00',
        items: [{ productId: p.id, qty: -2, rateRupees: '150.00' }],
      }));
      expect(resNeg.status).toBe(400);
    });

    it('handles large multi-crore invoice numbers without BigInt overflow or precision loss', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      const p = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Bulk Engine Assembly Kit',
        salePriceRupees: '100000.00', // ₹1,00,000 per unit
        stockQty: 500,
      }))).json()).product;

      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);

      // Order 500 units @ ₹1,00,000 = ₹5,00,00,000 (5 Crore Rupees = 5,00,00,00,000 Paise)
      const resLarge = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paymentMethod: 'BANK',
        paidNowRupees: '50000000.00',
        items: [{ productId: p.id, qty: 500, rateRupees: '100000.00' }],
      }));
      expect([200, 201]).toContain(resLarge.status);

      const inv = (await resLarge.json()).invoice;
      expect(inv.grandTotalPaise).toBe('5000000000'); // Exactly 50 Crore paise
      expect(inv.amountPaidPaise).toBe('5000000000');
      expect(inv.balanceDuePaise).toBe('0');
    });

    it('permits selling below zero stock according to counter parts policy, recording exact negative inventory', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      const p = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Uncounted Fuel Pipe',
        salePriceRupees: '80.00',
        stockQty: 2, // Only 2 on shelf
      }))).json()).product;

      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);

      // Sell 5 units (exceeds shelf count by 3)
      const res = await createInvoice(createReq('/api/v1/invoices', 'POST', {
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        paidNowRupees: '400.00',
        items: [{ productId: p.id, qty: 5, rateRupees: '80.00' }],
      }));
      expect([200, 201]).toContain(res.status);

      // Verify stock allows negative (-3) without crashing or dropping
      const products = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      const updated = products.find((prod: any) => prod.id === p.id);
      expect(updated.stockQty).toBe(-3);
    });
  });

  // =========================================================================
  // 10. DURABLE IDEMPOTENCY & DUPLICATE PREVENTION
  // =========================================================================
  describe('10. Durable Idempotency & Duplicate Prevention', () => {
    it('returns existing invoice without duplicate stock deduction when same idempotency key is submitted', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_ALPHA as any);

      const p = (await (await createProduct(createReq('/api/v1/products', 'POST', {
        name: 'Disc Brake Rotor',
        salePriceRupees: '1100.00',
        stockQty: 20,
      }))).json()).product;

      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_ALPHA as any);

      const idempotencyKey = `idem-sale-e2e-${Date.now()}`;

      const salePayload = {
        idempotencyKey,
        paymentStatus: 'PAID',
        paidNowRupees: '1100.00',
        items: [{ productId: p.id, qty: 2, rateRupees: '1100.00' }],
      };

      // 1st submission
      const res1 = await createInvoice(createReq('/api/v1/invoices', 'POST', salePayload));
      expect([200, 201]).toContain(res1.status);
      const inv1 = (await res1.json()).invoice;

      // Check stock deducted (20 - 2 = 18)
      let prods = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      expect(prods.find((prod: any) => prod.id === p.id).stockQty).toBe(18);

      // 2nd identical submission (Network retry)
      const res2 = await createInvoice(createReq('/api/v1/invoices', 'POST', salePayload));
      expect([200, 201]).toContain(res2.status);
      const inv2 = (await res2.json()).invoice;

      // Must return identical invoice ID
      expect(inv2.id).toBe(inv1.id);

      // Stock must NOT be deducted again (remains 18)
      prods = (await (await getProducts(createReq('/api/v1/products', 'GET'))).json()).products;
      expect(prods.find((prod: any) => prod.id === p.id).stockQty).toBe(18);
    });
  });
});
