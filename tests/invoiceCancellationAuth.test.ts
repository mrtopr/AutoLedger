import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/v1/invoices/route';
import * as prismaModule from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import * as authModule from '@/server/lib/auth';
import { InvoiceStatus, StockReason, LedgerEntryType, CreditStatus } from '@prisma/client';

describe('Fix 02: Invoice Cancellation Server-Side Authorization & Financial Integrity', () => {
  const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
  const TENANT_B = 'b0000000-0000-4000-8000-000000000002';
  const USER_OWNER = '11111111-1111-4111-8111-111111111111';
  const USER_MANAGER = '22222222-2222-4222-8222-222222222222';
  const USER_STAFF = '33333333-3333-4333-8333-333333333333';
  const INVOICE_ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const INVOICE_ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const PRODUCT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  function createDeleteRequest(
    body: any,
    options?: { token?: string; queryParams?: Record<string, string> }
  ): NextRequest {
    let url = 'http://localhost:3000/api/v1/invoices';
    if (options?.queryParams) {
      const q = new URLSearchParams(options.queryParams);
      url += `?${q.toString()}`;
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (options?.token) {
      headers['authorization'] = `Bearer ${options.token}`;
    }

    return new NextRequest(url, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeEach(() => {
    // Default to PostgreSQL available without waiting on network
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Missing Authentication
  // =========================================================================
  describe('1. Authentication Enforcement (401)', () => {
    it('rejects unauthenticated requests with HTTP 401 when no token/cookie is present', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(null);

      const req = createDeleteRequest({ id: INVOICE_ID_A, reason: 'Accidental order' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toMatch(/Authentication required/i);
    });

    it('rejects forged/invalid token with HTTP 401', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue(null);

      const req = createDeleteRequest(
        { id: INVOICE_ID_A },
        { token: 'invalid_malformed_token_xyz' }
      );
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toMatch(/Authentication required/i);
    });
  });

  // =========================================================================
  // 2. Role-Based Authorization: COUNTER_STAFF Forbidden (403)
  // =========================================================================
  describe('2. Role-Based Authorization Enforcement (403 for COUNTER_STAFF)', () => {
    it('rejects COUNTER_STAFF with HTTP 403 Forbidden', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_STAFF,
        name: 'Staff Member',
        phone: '9876543210',
        role: 'COUNTER_STAFF',
        tenantId: TENANT_A,
      } as any);

      const req = createDeleteRequest({ id: INVOICE_ID_A, reason: 'Trying to cancel' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toMatch(/Only owners and managers are authorized/i);
    });

    it('ignores client-supplied spoofed role/tenant in body or query and strictly enforces server identity', async () => {
      // Attacker tries to send role: "OWNER" and tenantId: "TENANT_A" in request body
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_STAFF,
        name: 'Staff Member',
        phone: '9876543210',
        role: 'COUNTER_STAFF', // Server-verified identity is counter staff
        tenantId: TENANT_A,
      } as any);

      const req = createDeleteRequest({
        id: INVOICE_ID_A,
        role: 'OWNER',
        tenantId: TENANT_A,
        userId: USER_OWNER,
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toMatch(/Only owners and managers are authorized/i);
    });
  });

  // =========================================================================
  // 3. Missing Tenant Context (401)
  // =========================================================================
  describe('3. Missing Tenant Context Enforcement (401)', () => {
    it('rejects authenticated user with missing tenantId with HTTP 401 and does NOT fallback to default tenant', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_OWNER,
        name: 'Orphan User',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: null as any, // Missing tenant context
      } as any);

      const req = createDeleteRequest({ id: INVOICE_ID_A });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toMatch(/Missing tenant context/i);
    });
  });

  // =========================================================================
  // 4. Cross-Tenant Invoice Isolation (404)
  // =========================================================================
  describe('4. Cross-Tenant Invoice Isolation', () => {
    it('returns HTTP 404 when an OWNER of Tenant A attempts to cancel an invoice belonging to Tenant B', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_OWNER,
        name: 'Tenant A Owner',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: TENANT_A,
      } as any);

      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          invoice: {
            findFirst: vi.fn().mockImplementation(async ({ where }) => {
              // When queried with tenantId: TENANT_A, Tenant B's invoice is NOT found
              if (where.id === INVOICE_ID_B && where.tenantId === TENANT_A) {
                return null;
              }
              return { id: INVOICE_ID_B, tenantId: TENANT_B, status: InvoiceStatus.ISSUED };
            }),
            update: vi.fn(),
          },
          stockMovement: { create: vi.fn() },
          ledgerEntry: { create: vi.fn() },
          customer: { findUnique: vi.fn(), update: vi.fn() },
          invoiceEvent: { create: vi.fn() },
        };
        return callback(mockTx);
      });

      const req = createDeleteRequest({ id: INVOICE_ID_B, reason: 'Cross tenant attack' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toMatch(/Invoice not found in your organization/i);
    });
  });

  // =========================================================================
  // 5. Authorized Role: OWNER Allowed with Full Financial Reversal
  // =========================================================================
  describe('5. OWNER Authorization & Financial Reversal Integrity', () => {
    it('successfully cancels invoice, restores stock, credits Khata ledger, and writes audit event for OWNER', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_OWNER,
        name: 'Owner Boss',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: TENANT_A,
      } as any);

      const mockInvoice = {
        id: INVOICE_ID_A,
        number: 'INV-2026-001',
        tenantId: TENANT_A,
        status: InvoiceStatus.ISSUED,
        grandTotal: 150000n, // 1500.00 in paise
        customerId: CUSTOMER_ID,
        items: [
          {
            id: 'item-1',
            productId: PRODUCT_ID,
            qty: 5,
            rate: 30000n,
          },
        ],
      };

      const stockCreateMock = vi.fn().mockResolvedValue({ id: 'sm-1' });
      const ledgerCreateMock = vi.fn().mockResolvedValue({ id: 'le-1' });
      const invoiceUpdateMock = vi.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.CANCELLED });
      const eventCreateMock = vi.fn().mockResolvedValue({ id: 'ie-1' });
      const customerUpdateMock = vi.fn().mockResolvedValue({ id: CUSTOMER_ID, status: CreditStatus.GREEN });

      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          invoice: {
            findFirst: vi.fn().mockResolvedValue(mockInvoice),
            update: invoiceUpdateMock,
          },
          stockMovement: {
            create: stockCreateMock,
          },
          ledgerEntry: {
            create: ledgerCreateMock,
          },
          customer: {
            findUnique: vi.fn().mockResolvedValue({
              id: CUSTOMER_ID,
              creditLimit: 500000n,
              ledgerEntries: [{ debit: 150000n, credit: 150000n }],
            }),
            update: customerUpdateMock,
          },
          invoiceEvent: {
            create: eventCreateMock,
          },
        };
        return callback(mockTx);
      });

      const req = createDeleteRequest({ id: INVOICE_ID_A, reason: 'Customer returned goods' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invoiceNumber).toBe('INV-2026-001');

      // 1. Invoice marked CANCELLED
      expect(invoiceUpdateMock).toHaveBeenCalledWith({
        where: { id: INVOICE_ID_A },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelReason: 'Customer returned goods',
          balanceDue: 0n,
        },
      });

      // 2. Stock restored with RETURN_IN
      expect(stockCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          productId: PRODUCT_ID,
          qty: 5,
          reason: StockReason.RETURN_IN,
          refType: 'INVOICE_CANCEL',
          refId: INVOICE_ID_A,
          createdBy: USER_OWNER,
        }),
      });

      // 3. Khata ledger reversal with ADJUSTMENT credit
      expect(ledgerCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          customerId: CUSTOMER_ID,
          entryType: LedgerEntryType.ADJUSTMENT,
          refId: INVOICE_ID_A,
          debit: 0n,
          credit: 150000n,
          narration: expect.stringContaining('Reversal - Cancelled Invoice #INV-2026-001'),
        }),
      });

      // 4. Audit event recorded
      expect(eventCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: INVOICE_ID_A,
          event: 'CANCELLED',
          meta: expect.objectContaining({
            cancelledBy: USER_OWNER,
            cancelledByRole: 'OWNER',
            reason: 'Customer returned goods',
          }),
        }),
      });
    });
  });

  // =========================================================================
  // 6. Authorized Role: MANAGER Allowed
  // =========================================================================
  describe('6. MANAGER Authorization', () => {
    it('successfully permits MANAGER to cancel invoices', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_MANAGER,
        name: 'Store Manager',
        phone: '9876543211',
        role: 'MANAGER',
        tenantId: TENANT_A,
      } as any);

      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          invoice: {
            findFirst: vi.fn().mockResolvedValue({
              id: INVOICE_ID_A,
              number: 'INV-2026-002',
              tenantId: TENANT_A,
              status: InvoiceStatus.ISSUED,
              grandTotal: 50000n,
              items: [],
            }),
            update: vi.fn(),
          },
          stockMovement: { create: vi.fn() },
          ledgerEntry: { create: vi.fn() },
          customer: { findUnique: vi.fn(), update: vi.fn() },
          invoiceEvent: { create: vi.fn() },
        };
        return callback(mockTx);
      });

      const req = createDeleteRequest({ id: INVOICE_ID_A, reason: 'Manager override' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invoiceNumber).toBe('INV-2026-002');
    });
  });

  // =========================================================================
  // 7. Repeated Cancellation (Idempotency Guard)
  // =========================================================================
  describe('7. Idempotency & Repeated Cancellation', () => {
    it('returns HTTP 200 with alreadyCancelled: true and makes NO duplicate stock or ledger writes', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_OWNER,
        name: 'Owner Boss',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: TENANT_A,
      } as any);

      const alreadyCancelledInvoice = {
        id: INVOICE_ID_A,
        number: 'INV-2026-001',
        tenantId: TENANT_A,
        status: InvoiceStatus.CANCELLED, // ALREADY CANCELLED
        grandTotal: 150000n,
        items: [{ productId: PRODUCT_ID, qty: 5, rate: 30000n }],
      };

      const stockCreateMock = vi.fn();
      const ledgerCreateMock = vi.fn();
      const invoiceUpdateMock = vi.fn();

      vi.spyOn(prismaModule.prisma, '$transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          invoice: {
            findFirst: vi.fn().mockResolvedValue(alreadyCancelledInvoice),
            update: invoiceUpdateMock,
          },
          stockMovement: { create: stockCreateMock },
          ledgerEntry: { create: ledgerCreateMock },
          customer: { findUnique: vi.fn(), update: vi.fn() },
          invoiceEvent: { create: vi.fn() },
        };
        return callback(mockTx);
      });

      const req = createDeleteRequest({ id: INVOICE_ID_A, reason: 'Duplicate button click' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alreadyCancelled).toBe(true);
      expect(data.message).toMatch(/already cancelled/i);

      // Verify ZERO duplicate mutations occurred
      expect(invoiceUpdateMock).not.toHaveBeenCalled();
      expect(stockCreateMock).not.toHaveBeenCalled();
      expect(ledgerCreateMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 8. Transaction Failure Rollback
  // =========================================================================
  describe('8. Database Transaction Rollback Integrity', () => {
    it('returns HTTP 500 when transaction fails, preventing partial mutations', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_OWNER,
        name: 'Owner Boss',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: TENANT_A,
      } as any);

      vi.spyOn(prismaModule.prisma, '$transaction').mockRejectedValue(
        new Error('Deadlock / Connection abort')
      );

      const req = createDeleteRequest({ id: INVOICE_ID_A, reason: 'Failed attempt' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toMatch(/Database transaction failed/i);
    });
  });

  // =========================================================================
  // 9. Local Store Fallback Authorization & Tenant Isolation
  // =========================================================================
  describe('9. LocalStore Fallback Mode', () => {
    beforeEach(() => {
      // Force local store by disabling PostgreSQL
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
    });

    it('enforces COUNTER_STAFF forbidden (403) in local store mode', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'local_staff_1',
        name: 'Local Staff',
        phone: '9876543210',
        role: 'COUNTER_STAFF',
        tenantId: 'tenant_local_1',
      } as any);

      const req = createDeleteRequest({ id: 'inv_loc_1' });
      const res = await DELETE(req);

      expect(res.status).toBe(403);
    });

    it('enforces tenant isolation and returns 404 if invoice does not belong to user tenant in local store', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'local_owner_1',
        name: 'Local Owner',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: 'tenant_local_1',
      } as any);

      // Populate local store with invoice for tenant_local_2
      vi.spyOn(localStore, 'getInvoices').mockReturnValue([]);

      const req = createDeleteRequest({ id: 'inv_tenant_2' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toMatch(/Invoice not found in your organization/i);
    });

    it('idempotently handles repeated cancellation in local store', async () => {
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'local_owner_1',
        name: 'Local Owner',
        phone: '9876543210',
        role: 'OWNER',
        tenantId: 'tenant_local_1',
      } as any);

      vi.spyOn(localStore, 'getInvoices').mockReturnValue([
        {
          id: 'inv_loc_1',
          invoiceNumber: 'INV-LOC-1',
          tenantId: 'tenant_local_1',
          status: 'CANCELLED',
        } as any,
      ]);

      const cancelSpy = vi.spyOn(localStore, 'cancelInvoice');

      const req = createDeleteRequest({ id: 'inv_loc_1' });
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.alreadyCancelled).toBe(true);
      expect(cancelSpy).not.toHaveBeenCalled();
    });
  });
});
