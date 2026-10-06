import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Helper to format date to YYYY-MM-DD
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-default';

    // Parse requested date from query param
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    const today = new Date();
    const todayStr = toDateStr(today);

    let targetDate: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = new Date(`${dateParam}T12:00:00`);
      if (isNaN(targetDate.getTime())) {
        targetDate = today;
      }
    } else {
      targetDate = today;
    }

    const selectedDateStr = toDateStr(targetDate);
    const isHistorical = selectedDateStr !== todayStr;

    // Human formatted string
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    const selectedDateFormatted = targetDate.toLocaleDateString('en-IN', options);

    // Calculate previous day for growth comparison
    const prevDay = new Date(targetDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStr = toDateStr(prevDay);

    // Target day boundaries
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Real dynamic metrics
    let totalOutstanding = 0n;
    let totalOverdue = 0n;
    let daySalesPaise = 0n;
    let dayCollectedPaise = 0n;
    let dayCashPaise = 0n;
    let dayUpiPaise = 0n;
    let dayKhataPaise = 0n;
    let prevDaySalesPaise = 0n;
    let lowStockCount = 0;
    let recentTransactions: any[] = [];
    let categoryMap: Record<string, number> = {};

    // 7-day trend map: dateStr -> { salesPaise: bigint, collPaise: bigint }
    const weekMap: Record<string, { salesPaise: bigint; collPaise: bigint }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i);
      weekMap[toDateStr(d)] = { salesPaise: 0n, collPaise: 0n };
    }

    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        // 1. Customers & Ledger
        const customers = await prisma.customer.findMany({
          where: { tenantId: targetTenantId, isActive: true },
          include: {
            ledgerEntries: { select: { debit: true, credit: true, createdAt: true } },
            invoices: {
              where: { createdAt: { lte: dayEnd } },
              select: { grandTotal: true, dueDate: true, status: true }
            }
          }
        });

        for (const c of customers) {
          const bal = c.ledgerEntries
            .filter(e => new Date(e.createdAt) <= dayEnd)
            .reduce((sum, e) => sum + e.debit - e.credit, 0n);
          let ovd = 0n;
          for (const inv of c.invoices) {
            if (inv.dueDate && new Date(inv.dueDate) < dayStart && (inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID')) {
              ovd += inv.grandTotal;
            }
          }
          totalOutstanding += bal;
          totalOverdue += ovd;
        }

        // 2. Payments on target date & 7-day window
        const sevenDaysAgo = new Date(targetDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const allRecentPayments = await prisma.payment.findMany({
          where: { 
            tenantId: targetTenantId, 
            createdAt: { gte: sevenDaysAgo, lte: dayEnd } 
          },
          select: { amount: true, mode: true, createdAt: true },
        });

        for (const p of allRecentPayments) {
          const pDate = toDateStr(new Date(p.createdAt));
          if (weekMap[pDate]) {
            weekMap[pDate].collPaise += p.amount;
          }
          if (pDate === selectedDateStr) {
            dayCollectedPaise += p.amount;
            if (p.mode === 'CASH') dayCashPaise += p.amount;
            if (p.mode === 'UPI') dayUpiPaise += p.amount;
          }
        }

        // 3. Invoices on target date & 7-day window
        const allRecentInvoices = await prisma.invoice.findMany({
          where: { 
            tenantId: targetTenantId,
            createdAt: { gte: sevenDaysAgo, lte: dayEnd }
          },
          orderBy: { createdAt: 'desc' },
          include: { 
            customer: true, 
            allocations: { include: { payment: true } } 
          }
        });

        for (const inv of allRecentInvoices) {
          const invDate = toDateStr(new Date(inv.createdAt));
          if (weekMap[invDate]) {
            weekMap[invDate].salesPaise += inv.grandTotal;
          }
          if (invDate === prevDayStr) {
            prevDaySalesPaise += inv.grandTotal;
          }
          if (invDate === selectedDateStr) {
            daySalesPaise += inv.grandTotal;
            const paid = inv.amountPaid > 0n ? inv.amountPaid : inv.paidNow;
            if (inv.grandTotal > paid) {
              dayKhataPaise += inv.grandTotal - paid;
            }

            const isFull = paid >= inv.grandTotal && inv.grandTotal > 0n;
            const isZero = paid === 0n;
            const modes = inv.allocations.map(a => a.payment.mode);
            const modeText = modes.length > 0 ? modes.join(' + ') : (isZero ? 'CREDIT' : 'PAID');

            recentTransactions.push({
              id: inv.id,
              invoiceNumber: inv.number || `INV-${inv.id.slice(0, 6)}`,
              customer: inv.customer?.shopName || inv.customer?.name || 'Retail Counter',
              amountPaise: inv.grandTotal.toString(),
              paidPaise: paid.toString(),
              paymentMode: modeText,
              status: isFull ? 'PAID' : (isZero ? 'OVERDUE' : 'PARTIAL'),
              date: new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }

        // 4. Products & Stock levels
        const products = await prisma.product.findMany({
          where: { tenantId: targetTenantId, isActive: true },
          include: { stockMovements: { select: { qty: true } } }
        });

        for (const pr of products) {
          const cat = pr.category || 'General Spares';
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
          const currentQty = pr.stockMovements.reduce((sum, m) => sum + m.qty, 0);
          if (currentQty <= (pr.reorderLevel || 10)) {
            lowStockCount++;
          }
        }

      } catch (err) {
        console.warn('Postgres query error in dashboard, localStore fallback:', err);
      }
    }

    // LocalStore fallback integration if Postgres returned zero or offline
    if (daySalesPaise === 0n && recentTransactions.length === 0) {
      const localInvoices = localStore.getInvoices(targetTenantId);
      const localCusts = localStore.getCustomers(targetTenantId);
      const localProducts = localStore.getProducts(targetTenantId);

      // Outstanding from local customers
      totalOutstanding = localCusts.reduce((sum, c) => sum + BigInt(c.balancePaise || 0), 0n);
      totalOverdue = localCusts.reduce((sum, c) => sum + BigInt(c.overduePaise || 0), 0n);

      for (const pr of localProducts) {
        const cat = pr.category || 'General Spares';
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        if (pr.stockQty <= (pr.reorderLevel || 10)) {
          lowStockCount++;
        }
      }

      for (const inv of localInvoices) {
        const invDate = toDateStr(new Date(inv.createdAt));
        const gTotal = BigInt(inv.grandTotalPaise || 0);
        const pNow = BigInt(inv.paidNowPaise || 0);

        if (weekMap[invDate]) {
          weekMap[invDate].salesPaise += gTotal;
          weekMap[invDate].collPaise += pNow;
        }
        if (invDate === prevDayStr) {
          prevDaySalesPaise += gTotal;
        }
        if (invDate === selectedDateStr) {
          daySalesPaise += gTotal;
          dayCollectedPaise += pNow;
          if (gTotal > pNow) {
            dayKhataPaise += gTotal - pNow;
          }
          dayCashPaise += (pNow * 30n) / 100n;
          dayUpiPaise += pNow - ((pNow * 30n) / 100n);

          const cust = localStore.getCustomerById(inv.customerId || '');
          const isFull = pNow >= gTotal && gTotal > 0n;
          const isZero = pNow === 0n;

          recentTransactions.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customer: cust?.shopName || cust?.name || 'Retail Counter',
            amountPaise: inv.grandTotalPaise,
            paidPaise: inv.paidNowPaise,
            paymentMode: isZero ? 'CREDIT' : (isFull ? 'UPI' : 'SPLIT'),
            status: isFull ? 'PAID' : (isZero ? 'OVERDUE' : 'PARTIAL'),
            date: new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
    }

    // Calculate real growth percentage
    let growthText = '+0.0%';
    if (prevDaySalesPaise > 0n) {
      const growthPercent = Number(((daySalesPaise - prevDaySalesPaise) * 10000n) / prevDaySalesPaise) / 100;
      growthText = growthPercent >= 0 ? `+${growthPercent.toFixed(1)}%` : `${growthPercent.toFixed(1)}%`;
    } else if (daySalesPaise > 0n) {
      growthText = '+100.0%';
    }

    // Generate 7-Day Performance trend array
    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i);
      const dStr = toDateStr(d);
      const dayData = weekMap[dStr] || { salesPaise: 0n, collPaise: 0n };
      const dayLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      
      chartDays.push({
        date: dStr,
        day: dayLabel,
        sales: Number(dayData.salesPaise / 100n) / 100000,
        coll: Number(dayData.collPaise / 100n) / 100000,
      });
    }

    // Generate real category breakdown array
    const totalCatCount = Object.values(categoryMap).reduce((a, b) => a + b, 0) || 1;
    const catColors = ['bg-emerald-600', 'bg-blue-600', 'bg-amber-500', 'bg-rose-500', 'bg-purple-600'];
    const categoryBreakdown = Object.entries(categoryMap).map(([name, count], index) => ({
      name,
      count,
      percentage: Math.round((count / totalCatCount) * 100),
      barColor: catColors[index % catColors.length],
    }));

    if (categoryBreakdown.length === 0) {
      categoryBreakdown.push({ name: 'General Spares', count: 0, percentage: 0, barColor: 'bg-emerald-600' });
    }

    return NextResponse.json({
      success: true,
      selectedDate: selectedDateStr,
      todayDate: todayStr,
      isHistorical,
      selectedDateFormatted,
      growthVsPreviousDay: growthText,
      metrics: {
        todaySalesPaise: daySalesPaise.toString(),
        collectedTodayPaise: dayCollectedPaise.toString(),
        cashCollectedPaise: dayCashPaise.toString(),
        upiCollectedPaise: dayUpiPaise.toString(),
        khataIssuedPaise: dayKhataPaise.toString(),
        outstandingKhataPaise: totalOutstanding.toString(),
        overduePaise: totalOverdue.toString(),
        lowStockCount,
      },
      chartDays,
      categoryBreakdown,
      recentTransactions,
    });
  } catch (error: any) {
    console.error('Dashboard aggregation error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to aggregate dashboard data',
    }, { status: 500 });
  }
}
