import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/dashboard/route';
import * as prismaModule from '@/server/lib/prisma';
import * as authModule from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';

describe('FIX 14 — Dashboard Metric Integrity & Storage Fallback Regression Tests', () => {
  const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
  const TENANT_B = 'b0000000-0000-4000-8000-000000000002';
  const USER_STAFF = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    // Reset localStore
    const rawData = (localStore as any).data;
    if (rawData) {
      rawData.invoices = [];
      rawData.payments = [];
      rawData.customers = [];
      rawData.products = [];
      rawData.stockMovements = [];
      rawData.ledgerEntries = [];
    }

    vi.spyOn(authModule, 'getAuthenticatedUser').mockResolvedValue({
      id: USER_STAFF,
      email: 'staff@dealer.com',
      name: 'Counter Staff',
      role: 'STAFF',
      tenantId: TENANT_A,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aggregates real cash and UPI payments without synthetic 30/70 split in localStore mode', async () => {
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);

    // Seed customer
    localStore.upsertCustomer('cust-1', {
      id: 'cust-1',
      tenantId: TENANT_A,
      name: 'Ramesh Garage',
      creditLimitPaise: '1000000',
      balancePaise: '0',
    });

    // Seed today invoice: grand total ₹10,000 (1000000 paise)
    const todayStr = new Date().toISOString();
    localStore.createInvoice({
      tenantId: TENANT_A,
      customerId: 'cust-1',
      invoiceNumber: 'TL-2026-00001',
      status: 'PAID',
      grandTotalPaise: '1000000',
      paidNowPaise: '1000000',
      creditBalancePaise: '0',
      createdAt: todayStr,
      items: [],
    });

    // Seed specific payment modes: ₹8,000 via CASH, ₹2,000 via UPI (80/20 split, NOT 30/70)
    localStore.createPayment({
      tenantId: TENANT_A,
      customerId: 'cust-1',
      amountPaise: '800000',
      mode: 'CASH',
      referenceNumber: 'REF-CASH-1',
      createdAt: todayStr,
    });
    localStore.createPayment({
      tenantId: TENANT_A,
      customerId: 'cust-1',
      amountPaise: '200000',
      mode: 'UPI',
      referenceNumber: 'REF-UPI-1',
      createdAt: todayStr,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/dashboard');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.metrics.todaySalesPaise).toBe('1000000');

    // Verify exact cash and UPI totals (800000 cash, 200000 upi), proving the 30/70 fake split was eliminated
    expect(body.metrics.cashCollectedPaise).toBe('800000');
    expect(body.metrics.upiCollectedPaise).toBe('200000');
    expect(body.metrics.collectedTodayPaise).toBe('1000000');
  });

  it('does NOT silently fall back to localStore desktop data when PostgreSQL returns 0 sales for a cloud tenant', async () => {
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

    // Seed localStore with data from a different tenant or local session
    localStore.createInvoice({
      tenantId: TENANT_A,
      customerId: 'local-cust',
      invoiceNumber: 'LOCAL-001',
      status: 'PAID',
      grandTotalPaise: '500000',
      paidNowPaise: '500000',
      creditBalancePaise: '0',
      createdAt: new Date().toISOString(),
      items: [],
    });

    // Mock prisma queries to return 0 sales today for TENANT_A
    vi.spyOn(prismaModule.prisma.invoice, 'findMany').mockResolvedValue([]);
    vi.spyOn(prismaModule.prisma.payment, 'findMany').mockResolvedValue([]);
    vi.spyOn(prismaModule.prisma.customer, 'findMany').mockResolvedValue([]);
    vi.spyOn(prismaModule.prisma.customer, 'count').mockResolvedValue(0);
    vi.spyOn(prismaModule.prisma.product, 'findMany').mockResolvedValue([]);
    vi.spyOn(prismaModule.prisma.product, 'count').mockResolvedValue(0);
    vi.spyOn(prismaModule.prisma.stockMovement, 'findMany').mockResolvedValue([]);
    vi.spyOn(prismaModule.prisma.ledgerEntry, 'findMany').mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/v1/dashboard');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    // Must return 0 sales from PostgreSQL, NOT 500000 from localStore!
    expect(body.metrics.todaySalesPaise).toBe('0');
    expect(body.recentTransactions).toEqual([]);
  });
});
