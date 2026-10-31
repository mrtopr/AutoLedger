import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as authModule from '@/server/lib/auth';
import * as prismaModule from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { createAuditLog, sanitizeAuditData } from '@/server/lib/audit';
import { signCustomerToken, verifyCustomerToken, parseCustomerSession } from '@/server/lib/portalAuth';

// Route handlers
import { GET as getStaff, POST as addStaff } from '@/app/api/v1/staff/route';
import { PATCH as updateStaff, DELETE as removeStaff } from '@/app/api/v1/staff/[id]/route';
import { GET as getProducts, POST as createProduct } from '@/app/api/v1/products/route';
import { GET as getProductById, PATCH as updateProduct, DELETE as deleteProduct } from '@/app/api/v1/products/[id]/route';
import { POST as adjustStock } from '@/app/api/v1/products/[id]/stock/route';
import { POST as bulkDeleteProducts } from '@/app/api/v1/products/bulk-delete/route';
import { POST as bulkImportProducts } from '@/app/api/v1/products/bulk-import/route';
import { GET as getCustomers } from '@/app/api/v1/customers/route';
import { GET as getCustomerById, PATCH as updateCustomer, DELETE as deleteCustomer } from '@/app/api/v1/customers/[id]/route';
import { POST as addCustomerLedger } from '@/app/api/v1/customers/[id]/ledger/route';
import { GET as getTenant, PATCH as updateTenant } from '@/app/api/v1/tenant/route';
import { GET as getBackup, POST as restoreBackup } from '@/app/api/v1/backup/route';
import { GET as getInvoices, POST as createInvoice, DELETE as cancelInvoice } from '@/app/api/v1/invoices/route';
import { GET as getPayments, POST as createPayment } from '@/app/api/v1/payments/route';
import { GET as getPortalMe } from '@/app/api/v1/portal/me/route';
import { POST as portalPay } from '@/app/api/v1/portal/pay/route';

describe('FIX 11 — RBAC, Tenant Isolation & Audit Trail Integrity Tests', () => {
  const TENANT_ALPHA = 'aaaaaaaa-aaaa-4000-8000-000000000001';
  const TENANT_BETA  = 'bbbbbbbb-bbbb-4000-8000-000000000002';

  const USER_ALPHA_OWNER = {
    id: 'user-alpha-owner',
    tenantId: TENANT_ALPHA,
    name: 'Alpha Owner',
    phone: '9822100001',
    email: 'owner@alpha.com',
    role: 'OWNER' as const,
    isActive: true,
    tenant: { id: TENANT_ALPHA, name: 'Alpha Auto Spares', gstin: '27AAAAA0000A1Z5', stateCode: '27' },
  };

  const USER_ALPHA_MANAGER = {
    id: 'user-alpha-mgr',
    tenantId: TENANT_ALPHA,
    name: 'Alpha Manager',
    phone: '9822100002',
    email: 'manager@alpha.com',
    role: 'MANAGER' as const,
    isActive: true,
    tenant: { id: TENANT_ALPHA, name: 'Alpha Auto Spares', gstin: '27AAAAA0000A1Z5', stateCode: '27' },
  };

  const USER_ALPHA_STAFF = {
    id: 'user-alpha-staff',
    tenantId: TENANT_ALPHA,
    name: 'Alpha Staff',
    phone: '9822100003',
    email: 'staff@alpha.com',
    role: 'COUNTER_STAFF' as const,
    isActive: true,
    tenant: { id: TENANT_ALPHA, name: 'Alpha Auto Spares', gstin: '27AAAAA0000A1Z5', stateCode: '27' },
  };

  const USER_BETA_OWNER = {
    id: 'user-beta-owner',
    tenantId: TENANT_BETA,
    name: 'Beta Owner',
    phone: '9822200001',
    email: 'owner@beta.com',
    role: 'OWNER' as const,
    isActive: true,
    tenant: { id: TENANT_BETA, name: 'Beta Motors', gstin: '27BBBBB0000B1Z5', stateCode: '27' },
  };

  function createReq(url: string, method: string, body?: any, headers?: Record<string, string>): NextRequest {
    return new NextRequest(url, {
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

  // ───────────────────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & SESSION SAFETY
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Authentication & Session Safety', () => {
    it('fails closed with 401 when request is completely unauthenticated', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(null);

      const resStaff = await getStaff(createReq('http://localhost/api/v1/staff', 'GET'));
      expect(resStaff.status).toBe(401);

      const resProducts = await createProduct(createReq('http://localhost/api/v1/products', 'POST', { name: 'Part' }));
      expect(resProducts.status).toBe(401);

      const resBackup = await getBackup(createReq('http://localhost/api/v1/backup', 'GET'));
      expect(resBackup.status).toBe(401);
    });

    it('fails closed when an authenticated user has been deactivated (isActive === false)', async () => {
      // Mock db findFirst returning deactivated user
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
      vi.spyOn(prismaModule.prisma.user, 'findFirst').mockResolvedValue({
        id: 'u-inactive',
        tenantId: TENANT_ALPHA,
        name: 'Fired Staff',
        phone: '9999999999',
        email: null,
        role: 'COUNTER_STAFF',
        isActive: false, // Disabled
      } as any);

      // Verify server auth fails closed and does not return the user
      const req = createReq('http://localhost/api/v1/products', 'GET');
      const auth = await authModule.getAuthenticatedUser(req);
      expect(auth).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SERVER-SIDE RBAC LEAST-PRIVILEGE ENFORCEMENT
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Server-Side RBAC Least-Privilege Enforcement', () => {
    it('rejects COUNTER_STAFF attempting to create catalog products with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await createProduct(createReq('http://localhost/api/v1/products', 'POST', {
        name: 'Illegal Product Addition',
        salePricePaise: 50000,
      }));

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only OWNER or MANAGER can create catalog products/i);
    });

    it('rejects COUNTER_STAFF attempting to modify catalog product prices with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await updateProduct(
        createReq('http://localhost/api/v1/products/prod-1', 'PATCH', { salePricePaise: 99999 }),
        { params: { id: 'prod-1' } }
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only OWNER or MANAGER can modify catalog products/i);
    });

    it('rejects COUNTER_STAFF attempting to delete a product with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await deleteProduct(
        createReq('http://localhost/api/v1/products/prod-1', 'DELETE'),
        { params: { id: 'prod-1' } }
      );

      expect(res.status).toBe(403);
    });

    it('rejects COUNTER_STAFF attempting bulk product deletion with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await bulkDeleteProducts(createReq('http://localhost/api/v1/products/bulk-delete', 'POST', {
        action: 'SELECTED',
        productIds: ['prod-1', 'prod-2'],
      }));

      expect(res.status).toBe(403);
    });

    it('prevents MANAGER from performing a full inventory wipe (action: ALL); permits only OWNER', async () => {
      // MANAGER attempt
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_MANAGER);
      const resManager = await bulkDeleteProducts(createReq('http://localhost/api/v1/products/bulk-delete', 'POST', {
        action: 'ALL',
        confirmAll: true,
      }));
      expect(resManager.status).toBe(403);
      const mgrData = await resManager.json();
      expect(mgrData.error).toMatch(/only business OWNER can perform a full inventory wipe/i);

      // OWNER attempt
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_OWNER);
      const resOwner = await bulkDeleteProducts(createReq('http://localhost/api/v1/products/bulk-delete', 'POST', {
        action: 'ALL',
        confirmAll: true,
      }));
      expect(resOwner.status).toBe(200);
    });

    it('rejects COUNTER_STAFF attempting bulk product imports with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await bulkImportProducts(createReq('http://localhost/api/v1/products/bulk-import', 'POST', {
        items: [{ name: 'Brake Disc', salePricePaise: 120000 }],
      }));

      expect(res.status).toBe(403);
    });

    it('rejects COUNTER_STAFF attempting manual stock adjustments with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await adjustStock(
        createReq('http://localhost/api/v1/products/prod-1/stock', 'POST', { qtyDelta: 50, reason: 'ADJUSTMENT' }),
        { params: { id: 'prod-1' } }
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only OWNER or MANAGER can adjust stock/i);
    });

    it('rejects COUNTER_STAFF altering customer credit limits or status with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const resLimit = await updateCustomer(
        createReq('http://localhost/api/v1/customers/cust-1', 'PATCH', { creditLimitPaise: 9000000 }),
        { params: { id: 'cust-1' } }
      );
      expect(resLimit.status).toBe(403);

      const resStatus = await updateCustomer(
        createReq('http://localhost/api/v1/customers/cust-1', 'PATCH', { status: 'GREEN' }),
        { params: { id: 'cust-1' } }
      );
      expect(resStatus.status).toBe(403);
    });

    it('rejects COUNTER_STAFF attempting customer deletion with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await deleteCustomer(
        createReq('http://localhost/api/v1/customers/cust-1', 'DELETE'),
        { params: { id: 'cust-1' } }
      );
      expect(res.status).toBe(403);
    });

    it('rejects COUNTER_STAFF attempting manual ledger entries with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await addCustomerLedger(
        createReq('http://localhost/api/v1/customers/cust-1/ledger', 'POST', {
          type: 'DEBIT',
          amountPaise: 50000,
          narration: 'Staff manual adjustment',
        }),
        { params: { id: 'cust-1' } }
      );
      expect(res.status).toBe(403);
    });

    it('rejects COUNTER_STAFF attempting to cancel an invoice with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const res = await cancelInvoice(
        createReq('http://localhost/api/v1/invoices?id=inv-1&reason=Counter+Mistake', 'DELETE')
      );
      expect(res.status).toBe(403);
    });

    it('rejects COUNTER_STAFF attempting to access team staff management with HTTP 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_STAFF);

      const resGet = await getStaff(createReq('http://localhost/api/v1/staff', 'GET'));
      expect(resGet.status).toBe(403);

      const resPost = await addStaff(createReq('http://localhost/api/v1/staff', 'POST', {
        name: 'New Helper',
        phone: '9822199999',
      }));
      expect(resPost.status).toBe(403);
    });

    it('prevents privilege escalation: MANAGER cannot create an OWNER account', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_MANAGER);

      const res = await addStaff(createReq('http://localhost/api/v1/staff', 'POST', {
        name: 'Rogue Owner',
        phone: '9822188888',
        role: 'OWNER',
      }));

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only an OWNER can create an OWNER account/i);
    });

    it('prevents privilege escalation: MANAGER cannot promote an account to OWNER', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_MANAGER);

      const res = await updateStaff(
        createReq('http://localhost/api/v1/staff/user-1', 'PATCH', { role: 'OWNER' }),
        { params: { id: 'user-1' } }
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only an OWNER can grant the OWNER role/i);
    });

    it('prevents MANAGER from deleting staff members; only OWNER can delete', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_MANAGER);

      const res = await removeStaff(
        createReq('http://localhost/api/v1/staff/user-2', 'DELETE'),
        { params: { id: 'user-2' } }
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only the business OWNER can delete staff accounts/i);
    });

    it('prevents self-deletion by OWNER accounts', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_OWNER);

      const res = await removeStaff(
        createReq(`http://localhost/api/v1/staff/${USER_ALPHA_OWNER.id}`, 'DELETE'),
        { params: { id: USER_ALPHA_OWNER.id } }
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/cannot delete your own account/i);
    });

    it('prevents MANAGER from altering financial settlement bank accounts and UPI IDs', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_MANAGER);

      const res = await updateTenant(createReq('http://localhost/api/v1/tenant', 'PATCH', {
        upiId: 'hacked@upi',
      }));

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/only business OWNER can alter settlement bank accounts and UPI IDs/i);
    });

    it('prevents MANAGER and STAFF from accessing backup export and restore', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_MANAGER);

      const resExport = await getBackup(createReq('http://localhost/api/v1/backup', 'GET'));
      expect(resExport.status).toBe(403);

      const resRestore = await restoreBackup(createReq('http://localhost/api/v1/backup', 'POST', {}));
      expect(resRestore.status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. TENANT AND RECORD OWNERSHIP ISOLATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Tenant & Record Ownership Isolation', () => {
    it('prevents reading or mutating a product belonging to another tenant', async () => {
      // Seed a product in Tenant Beta
      localStore.createProduct({
        tenantId: TENANT_BETA,
        name: 'Beta Exclusive Fuel Pump',
        salePricePaise: '250000',
        stockQty: 10,
        reorderLevel: 2,
        models: ['Honda Activa'],
        hsnCode: '8714',
        gstRateBp: 1800,
        unit: 'pcs',
        purchasePricePaise: '200000',
        mrpPaise: '280000',
      });
      const betaProd = localStore.getProducts(TENANT_BETA).find(p => p.name === 'Beta Exclusive Fuel Pump')!;

      // User from Tenant Alpha tries to read Beta product
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_OWNER);
      const resGet = await getProductById(
        createReq(`http://localhost/api/v1/products/${betaProd.id}`, 'GET'),
        { params: { id: betaProd.id } }
      );
      expect(resGet.status).toBe(404);

      // User from Tenant Alpha tries to PATCH Beta product
      const resPatch = await updateProduct(
        createReq(`http://localhost/api/v1/products/${betaProd.id}`, 'PATCH', { salePricePaise: 100 }),
        { params: { id: betaProd.id } }
      );
      expect(resPatch.status).toBe(404);

      // User from Tenant Alpha tries to DELETE Beta product
      const resDelete = await deleteProduct(
        createReq(`http://localhost/api/v1/products/${betaProd.id}`, 'DELETE'),
        { params: { id: betaProd.id } }
      );
      expect(resDelete.status).toBe(404);
    });

    it('prevents reading or mutating a customer belonging to another tenant', async () => {
      // Seed customer in Tenant Beta
      localStore.createCustomer({
        tenantId: TENANT_BETA,
        name: 'Beta Garage Works',
        shopName: 'Beta Garage',
        phone: '9800011122',
        creditLimitPaise: '5000000',
        termsDays: 15,
        status: 'GREEN',
        customerType: 'GARAGE',
        balancePaise: '0',
        overduePaise: '0',
      });
      const betaCust = localStore.getCustomers(TENANT_BETA).find(c => c.phone === '9800011122')!;

      // User from Tenant Alpha tries to access
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_OWNER);
      const resGet = await getCustomerById(
        createReq(`http://localhost/api/v1/customers/${betaCust.id}`, 'GET'),
        { params: { id: betaCust.id } }
      );
      expect(resGet.status).toBe(404);

      const resLedger = await addCustomerLedger(
        createReq(`http://localhost/api/v1/customers/${betaCust.id}/ledger`, 'POST', {
          type: 'DEBIT',
          amountPaise: 10000,
        }),
        { params: { id: betaCust.id } }
      );
      expect(resLedger.status).toBe(404);
    });

    it('ignores request-body spoofed tenantId when creating products', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(USER_ALPHA_OWNER);

      const res = await createProduct(createReq('http://localhost/api/v1/products', 'POST', {
        tenantId: TENANT_BETA, // Attempt to spoof tenant ID into Beta
        name: 'Spoofed Spark Plug',
        salePricePaise: 15000,
      }));

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.product.tenantId).toBe(TENANT_ALPHA); // Must belong to authenticated tenant Alpha
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. CUSTOMER PORTAL AUTHENTICATION INTEGRITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Customer Portal Authentication Integrity', () => {
    it('generates cryptographically signed customer tokens and verifies valid signatures', () => {
      const payload = {
        customerId: 'cust-123',
        phone: '9822100001',
        tenantId: TENANT_ALPHA,
        role: 'CUSTOMER' as const,
      };

      const token = signCustomerToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature

      const verified = verifyCustomerToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.customerId).toBe('cust-123');
      expect(verified?.tenantId).toBe(TENANT_ALPHA);
      expect(verified?.role).toBe('CUSTOMER');
    });

    it('rejects forged customer tokens, raw base64 tokens, and tampered signatures', () => {
      // 1. Raw base64 token attempt
      const fakeBase64 = Buffer.from(JSON.stringify({
        customerId: 'cust-123',
        tenantId: TENANT_ALPHA,
        role: 'CUSTOMER',
      })).toString('base64');

      const verifiedBase64 = verifyCustomerToken(fakeBase64);
      expect(verifiedBase64).toBeNull();

      // 2. Tampered JWT signature
      const validToken = signCustomerToken({
        customerId: 'cust-123',
        phone: '9822100001',
        tenantId: TENANT_ALPHA,
        role: 'CUSTOMER',
      });
      const tampered = validToken.slice(0, -5) + 'xxxxx';
      expect(verifyCustomerToken(tampered)).toBeNull();
    });

    it('fails closed when an attacker supplies an unauthenticated x-customer-phone header injection', async () => {
      const req = createReq('http://localhost/api/v1/portal/me', 'GET', undefined, {
        'x-customer-phone': '9822100001', // Attacker attempt to bypass auth via header injection
      });

      const session = parseCustomerSession(req);
      expect(session).toBeNull();

      const res = await getPortalMe(req);
      expect(res.status).toBe(401);
    });

    it('prevents a customer from recording payment against another customer account', async () => {
      const token = signCustomerToken({
        customerId: 'customer-alpha',
        phone: '9822100001',
        tenantId: TENANT_ALPHA,
        role: 'CUSTOMER',
      });

      const req = createReq('http://localhost/api/v1/portal/pay', 'POST', {
        customerId: 'victim-customer-beta',
        amountPaise: 50000,
      }, {
        'authorization': `Bearer ${token}`,
      });

      const res = await portalPay(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/cannot record payment for another customer/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. AUDIT TRAIL INTEGRITY & DATA SANITIZATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Audit Trail Integrity & Data Sanitization', () => {
    it('creates an audit log entry for sensitive operations in localStore and PostgreSQL', async () => {
      const log = await createAuditLog({
        tenantId: TENANT_ALPHA,
        userId: USER_ALPHA_OWNER.id,
        action: 'LIMIT_CHANGED',
        entity: 'CUSTOMER',
        entityId: 'cust-456',
        before: { creditLimitPaise: '5000000' },
        after: { creditLimitPaise: '10000000' },
      });

      expect(log).not.toBeNull();
      expect(log.action).toBe('LIMIT_CHANGED');
      expect(log.entity).toBe('CUSTOMER');

      const logs = localStore.getAuditLogs(TENANT_ALPHA);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('LIMIT_CHANGED');
    });

    it('sanitizes sensitive fields (passwords, tokens, TOTP secrets) before persisting to audit logs', () => {
      const rawData = {
        name: 'Suresh Kumar',
        password: 'PlaintextSuperSecretPassword123!',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        authSecretKey: 'super-secret',
        creditLimit: 5000000n,
      };

      const sanitized = sanitizeAuditData(rawData);

      expect(sanitized.name).toBe('Suresh Kumar');
      expect(sanitized.creditLimit).toBe('5000000');
      // All sensitive fields must be scrubbed completely
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.jwtToken).toBeUndefined();
      expect(sanitized.totpSecret).toBeUndefined();
      expect(sanitized.authSecretKey).toBeUndefined();
    });

    it('re-throws when audit write fails inside a database transaction to enforce transactional coupling', async () => {
      const mockTx = {
        auditLog: {
          create: vi.fn().mockRejectedValue(new Error('Disk failure / DB down')),
        },
      };

      await expect(
        createAuditLog({
          tenantId: TENANT_ALPHA,
          userId: USER_ALPHA_OWNER.id,
          action: 'INVOICE_CREATED',
          entity: 'INVOICE',
          entityId: 'aaaaaaaa-aaaa-4000-8000-000000000099',
        }, mockTx)
      ).rejects.toThrow('Disk failure / DB down');
    });

    it('ensures audit logs cannot be modified or deleted by users (append-only integrity)', () => {
      const initialLogs = localStore.getAuditLogs(TENANT_ALPHA);
      const initialCount = initialLogs.length;

      // Ensure localStore exposes no deleteAuditLog or updateAuditLog methods
      expect((localStore as any).deleteAuditLog).toBeUndefined();
      expect((localStore as any).updateAuditLog).toBeUndefined();

      // Ensure that getAuditLogs returns an array without permitting tampering
      const logs = localStore.getAuditLogs(TENANT_ALPHA);
      expect(logs.length).toBe(initialCount);
    });
  });
});
