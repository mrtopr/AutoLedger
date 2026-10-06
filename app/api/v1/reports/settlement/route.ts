import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const targetTenantId = authUser?.tenantId || 'tenant-royal-1';

    // 1. Try Prisma first if DB available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const todayInvoices = await prisma.invoice.findMany({
          where: {
            tenantId: targetTenantId,
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
          include: {
            items: { include: { product: { select: { purchasePrice: true } } } },
            allocations: true,
          }
        });

        const todayPayments = await prisma.payment.findMany({
          where: {
            tenantId: targetTenantId,
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
        });

        if (todayInvoices.length > 0 || todayPayments.length > 0) {
          let totalBilled = 0n;
          let totalCogs = 0n;
          let totalTax = 0n;

          for (const inv of todayInvoices) {
            totalBilled += inv.grandTotal;
            totalTax += (inv.cgst + inv.sgst + inv.igst);
            for (const item of inv.items) {
              const cost = item.product?.purchasePrice || (item.rate * 75n) / 100n;
              totalCogs += cost * BigInt(Math.round(Number(item.qty)));
            }
          }

          let cashCollected = 0n;
          let upiCollected = 0n;
          for (const p of todayPayments) {
            if (p.mode === 'CASH') cashCollected += p.amount;
            else upiCollected += p.amount;
          }

          const grossProfit = totalBilled > totalCogs ? totalBilled - totalCogs : 0n;
          const marginPct = totalBilled > 0n ? Number((grossProfit * 100n) / totalBilled) : 0;
          const totalCollected = cashCollected + upiCollected;
          const newUdhaar = totalBilled > totalCollected ? totalBilled - totalCollected : 0n;

          return NextResponse.json({
            success: true,
            summary: {
              date: startOfToday.toISOString().split('T')[0],
              totalBilledPaise: totalBilled.toString(),
              totalCogsPaise: totalCogs.toString(),
              grossProfitPaise: grossProfit.toString(),
              grossMarginPercent: marginPct,
              totalTaxPaise: totalTax.toString(),
              cashCollectedPaise: cashCollected.toString(),
              upiCollectedPaise: upiCollected.toString(),
              totalCollectedPaise: totalCollected.toString(),
              newCreditGivenPaise: newUdhaar.toString(),
              invoicesCount: todayInvoices.length,
              paymentsCount: todayPayments.length,
            },
            invoices: todayInvoices.map((inv) => ({
              id: inv.id,
              number: inv.number,
              grandTotalPaise: inv.grandTotal.toString(),
              status: inv.status,
              time: inv.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            })),
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable for settlement report, using localStore fallback');
      }
    }

    // 2. LocalStore calculation
    const localInvs = localStore.getInvoices(targetTenantId);
    const localPays = localStore.getPayments(targetTenantId);

    let totalBilled = 0n;
    for (const inv of localInvs) {
      totalBilled += BigInt(inv.grandTotalPaise || 0);
    }

    let cashCollected = 0n;
    let upiCollected = 0n;
    for (const p of localPays) {
      const amt = BigInt(p.amountPaise || 0);
      if (p.mode === 'CASH') cashCollected += amt;
      else upiCollected += amt;
    }

    const totalCollected = cashCollected + upiCollected;
    const totalCogs = (totalBilled * 75n) / 100n;
    const grossProfit = totalBilled > totalCogs ? totalBilled - totalCogs : 0n;
    const marginPct = totalBilled > 0n ? Number((grossProfit * 100n) / totalBilled) : 0;
    const newUdhaar = totalBilled > totalCollected ? totalBilled - totalCollected : 0n;

    return NextResponse.json({
      success: true,
      summary: {
        date: new Date().toISOString().split('T')[0],
        totalBilledPaise: totalBilled.toString(),
        totalCogsPaise: totalCogs.toString(),
        grossProfitPaise: grossProfit.toString(),
        grossMarginPercent: marginPct,
        totalTaxPaise: ((totalBilled * 18n) / 118n).toString(),
        cashCollectedPaise: cashCollected.toString(),
        upiCollectedPaise: upiCollected.toString(),
        totalCollectedPaise: totalCollected.toString(),
        newCreditGivenPaise: newUdhaar.toString(),
        invoicesCount: localInvs.length,
        paymentsCount: localPays.length,
      },
      invoices: localInvs.map((inv) => ({
        id: inv.id,
        number: inv.invoiceNumber,
        grandTotalPaise: inv.grandTotalPaise,
        status: 'PAID',
        time: new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      })),
    });
  } catch (error: any) {
    console.error('Error generating settlement report:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate settlement report' }, { status: 500 });
  }
}
