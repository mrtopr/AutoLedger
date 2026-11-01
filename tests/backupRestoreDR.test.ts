import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as authModule from '@/server/lib/auth';
import * as prismaModule from '@/server/lib/prisma';
import { GET as getBackup, POST as restoreBackup } from '@/app/api/v1/backup/route';

describe('FIX 10 — Backup, Restore & Disaster Recovery Unit Tests', () => {
  const TENANT_A = '11111111-1111-4000-8000-000000000001';
  const TENANT_B = '22222222-2222-4000-8000-000000000002';

  const OWNER_USER = {
    id: 'user-owner-1',
    tenantId: TENANT_A,
    name: 'Dealership Owner',
    phone: '9876543210',
    email: 'owner@test.com',
    role: 'OWNER' as const,
    tenant: { id: TENANT_A, name: 'Dealership A' } as any,
  };

  const STAFF_USER = {
    id: 'user-staff-1',
    tenantId: TENANT_A,
    name: 'Counter Staff',
    phone: '9876543211',
    email: 'staff@test.com',
    role: 'COUNTER_STAFF' as const,
    tenant: { id: TENANT_A, name: 'Dealership A' } as any,
  };

  function createReq(url: string, method: string, body?: any): NextRequest {
    return new NextRequest(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Authentication & Role-Based Authorization', () => {
    it('rejects unauthenticated backup requests with 401', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(null);
      const req = createReq('http://localhost/api/v1/backup', 'GET');
      const res = await getBackup(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/unauthorized/i);
    });

    it('rejects non-OWNER users from exporting backups with 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_USER);
      const req = createReq('http://localhost/api/v1/backup', 'GET');
      const res = await getBackup(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/forbidden/i);
    });

    it('rejects non-OWNER users from restoring backups with 403', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(STAFF_USER);
      const req = createReq('http://localhost/api/v1/backup', 'POST', { backup: { data: {} } });
      const res = await restoreBackup(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/forbidden/i);
    });
  });

  describe('2. Backup Export Snapshot & Security', () => {
    it('never exports user passwords or totp secrets in backup payload', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_USER);
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
      vi.spyOn(prismaModule.prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-backup-01' } as any);

      const fakeTx = {
        tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT_A, name: 'Honda Showroom' }) },
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'u1', tenantId: TENANT_A, name: 'Owner', phone: '9876543210', email: 'owner@honda.com', role: 'OWNER', isActive: true },
          ]),
        },
        invoiceSeries: { findMany: vi.fn().mockResolvedValue([]) },
        bikeModel: { findMany: vi.fn().mockResolvedValue([]) },
        supplier: { findMany: vi.fn().mockResolvedValue([]) },
        product: { findMany: vi.fn().mockResolvedValue([]) },
        stockMovement: { findMany: vi.fn().mockResolvedValue([]) },
        customer: { findMany: vi.fn().mockResolvedValue([]) },
        invoice: { findMany: vi.fn().mockResolvedValue([]) },
        payment: { findMany: vi.fn().mockResolvedValue([]) },
        paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
        ledgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
        invoiceEvent: { findMany: vi.fn().mockResolvedValue([]) },
        creditNote: { findMany: vi.fn().mockResolvedValue([]) },
        account: { findMany: vi.fn().mockResolvedValue([]) },
        gLEntry: { findMany: vi.fn().mockResolvedValue([]) },
        journalVoucher: { findMany: vi.fn().mockResolvedValue([]) },
        debitNote: { findMany: vi.fn().mockResolvedValue([]) },
        purchaseOrder: { findMany: vi.fn().mockResolvedValue([]) },
        goodsReceipt: { findMany: vi.fn().mockResolvedValue([]) },
      };

      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (cb: any) => cb(fakeTx));

      const req = createReq('http://localhost/api/v1/backup', 'GET');
      const res = await getBackup(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.backup.version).toBe('1.1.0');
      expect(json.backup.data.users[0]).not.toHaveProperty('password');
      expect(json.backup.data.users[0]).not.toHaveProperty('totpSecret');
      expect(res.headers.get('content-disposition')).toContain('tradeledger-backup');
    });
  });

  describe('3. Restore Payload Validation & Cross-Tenant Safety', () => {
    it('rejects malformed payloads missing data property with 400', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_USER);
      const req = createReq('http://localhost/api/v1/backup', 'POST', { version: '1.1.0' });
      const res = await restoreBackup(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/missing data payload/i);
    });

    it('rejects unsupported backup versions with 400', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_USER);
      const req = createReq('http://localhost/api/v1/backup', 'POST', {
        version: '99.0.0',
        data: {},
      });
      const res = await restoreBackup(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/unsupported backup version/i);
    });

    it('rejects restore payload if customer ID belongs to a different tenant in DB (409 collision)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_USER);
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
      vi.spyOn(prismaModule.prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-backup-01' } as any);

      const foreignCustId = '22222222-2222-4000-8000-000000000009';
      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue({
        id: foreignCustId,
        tenantId: TENANT_B,
      } as any);

      const req = createReq('http://localhost/api/v1/backup', 'POST', {
        version: '1.1.0',
        data: {
          customers: [{ id: foreignCustId, name: 'Attacker Customer' }],
        },
      });

      const res = await restoreBackup(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/cross-tenant collision/i);
    });

    it('rejects restore payload if invoice references non-existent customer (broken FK)', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_USER);
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
      vi.spyOn(prismaModule.prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-backup-01' } as any);

      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prismaModule.prisma.invoice, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prismaModule.prisma.product, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prismaModule.prisma.payment, 'findFirst').mockResolvedValue(null);

      const missingCustId = '11111111-1111-4000-8000-000000000099';
      const req = createReq('http://localhost/api/v1/backup', 'POST', {
        version: '1.1.0',
        data: {
          customers: [],
          invoices: [
            {
              id: '11111111-1111-4000-8000-000000000050',
              customerId: missingCustId,
              invoiceNumber: 'INV/2026-27/00001',
              grandTotalPaise: '10000',
            },
          ],
        },
      });

      const res = await restoreBackup(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/referential integrity broken/i);
    });

    it('rolls back completely if a database error occurs during restore transaction', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(OWNER_USER);
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
      vi.spyOn(prismaModule.prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-backup-01' } as any);
      vi.spyOn(prismaModule, 'getStorageMode').mockReturnValue('POSTGRES');
      vi.spyOn(prismaModule.prisma.customer, 'findFirst').mockResolvedValue(null);

      vi.spyOn(prismaModule.prisma, '$transaction').mockRejectedValue(
        new Error('Simulated database deadlock or disk write failure')
      );

      const req = createReq('http://localhost/api/v1/backup', 'POST', {
        version: '1.1.0',
        data: {
          tenants: [{ id: TENANT_A, name: 'Showroom' }],
        },
      });

      const res = await restoreBackup(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toMatch(/safely rolled back/i);
    });
  });
});
