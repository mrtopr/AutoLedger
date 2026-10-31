import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as authModule from '@/server/lib/auth';
import * as prismaModule from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

// Route handlers
import { GET as getCustomers, POST as createCustomer } from '@/app/api/v1/customers/route';
import { GET as getCustomerById, PATCH as updateCustomer, DELETE as deleteCustomer } from '@/app/api/v1/customers/[id]/route';
import { POST as addCustomerLedger } from '@/app/api/v1/customers/[id]/ledger/route';
import { POST as recordCustomerPayment } from '@/app/api/v1/customers/[id]/payments/route';
import { GET as getProducts, POST as createProduct } from '@/app/api/v1/products/route';
import { GET as getProductById, PATCH as updateProduct, DELETE as deleteProduct } from '@/app/api/v1/products/[id]/route';
import { POST as adjustStock } from '@/app/api/v1/products/[id]/stock/route';
import { POST as bulkDeleteProducts } from '@/app/api/v1/products/bulk-delete/route';
import { GET as getInvoices, POST as createInvoice } from '@/app/api/v1/invoices/route';
import { GET as getPayments, POST as createPayment } from '@/app/api/v1/payments/route';
import { GET as getSettlementReport, POST as saveSettlementReport } from '@/app/api/v1/reports/settlement/route';
import { GET as getDashboard } from '@/app/api/v1/dashboard/route';
import { GET as getNotifications } from '@/app/api/v1/notifications/route';
import { GET as getTenant, PATCH as updateTenant } from '@/app/api/v1/tenant/route';
import { GET as getStaff, POST as addStaff } from '@/app/api/v1/staff/route';
import { PATCH as updateStaff, DELETE as removeStaff } from '@/app/api/v1/staff/[id]/route';
import { GET as getBackup, POST as restoreBackup } from '@/app/api/v1/backup/route';

describe('Fix 03: Tenant Isolation & Cross-Tenant Security Audit Tests', () => {
  const TENANT_A = '11111111-1111-4000-8000-000000000001';
  const TENANT_B = '22222222-2222-4000-8000-000000000002';

  const USER_A_OWNER = {
    id: 'user-a-owner',
    tenantId: TENANT_A,
    name: 'Owner Tenant A',
    email: 'owner@tenant-a.com',
    role: 'OWNER' as const,
  };

  const USER_B_OWNER = {
    id: 'user-b-owner',
    tenantId: TENANT_B,
    name: 'Owner Tenant B',
    email: 'owner@tenant-b.com',
    role: 'OWNER' as const,
  };

  const USER_A_STAFF = {
    id: 'user-a-staff',
    tenantId: TENANT_A,
    name: 'Staff Tenant A',
    email: 'staff@tenant-a.com',
    role: 'COUNTER_STAFF' as const,
  };

  function createReq(url: string, method: string, body?: any): NextRequest {
    return new NextRequest(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeEach(() => {
    // Default to offline / localStore path for fast deterministic test execution
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. FAIL-CLOSED AUTHENTICATION & MISSING TENANT CONTEXT (HTTP 401)
  // =========================================================================
  describe('1. Fail-Closed Authentication & Missing Tenant Context', () => {
    it('rejects unauthenticated requests with 401 across all tenant-owned routes', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(null);

      // Customers
      const resCustGet = await getCustomers(createReq('http://localhost:3000/api/v1/customers', 'GET'));
      expect(resCustGet.status).toBe(401);

      const resCustPost = await createCustomer(createReq('http://localhost:3000/api/v1/customers', 'POST', { name: 'Test' }));
      expect(resCustPost.status).toBe(401);

      // Products
      const resProdGet = await getProducts(createReq('http://localhost:3000/api/v1/products', 'GET'));
      expect(resProdGet.status).toBe(401);

      const resProdPost = await createProduct(createReq('http://localhost:3000/api/v1/products', 'POST', { name: 'Part' }));
      expect(resProdPost.status).toBe(401);

      // Invoices
      const resInvGet = await getInvoices(createReq('http://localhost:3000/api/v1/invoices', 'GET'));
      expect(resInvGet.status).toBe(401);

      const resInvPost = await createInvoice(createReq('http://localhost:3000/api/v1/invoices', 'POST', { items: [] }));
      expect(resInvPost.status).toBe(401);

      // Payments
      const resPayGet = await getPayments(createReq('http://localhost:3000/api/v1/payments', 'GET'));
      expect(resPayGet.status).toBe(401);

      const resPayPost = await createPayment(createReq('http://localhost:3000/api/v1/payments', 'POST', { amountPaise: '1000' }));
      expect(resPayPost.status).toBe(401);

      // Reports & Dashboard
      const resReportGet = await getSettlementReport(createReq('http://localhost:3000/api/v1/reports/settlement', 'GET'));
      expect(resReportGet.status).toBe(401);

      const resDash = await getDashboard(createReq('http://localhost:3000/api/v1/dashboard', 'GET'));
      expect(resDash.status).toBe(401);

      // Backup & Tenant Profile
      const resBackup = await getBackup(createReq('http://localhost:3000/api/v1/backup', 'GET'));
      expect(resBackup.status).toBe(401);

      const resTenant = await getTenant(createReq('http://localhost:3000/api/v1/tenant', 'GET'));
      expect(resTenant.status).toBe(401);

      // Staff
      const resStaff = await getStaff(createReq('http://localhost:3000/api/v1/staff', 'GET'));
      expect(resStaff.status).toBe(401);
    });

    it('rejects authenticated users missing tenantId with 401', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'user-no-tenant',
        tenantId: '',
        name: 'Homeless User',
        role: 'OWNER',
      } as any);

      const resCust = await getCustomers(createReq('http://localhost:3000/api/v1/customers', 'GET'));
      expect(resCust.status).toBe(401);

      const resProd = await getProducts(createReq('http://localhost:3000/api/v1/products', 'GET'));
      expect(resProd.status).toBe(401);

      const resInv = await getInvoices(createReq('http://localhost:3000/api/v1/invoices', 'GET'));
      expect(resInv.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. FORGED TENANT IDS IN REQUEST BODY / QUERY ARE IGNORED
  // =========================================================================
  describe('2. Forged Client Tenant ID Defense', () => {
    it('ignores client-supplied tenantId in body and assigns record strictly to authenticated tenant', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      // Client attempts to create customer under TENANT_B
      const res = await createCustomer(
        createReq('http://localhost:3000/api/v1/customers', 'POST', {
          tenantId: TENANT_B, // Forged!
          name: 'Forged Garage',
          shopName: 'Forged Auto Spares',
          phone: '9988776655',
        })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.customer.tenantId).toBe(TENANT_A); // Server must enforce TENANT_A
      expect(json.customer.tenantId).not.toBe(TENANT_B);
    });

    it('ignores client-supplied tenantId when creating products', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await createProduct(
        createReq('http://localhost:3000/api/v1/products', 'POST', {
          tenantId: TENANT_B, // Forged!
          name: 'Hero Brake Shoe Forged',
          partNumber: 'BS-FORGED-01',
          purchasePricePaise: '15000',
          salePricePaise: '25000',
        })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.product.tenantId).toBe(TENANT_A);
      expect(json.product.tenantId).not.toBe(TENANT_B);
    });
  });

  // =========================================================================
  // 3. CROSS-TENANT READ & MUTATION ISOLATION (IDOR DEFENSE)
  // =========================================================================
  describe('3. Cross-Tenant IDOR & Mutation Defense', () => {
    let customerB: any;
    let productB: any;

    beforeEach(() => {
      // Seed a customer and product belonging to TENANT_B
      customerB = localStore.createCustomer({
        tenantId: TENANT_B,
        name: 'Tenant B Customer',
        shopName: 'Garage B',
        phone: '9111122222',
        address: 'B-Street',
        creditLimitPaise: '1000000',
        termsDays: 15,
        status: 'GREEN',
        customerType: 'GARAGE',
        balancePaise: '500000',
        overduePaise: '0',
      });

      productB = localStore.createProduct({
        tenantId: TENANT_B,
        name: 'Tenant B Oil Filter',
        partNumber: 'OF-TB-01',
        brand: 'Castrol',
        category: 'Lubricants',
        hsnCode: '2710',
        gstRateBp: 1800,
        unit: 'pcs',
        purchasePricePaise: '10000',
        salePricePaise: '15000',
        mrpPaise: '18000',
        stockQty: 50,
        reorderLevel: 10,
        models: ['Universal'],
      });
    });

    it('prevents Tenant A from reading Tenant B customer by ID (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await getCustomerById(
        createReq(`http://localhost:3000/api/v1/customers/${customerB.id}`, 'GET'),
        { params: { id: customerB.id } }
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.customer).toBeUndefined();
    });

    it('prevents Tenant A from modifying Tenant B customer (returns 404, no mutation)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await updateCustomer(
        createReq(`http://localhost:3000/api/v1/customers/${customerB.id}`, 'PATCH', {
          name: 'Hacked Customer Name',
        }),
        { params: { id: customerB.id } }
      );

      expect(res.status).toBe(404);

      // Verify record was untouched in store
      const unmodified = localStore.getCustomerById(customerB.id, TENANT_B);
      expect(unmodified?.name).toBe('Tenant B Customer');
    });

    it('prevents Tenant A from deleting Tenant B customer (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await deleteCustomer(
        createReq(`http://localhost:3000/api/v1/customers/${customerB.id}`, 'DELETE'),
        { params: { id: customerB.id } }
      );

      expect(res.status).toBe(404);

      const stillExists = localStore.getCustomerById(customerB.id, TENANT_B);
      expect(stillExists).toBeDefined();
    });

    it('prevents Tenant A from reading Tenant B product by ID (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await getProductById(
        createReq(`http://localhost:3000/api/v1/products/${productB.id}`, 'GET'),
        { params: { id: productB.id } }
      );

      expect(res.status).toBe(404);
    });

    it('prevents Tenant A from updating Tenant B product (returns 404, no mutation)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await updateProduct(
        createReq(`http://localhost:3000/api/v1/products/${productB.id}`, 'PATCH', {
          salePricePaise: '999999',
        }),
        { params: { id: productB.id } }
      );

      expect(res.status).toBe(404);

      const unmodified = localStore.getProductById(productB.id, TENANT_B);
      expect(unmodified?.salePricePaise).toBe('15000');
    });

    it('prevents Tenant A from deleting Tenant B product (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await deleteProduct(
        createReq(`http://localhost:3000/api/v1/products/${productB.id}`, 'DELETE'),
        { params: { id: productB.id } }
      );

      expect(res.status).toBe(404);

      const stillExists = localStore.getProductById(productB.id, TENANT_B);
      expect(stillExists).toBeDefined();
    });

    it('prevents Tenant A from adjusting stock of Tenant B product (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await adjustStock(
        createReq(`http://localhost:3000/api/v1/products/${productB.id}/stock`, 'POST', {
          qtyDelta: -20,
          reason: 'DAMAGE',
        }),
        { params: { id: productB.id } }
      );

      expect(res.status).toBe(404);

      const unmodified = localStore.getProductById(productB.id, TENANT_B);
      expect(unmodified?.stockQty).toBe(50);
    });
  });

  // =========================================================================
  // 4. RELATED RECORD OWNERSHIP MISMATCH DEFENSE
  // =========================================================================
  describe('4. Related Record Ownership Mismatch Defense', () => {
    let customerB: any;

    beforeEach(() => {
      customerB = localStore.createCustomer({
        tenantId: TENANT_B,
        name: 'Customer Belonging to Tenant B',
        shopName: 'Tenant B Workshop',
        phone: '9222233333',
        creditLimitPaise: '500000',
        termsDays: 15,
        status: 'GREEN',
        customerType: 'GARAGE',
        balancePaise: '0',
        overduePaise: '0',
      });
    });

    it('rejects invoice creation when customerId belongs to another tenant (returns 400)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await createInvoice(
        createReq('http://localhost:3000/api/v1/invoices', 'POST', {
          customerId: customerB.id, // Tenant B customer!
          paidNowPaise: '0',
          items: [
            {
              description: 'Spark Plug',
              qty: 1,
              ratePaise: '10000',
              lineTotalPaise: '10000',
            },
          ],
        })
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/customer (does not belong|not found)/i);
    });

    it('rejects payment creation when customerId belongs to another tenant (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await createPayment(
        createReq('http://localhost:3000/api/v1/payments', 'POST', {
          customerId: customerB.id, // Tenant B customer!
          amountPaise: '50000',
          mode: 'CASH',
        })
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/customer not found/i);
    });

    it('rejects adding customer ledger entry when customer belongs to another tenant (returns 404)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await addCustomerLedger(
        createReq(`http://localhost:3000/api/v1/customers/${customerB.id}/ledger`, 'POST', {
          amountPaise: '100000',
          narration: 'Cross tenant charge',
        }),
        { params: { id: customerB.id } }
      );

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. BULK EXPORT & DELETE TENANT BOUNDARIES
  // =========================================================================
  describe('5. Bulk Operations & Export Data Isolation', () => {
    beforeEach(() => {
      // Seed Tenant A and Tenant B data
      localStore.createProduct({
        tenantId: TENANT_A,
        name: 'Tenant A Headlamp',
        partNumber: 'HL-TA-01',
        hsnCode: '8714',
        gstRateBp: 1800,
        unit: 'pcs',
        purchasePricePaise: '20000',
        salePricePaise: '30000',
        mrpPaise: '35000',
        stockQty: 20,
        reorderLevel: 5,
        models: ['Hero Splendor'],
      });

      localStore.createProduct({
        tenantId: TENANT_B,
        name: 'Tenant B Carburetor',
        partNumber: 'CB-TB-01',
        hsnCode: '8714',
        gstRateBp: 1800,
        unit: 'pcs',
        purchasePricePaise: '80000',
        salePricePaise: '120000',
        mrpPaise: '140000',
        stockQty: 10,
        reorderLevel: 2,
        models: ['Bajaj Pulsar'],
      });
    });

    it('bulk delete ALL by Tenant A does not delete Tenant B products', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await bulkDeleteProducts(
        createReq('http://localhost:3000/api/v1/products/bulk-delete', 'POST', {
          action: 'ALL',
          confirmAll: true,
        })
      );

      expect(res.status).toBe(200);

      // Verify Tenant B products are still present and unaffected
      const tenantBProducts = localStore.getProducts(TENANT_B);
      expect(tenantBProducts.length).toBeGreaterThan(0);
      expect(tenantBProducts.some((p) => p.name === 'Tenant B Carburetor')).toBe(true);
    });

    it('backup export by Tenant A returns only Tenant A records with zero Tenant B data leakage', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const res = await getBackup(createReq('http://localhost:3000/api/v1/backup', 'GET'));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.backup.tenantId).toBe(TENANT_A);
      const exportedProducts = json.backup.data.products;

      // Assert no products from Tenant B are leaked in Tenant A's backup
      expect(exportedProducts.every((p: any) => p.tenantId === TENANT_A)).toBe(true);
      expect(exportedProducts.some((p: any) => p.name === 'Tenant B Carburetor')).toBe(false);
    });

    it('backup restore strictly scopes inserted entities to the authenticated tenant', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);

      const maliciousPayload = {
        data: {
          products: [
            {
              id: 'injected-product-1',
              tenantId: TENANT_B, // Maliciously attempts to inject into Tenant B
              name: 'Injected Brake Pad',
              partNumber: 'BP-INJ-01',
              salePricePaise: '50000',
            },
          ],
        },
      };

      const res = await restoreBackup(
        createReq('http://localhost:3000/api/v1/backup', 'POST', maliciousPayload)
      );

      expect(res.status).toBe(200);

      // Verify that the restored product in localStore belongs to TENANT_A, NOT TENANT_B
      const productInStore = localStore.getProductById('injected-product-1', TENANT_A);
      if (productInStore) {
        expect(productInStore.tenantId).toBe(TENANT_A);
      }
      const productInTenantB = localStore.getProductById('injected-product-1', TENANT_B);
      expect(productInTenantB).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. STAFF RBAC & TENANT ISOLATION
  // =========================================================================
  describe('6. Staff Management Isolation & RBAC', () => {
    it('restricts staff list to OWNER or MANAGER and strictly scopes to authenticated tenant', async () => {
      // Counter staff cannot view staff list
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_STAFF as any);
      const resForbidden = await getStaff(createReq('http://localhost:3000/api/v1/staff', 'GET'));
      expect(resForbidden.status).toBe(403);

      // Owner can view staff list, and it only contains Tenant A staff
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);
      const resOk = await getStaff(createReq('http://localhost:3000/api/v1/staff', 'GET'));
      expect(resOk.status).toBe(200);
      const json = await resOk.json();
      expect(json.staff.every((s: any) => s.tenantId === undefined || s.tenantId === TENANT_A)).toBe(true);
    });

    it('prevents Tenant A owner from updating or deleting Tenant B staff member (returns 404)', async () => {
      // Create a user in Tenant B
      const userB = localStore.createUser({
        tenantId: TENANT_B,
        name: 'Tenant B Staff',
        phone: '9333344444',
        role: 'COUNTER_STAFF',
        isActive: true,
      });

      // Tenant A owner tries to patch Tenant B staff
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_A_OWNER as any);
      const resPatch = await updateStaff(
        createReq(`http://localhost:3000/api/v1/staff/${userB.id}`, 'PATCH', { name: 'Compromised Name' }),
        { params: { id: userB.id } }
      );
      expect(resPatch.status).toBe(404);

      // Tenant A owner tries to delete Tenant B staff
      const resDel = await removeStaff(
        createReq(`http://localhost:3000/api/v1/staff/${userB.id}`, 'DELETE'),
        { params: { id: userB.id } }
      );
      expect(resDel.status).toBe(404);
    });
  });
});
