import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/invoices/route';
import * as prismaModule from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import * as authModule from '@/server/lib/auth';
import {
  getIndianFinancialYear,
  formatInvoiceNumber,
  allocateNextInvoiceNumberLocalStore,
  allocateNextInvoiceNumberPrisma,
} from '@/server/lib/invoiceNumbering';

describe('Fix 04: Safe Sequential Concurrency-Aware Invoice Numbering', () => {
  const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
  const TENANT_B = 'b0000000-0000-4000-8000-000000000002';
  const USER_STAFF = '33333333-3333-4333-8333-333333333333';
  const CUSTOMER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const CUSTOMER_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const PRODUCT_A = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  beforeEach(() => {
    // Reset local store series before each test
    const rawData = (localStore as any).data;
    if (rawData) {
      rawData.invoiceSeries = {};
      rawData.invoices = [];
      rawData.ledgerEntries = [];
      rawData.payments = [];
      rawData.paymentAllocations = [];
    }
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Indian Financial Year Boundaries (Asia/Kolkata UTC+05:30)
  // =========================================================================
  describe('1. Indian Financial Year Boundaries (Asia/Kolkata)', () => {
    it('correctly calculates FY for mid-year dates', () => {
      // 2026-10-28 is in FY 2026-27
      const date = new Date('2026-10-28T12:00:00Z');
      expect(getIndianFinancialYear(date)).toBe('2026-27');
    });

    it('correctly handles the March 31 boundary before midnight IST', () => {
      // 2026-03-31T18:29:59Z is 2026-03-31 23:59:59 IST (FY 2025-26)
      const march31ISTNight = new Date('2026-03-31T18:29:59.000Z');
      expect(getIndianFinancialYear(march31ISTNight)).toBe('2025-26');
    });

    it('correctly handles the April 1 rollover at midnight IST', () => {
      // 2026-03-31T18:30:00Z is 2026-04-01 00:00:00 IST (FY 2026-27)
      const april1ISTMidnight = new Date('2026-03-31T18:30:00.000Z');
      expect(getIndianFinancialYear(april1ISTMidnight)).toBe('2026-27');
    });

    it('correctly calculates FY across century / leap years', () => {
      // 2028-02-29 in IST -> 2027-28
      const leapDay = new Date('2028-02-29T10:00:00+05:30');
      expect(getIndianFinancialYear(leapDay)).toBe('2027-28');

      // 2028-04-01 in IST -> 2028-29
      const newFY = new Date('2028-04-01T10:00:00+05:30');
      expect(getIndianFinancialYear(newFY)).toBe('2028-29');
    });
  });

  // =========================================================================
  // 2. Sequential Number Formatting & Rollover
  // =========================================================================
  describe('2. Sequential Number Formatting & Rollover', () => {
    it('formats 5-digit padded sequence numbers properly', () => {
      expect(formatInvoiceNumber('INV/2026-27/', 1, 5)).toBe('INV/2026-27/00001');
      expect(formatInvoiceNumber('INV/2026-27/', 42, 5)).toBe('INV/2026-27/00042');
      expect(formatInvoiceNumber('INV/2026-27/', 9999, 5)).toBe('INV/2026-27/09999');
      expect(formatInvoiceNumber('INV/2026-27/', 10000, 5)).toBe('INV/2026-27/10000');
    });

    it('allocates strictly sequential numbers in localStore for the same series and FY', () => {
      const alloc1 = allocateNextInvoiceNumberLocalStore(TENANT_A, {
        seriesCode: 'INV',
        fy: '2026-27',
      });
      const alloc2 = allocateNextInvoiceNumberLocalStore(TENANT_A, {
        seriesCode: 'INV',
        fy: '2026-27',
      });
      const alloc3 = allocateNextInvoiceNumberLocalStore(TENANT_A, {
        seriesCode: 'INV',
        fy: '2026-27',
      });

      expect(alloc1.sequenceNumber).toBe(1);
      expect(alloc1.invoiceNumber).toBe('INV/2026-27/00001');

      expect(alloc2.sequenceNumber).toBe(2);
      expect(alloc2.invoiceNumber).toBe('INV/2026-27/00002');

      expect(alloc3.sequenceNumber).toBe(3);
      expect(alloc3.invoiceNumber).toBe('INV/2026-27/00003');
    });

    it('resets sequence to 00001 on new Financial Year rollover', () => {
      // FY 2026-27 has 2 invoices
      allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2026-27' });
      const last2026 = allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2026-27' });
      expect(last2026.invoiceNumber).toBe('INV/2026-27/00002');

      // Next FY 2027-28 begins fresh at 00001
      const first2027 = allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2027-28' });
      expect(first2027.sequenceNumber).toBe(1);
      expect(first2027.invoiceNumber).toBe('INV/2027-28/00001');
    });
  });

  // =========================================================================
  // 3. Multi-Tenant Isolation
  // =========================================================================
  describe('3. Multi-Tenant Counter Isolation', () => {
    it('maintains completely separate sequence series for separate tenants', () => {
      const a1 = allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2026-27' });
      const a2 = allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2026-27' });

      // Tenant B creates their first invoice
      const b1 = allocateNextInvoiceNumberLocalStore(TENANT_B, { seriesCode: 'INV', fy: '2026-27' });

      // Tenant A creates another invoice
      const a3 = allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2026-27' });

      // Tenant B creates another invoice
      const b2 = allocateNextInvoiceNumberLocalStore(TENANT_B, { seriesCode: 'INV', fy: '2026-27' });

      expect(a1.invoiceNumber).toBe('INV/2026-27/00001');
      expect(a2.invoiceNumber).toBe('INV/2026-27/00002');
      expect(a3.invoiceNumber).toBe('INV/2026-27/00003');

      // Tenant B started at 1 and was not incremented or affected by Tenant A's activity
      expect(b1.invoiceNumber).toBe('INV/2026-27/00001');
      expect(b2.invoiceNumber).toBe('INV/2026-27/00002');
    });
  });

  // =========================================================================
  // 4. Concurrency Simulation & Collision Defense
  // =========================================================================
  describe('4. Concurrency Simulation & Collision Defense', () => {
    it('guarantees unique non-colliding sequential numbers under concurrent requests in localStore', async () => {
      // Simulate 50 concurrent requests hitting the counter
      const tasks = Array.from({ length: 50 }, () =>
        Promise.resolve().then(() =>
          allocateNextInvoiceNumberLocalStore(TENANT_A, { seriesCode: 'INV', fy: '2026-27' })
        )
      );

      const results = await Promise.all(tasks);
      const generatedNumbers = results.map((r) => r.invoiceNumber);
      const uniqueNumbers = new Set(generatedNumbers);

      // All 50 must be completely distinct
      expect(uniqueNumbers.size).toBe(50);

      // Must strictly span 00001 to 00050
      for (let i = 1; i <= 50; i++) {
        const expected = `INV/2026-27/${String(i).padStart(5, '0')}`;
        expect(uniqueNumbers.has(expected)).toBe(true);
      }
    });

    it('seeds sequence from legacy existing invoices to avoid collision with pre-existing numbers', () => {
      // Simulate existing legacy invoices in store (e.g. legacy invoice with number INV/2026-27/00045)
      const rawData = (localStore as any).data;
      rawData.invoices = [
        {
          id: 'legacy-1',
          tenantId: TENANT_A,
          invoiceNumber: 'INV/2026-27/00045',
          seriesCode: 'INV',
          fy: '2026-27',
          number: 45,
          totalAmount: 10000,
          date: '2026-10-01',
          status: 'UNPAID',
        },
      ];

      // Next allocation must pick up after 45 -> 46
      const nextAlloc = allocateNextInvoiceNumberLocalStore(TENANT_A, {
        seriesCode: 'INV',
        fy: '2026-27',
      });

      expect(nextAlloc.sequenceNumber).toBe(46);
      expect(nextAlloc.invoiceNumber).toBe('INV/2026-27/00046');
    });
  });

  // =========================================================================
  // 5. PostgreSQL Atomic Concurrency Strategy
  // =========================================================================
  describe('5. PostgreSQL Atomic Concurrency Strategy', () => {
    it('executes atomic upsert query with row locking on invoice_series', async () => {
      const mockQueryRaw = vi.fn().mockResolvedValue([
        {
          last_number: 1,
          prefix: 'INV/2026-27/',
        },
      ]);

      const mockTx = {
        $queryRaw: mockQueryRaw,
        invoiceSeries: {
          upsert: vi.fn(),
        },
      } as any;

      const result = await allocateNextInvoiceNumberPrisma(mockTx, TENANT_A, {
        seriesCode: 'INV',
        fy: '2026-27',
      });

      expect(result.sequenceNumber).toBe(1);
      expect(result.invoiceNumber).toBe('INV/2026-27/00001');
      expect(mockQueryRaw).toHaveBeenCalled();

      // Check that the SQL statement executed contains atomic row update and ON CONFLICT
      const sqlQueryArg = mockQueryRaw.mock.calls[0][0];
      const sqlString = Array.isArray(sqlQueryArg)
        ? sqlQueryArg.join(' ')
        : (sqlQueryArg?.strings?.join(' ') || String(sqlQueryArg));
      expect(sqlString).toContain('INSERT INTO invoice_series');
      expect(sqlString).toContain('ON CONFLICT (tenant_id, series_code, fy)');
      expect(sqlString).toContain('DO UPDATE SET last_number = invoice_series.last_number + 1');
      expect(sqlString).toContain('RETURNING last_number');
    });

    it('falls back to prisma.invoiceSeries.upsert when raw SQL is not supported (e.g. unit mocks)', async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockRejectedValue(new Error('raw query mock failure')),
        invoiceSeries: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'series-1',
            tenantId: TENANT_A,
            seriesCode: 'INV',
            fy: '2026-27',
            lastNumber: 6,
            prefix: 'INV/2026-27/',
          }),
          upsert: vi.fn().mockResolvedValue({
            id: 'series-1',
            tenantId: TENANT_A,
            seriesCode: 'INV',
            fy: '2026-27',
            lastNumber: 7,
            prefix: 'INV/2026-27/',
          }),
        },
      } as any;

      const result = await allocateNextInvoiceNumberPrisma(mockTx, TENANT_A, {
        seriesCode: 'INV',
        fy: '2026-27',
      });

      expect(result.sequenceNumber).toBe(7);
      expect(result.invoiceNumber).toBe('INV/2026-27/00007');
      expect(mockTx.invoiceSeries.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_seriesCode_fy: {
              tenantId: TENANT_A,
              seriesCode: 'INV',
              fy: '2026-27',
            },
          },
        })
      );
    });
  });

  // =========================================================================
  // 6. Full Route API: Sequential Invoices & Tenant Scoping
  // =========================================================================
  describe('6. End-to-End POST /api/v1/invoices Sequential Generation', () => {
    function createPostRequest(body: any, token?: string): NextRequest {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (token) headers['authorization'] = `Bearer ${token}`;

      return new NextRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }

    it('creates sequential invoices with formatted numbers and sets number, seriesCode, fy', async () => {
      // Mock authenticated staff user for Tenant A
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_STAFF,
        email: 'staff@dealer.com',
        name: 'Counter Staff',
        role: 'STAFF',
        tenantId: TENANT_A,
      } as any);

      // Ensure customer exists in localStore
      localStore.upsertCustomer(CUSTOMER_A, {
        id: CUSTOMER_A,
        tenantId: TENANT_A,
        name: 'Auto Buyer',
        shopName: 'Auto Buyer Shop',
        phone: '9876543210',
        creditLimitPaise: '10000000',
        balancePaise: '0',
        status: 'GREEN',
      });

      // 1st Invoice Request
      const req1 = createPostRequest({
        customerId: CUSTOMER_A,
        type: 'TAX_INVOICE',
        items: [
          {
            description: 'Brake Disc',
            hsn: '8708',
            qty: 1,
            unitPrice: 2000,
            gstRate: 18,
          },
        ],
      });

      const res1 = await POST(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();

      expect(data1.success).toBe(true);
      expect(data1.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/00001$/);
      expect(data1.invoice.number).toBe(1);
      expect(data1.invoice.seriesCode).toBe('INV');
      expect(data1.invoice.fy).toMatch(/^\d{4}-\d{2}$/);

      // 2nd Invoice Request
      const req2 = createPostRequest({
        customerId: CUSTOMER_A,
        type: 'TAX_INVOICE',
        items: [
          {
            description: 'Engine Oil Filter',
            hsn: '8708',
            qty: 2,
            unitPrice: 500,
            gstRate: 18,
          },
        ],
      });

      const res2 = await POST(req2);
      expect(res2.status).toBe(201);
      const data2 = await res2.json();

      expect(data2.success).toBe(true);
      expect(data2.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/00002$/);
      expect(data2.invoice.number).toBe(2);
    });

    it('maintains strict tenant isolation when generating invoices via API', async () => {
      // Create invoice for Tenant A
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_STAFF,
        email: 'staffA@dealer.com',
        name: 'Staff A',
        role: 'STAFF',
        tenantId: TENANT_A,
      } as any);

      localStore.upsertCustomer(CUSTOMER_A, {
        id: CUSTOMER_A,
        tenantId: TENANT_A,
        name: 'Buyer A',
        shopName: 'Buyer A Shop',
        phone: '9876543211',
        creditLimitPaise: '10000000',
        balancePaise: '0',
        status: 'GREEN',
      });

      const reqA1 = createPostRequest({
        customerId: CUSTOMER_A,
        items: [{ description: 'Item 1', qty: 1, unitPrice: 1000, gstRate: 18 }],
      });
      const resA1 = await POST(reqA1);
      const dataA1 = await resA1.json();
      expect(dataA1.invoiceNumber).toMatch(/00001$/);

      // Switch auth context to Tenant B
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_STAFF,
        email: 'staffB@dealer.com',
        name: 'Staff B',
        role: 'STAFF',
        tenantId: TENANT_B,
      } as any);

      localStore.upsertCustomer(CUSTOMER_B, {
        id: CUSTOMER_B,
        tenantId: TENANT_B,
        name: 'Buyer B',
        shopName: 'Buyer B Shop',
        phone: '9876543212',
        creditLimitPaise: '10000000',
        balancePaise: '0',
        status: 'GREEN',
      });

      const reqB1 = createPostRequest({
        customerId: CUSTOMER_B,
        items: [{ description: 'Item 2', qty: 1, unitPrice: 1500, gstRate: 18 }],
      });
      const resB1 = await POST(reqB1);
      const dataB1 = await resB1.json();

      // Tenant B also starts at 00001
      expect(dataB1.invoiceNumber).toMatch(/00001$/);
    });
  });

  // =========================================================================
  // 7. Transaction Rollback Integrity
  // =========================================================================
  describe('7. Transaction Rollback Integrity (PostgreSQL mode)', () => {
    it('rolls back completely if an error occurs during invoice creation inside transaction', async () => {
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);
      vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
        id: USER_STAFF,
        email: 'staff@dealer.com',
        name: 'Staff',
        role: 'STAFF',
        tenantId: TENANT_A,
      } as any);

      // Mock prisma transaction to fail
      const mockPrisma = {
        customer: {
          findFirst: vi.fn().mockResolvedValue({ id: CUSTOMER_A, tenantId: TENANT_A }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          // Inside the transaction, an error occurs
          throw new Error('Database deadlocked during ledger creation');
        }),
      };
      vi.spyOn(prismaModule, 'prisma', 'get').mockReturnValue(mockPrisma as any);

      const req = new NextRequest('http://localhost:3000/api/v1/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: CUSTOMER_A,
          items: [{ description: 'Part X', qty: 1, unitPrice: 500, gstRate: 18 }],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to create invoice');
    });
  });
});
