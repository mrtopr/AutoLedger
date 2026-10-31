import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }
    const targetTenantId = authUser.tenantId;
    const { searchParams } = new URL(req.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 1. Check for existing saved settlement on this date
    const savedSettlement = localStore.getCashSettlementByDate(targetDate, targetTenantId);

    // 2. Fetch invoices for this date from localStore (and DB if available)
    let allInvoices: any[] = localStore.getInvoices(targetTenantId) || [];
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const dbInvoices = await prisma.invoice.findMany({
          where: { tenantId: targetTenantId, status: { notIn: ['CANCELLED', 'DRAFT'] } },
          include: { customer: true, items: true },
          orderBy: { createdAt: 'desc' },
        });
        if (dbInvoices.length > 0) {
          allInvoices = dbInvoices.map((inv: any) => ({
            id: inv.id,
            tenantId: inv.tenantId || targetTenantId,
            invoiceNumber: inv.number,
            customerId: inv.customerId,
            customerName: inv.customer?.name || inv.customer?.shopName || 'Walk-in Retail',
            customerShop: inv.customer?.shopName || 'Walk-in Retail',
            customerPhone: inv.customer?.phone || '',
            status: inv.status,
            grandTotalPaise: inv.grandTotal.toString(),
            paidNowPaise: (inv.paidNow || 0n).toString(),
            creditBalancePaise: (inv.balanceDue || 0n).toString(),
            items: inv.items || [],
            createdAt: inv.createdAt ? inv.createdAt.toISOString() : new Date().toISOString(),
          }));
        }
      } catch (e) {
        // Fallback to localStore
      }
    }

    // Filter active invoices matching target date (strictly excluding CANCELLED and DRAFT)
    let cancelledCount = 0;
    const dayInvoices = allInvoices.filter((inv) => {
      const invDateStr = inv.createdAt ? inv.createdAt.split('T')[0] : '';
      if (invDateStr === targetDate && inv.status === 'CANCELLED') {
        cancelledCount++;
      }
      if (inv.status === 'CANCELLED' || inv.status === 'DRAFT') return false;
      return invDateStr === targetDate;
    });

    // 3. Fetch payments matching target date
    const allPayments = localStore.getPayments(targetTenantId) || [];
    const dayPayments = allPayments.filter((p) => {
      const pDateStr = p.createdAt ? p.createdAt.split('T')[0] : '';
      return pDateStr === targetDate;
    });

    // 4. Calculate day aggregates
    let cashCollectedPaise = 0n;
    let upiCollectedPaise = 0n;
    let bankCollectedPaise = 0n;

    for (const p of dayPayments) {
      const amt = BigInt(p.amountPaise || '0');
      if (p.mode === 'CASH') {
        cashCollectedPaise += amt;
      } else if (p.mode === 'UPI') {
        upiCollectedPaise += amt;
      } else if (p.mode === 'BANK') {
        bankCollectedPaise += amt;
      }
    }

    // If dayPayments didn't capture all paidNow on dayInvoices, cross-reference invoice paidNow
    let invoiceGrossSalesPaise = 0n;
    let invoiceKhataPaise = 0n;
    for (const inv of dayInvoices) {
      invoiceGrossSalesPaise += BigInt(inv.grandTotalPaise || '0');
      invoiceKhataPaise += BigInt(inv.creditBalancePaise || '0');
    }

    // Determine Opening Float:
    // If not saved, look up latest settlement before this date to find retainedFloat
    let openingFloatPaise = '0';
    if (savedSettlement) {
      openingFloatPaise = savedSettlement.openingFloatPaise;
    } else {
      const allSettlements = localStore.getCashSettlements(targetTenantId) || [];
      const pastSettlements = allSettlements
        .filter((s) => s.date < targetDate)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (pastSettlements.length > 0 && pastSettlements[0].retainedFloatPaise) {
        openingFloatPaise = pastSettlements[0].retainedFloatPaise;
      } else {
        openingFloatPaise = '200000'; // Default opening till float ₹2,000.00
      }
    }

    const summary = {
      openingFloatPaise,
      cashCollectedPaise: cashCollectedPaise.toString(),
      upiCollectedPaise: upiCollectedPaise.toString(),
      bankCollectedPaise: bankCollectedPaise.toString(),
      totalInvoicesCount: dayInvoices.length,
      grossSalesPaise: invoiceGrossSalesPaise.toString(),
      totalSalesPaise: invoiceGrossSalesPaise.toString(),
      cancelledCount,
      khataGivenPaise: invoiceKhataPaise.toString(),
      cashExpensesPaise: savedSettlement?.cashExpensesPaise || '0',
    };

    return NextResponse.json({
      success: true,
      date: targetDate,
      savedSettlement,
      summary,
      invoices: dayInvoices,
      payments: dayPayments,
    });
  } catch (error: any) {
    console.error('Error fetching settlement report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate settlement report' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }
    const targetTenantId = authUser.tenantId;
    const body = await req.json();

    const {
      date,
      openingFloatPaise = '0',
      cashSalesPaise = '0',
      cashReceiptsPaise = '0',
      cashExpensesPaise = '0',
      expectedCashPaise = '0',
      denominations = {},
      countedCashPaise = '0',
      differencePaise = '0',
      retainedFloatPaise = '0',
      withdrawnPaise = '0',
      upiTotalPaise = '0',
      bankTotalPaise = '0',
      upiVerified = false,
      notes = '',
      status = 'BALANCED',
    } = body;

    if (!date) {
      return NextResponse.json({ success: false, error: 'Date is required for day-end settlement' }, { status: 400 });
    }

    const saved = localStore.saveCashSettlement({
      tenantId: targetTenantId,
      date,
      openingFloatPaise: String(openingFloatPaise),
      cashSalesPaise: String(cashSalesPaise),
      cashReceiptsPaise: String(cashReceiptsPaise),
      cashExpensesPaise: String(cashExpensesPaise),
      expectedCashPaise: String(expectedCashPaise),
      denominations: denominations || {},
      countedCashPaise: String(countedCashPaise),
      differencePaise: String(differencePaise),
      retainedFloatPaise: String(retainedFloatPaise),
      withdrawnPaise: String(withdrawnPaise),
      upiTotalPaise: String(upiTotalPaise),
      bankTotalPaise: String(bankTotalPaise),
      upiVerified: Boolean(upiVerified),
      notes: notes || undefined,
      status: status || 'BALANCED',
      closedByUserId: authUser?.id || undefined,
      closedByName: authUser?.name || 'Counter Cashier',
    });

    return NextResponse.json({
      success: true,
      message: 'Day-End Till Settlement saved successfully',
      settlement: saved,
    });
  } catch (error: any) {
    console.error('Error saving settlement:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save settlement' },
      { status: 500 }
    );
  }
}
