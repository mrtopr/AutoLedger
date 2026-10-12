import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore, LocalCashSettlement } from '@/server/lib/store';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-royal-1';

    const { searchParams } = new URL(req.url);
    const requestedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Determine Opening Float from previous day's settlement
    const allSettlements = localStore.getCashSettlements(targetTenantId);
    const previousSettlement = [...allSettlements]
      .filter((s) => s.date < requestedDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    const defaultOpeningFloatPaise = previousSettlement ? previousSettlement.retainedFloatPaise : '0';
    const existingSettlement = localStore.getCashSettlementByDate(requestedDate, targetTenantId);

    // 1. Try Prisma first if Postgres is available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const startOfDay = new Date(`${requestedDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${requestedDate}T23:59:59.999Z`);

        const todayInvoices = await prisma.invoice.findMany({
          where: {
            tenantId: targetTenantId,
            createdAt: { gte: startOfDay, lte: endOfDay },
            status: { not: 'CANCELLED' },
          },
          include: {
            customer: { select: { name: true, shopName: true } },
            items: { include: { product: { select: { purchasePrice: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const todayPayments = await prisma.payment.findMany({
          where: {
            tenantId: targetTenantId,
            createdAt: { gte: startOfDay, lte: endOfDay },
            status: { not: 'BOUNCED' },
          },
          include: {
            customer: { select: { name: true, shopName: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

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
        let bankCollected = 0n;
        const onlineTransactions: any[] = [];

        for (const p of todayPayments) {
          if (p.mode === 'CASH') {
            cashCollected += p.amount;
          } else if (p.mode === 'UPI') {
            upiCollected += p.amount;
            onlineTransactions.push({
              id: p.id,
              mode: 'UPI',
              amountPaise: p.amount.toString(),
              referenceNumber: p.reference || 'UPI',
              customerName: p.customer?.name || p.customer?.shopName || 'Counter Customer',
              time: p.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
              notes: p.notes,
            });
          } else {
            bankCollected += p.amount;
            onlineTransactions.push({
              id: p.id,
              mode: p.mode,
              amountPaise: p.amount.toString(),
              referenceNumber: p.reference || 'Bank Ref',
              customerName: p.customer?.name || p.customer?.shopName || 'Counter Customer',
              time: p.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
              notes: p.notes,
            });
          }
        }

        // Check if any invoices had paidNow that were not captured in payments
        const paidInvoiceNumbers = new Set<string>();
        for (const p of todayPayments) {
          for (const inv of todayInvoices) {
            if (inv.number && p.reference && p.reference.includes(inv.number)) {
              paidInvoiceNumbers.add(inv.number);
            }
          }
        }
        for (const inv of todayInvoices) {
          if (inv.number && !paidInvoiceNumbers.has(inv.number) && inv.paidNow > 0n) {
            cashCollected += inv.paidNow;
          }
        }

        let newUdhaar = 0n;
        for (const inv of todayInvoices) {
          const bal = inv.balanceDue || (inv.grandTotal > inv.paidNow ? inv.grandTotal - inv.paidNow : 0n);
          newUdhaar += bal;
        }

        // If day was already settled, honor the locked figures
        if (existingSettlement) {
          cashCollected = BigInt(existingSettlement.cashSalesPaise || '0');
          upiCollected = BigInt(existingSettlement.upiTotalPaise || '0');
          bankCollected = BigInt(existingSettlement.bankTotalPaise || '0');
        }

        const grossProfit = totalBilled > totalCogs ? totalBilled - totalCogs : 0n;
        const marginPct = totalBilled > 0n ? Number((grossProfit * 100n) / totalBilled) : 0;
        const totalCollected = cashCollected + upiCollected + bankCollected;

        return NextResponse.json({
          success: true,
          date: requestedDate,
          summary: {
            date: requestedDate,
            openingFloatPaise: existingSettlement?.openingFloatPaise || defaultOpeningFloatPaise,
            totalBilledPaise: totalBilled.toString(),
            totalCogsPaise: totalCogs.toString(),
            grossProfitPaise: grossProfit.toString(),
            grossMarginPercent: marginPct,
            totalTaxPaise: totalTax.toString(),
            cashCollectedPaise: cashCollected.toString(),
            upiCollectedPaise: upiCollected.toString(),
            bankCollectedPaise: bankCollected.toString(),
            totalCollectedPaise: totalCollected.toString(),
            newCreditGivenPaise: newUdhaar.toString(),
            invoicesCount: todayInvoices.length,
            paymentsCount: todayPayments.length,
          },
          onlineTransactions,
          isClosed: !!existingSettlement,
          savedSettlement: existingSettlement || null,
          recentSettlements: allSettlements.slice(0, 7),
          invoices: todayInvoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            grandTotalPaise: inv.grandTotal.toString(),
            status: inv.status,
            customerName: inv.customer?.name || inv.customer?.shopName || 'Walk-in',
            time: inv.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          })),
        });
      } catch (dbErr) {
        console.warn('Postgres query error in settlement route, falling back to localStore:', dbErr);
      }
    }

    // 2. LocalStore calculation
    const localInvs = localStore.getInvoices(targetTenantId).filter((i) => {
      const invDate = i.createdAt ? i.createdAt.split('T')[0] : '';
      return invDate === requestedDate && i.status !== 'CANCELLED';
    });

    const localPays = localStore.getPayments(targetTenantId).filter((p) => {
      const pDate = p.createdAt ? p.createdAt.split('T')[0] : '';
      return pDate === requestedDate;
    });

    let totalBilled = 0n;
    for (const inv of localInvs) {
      totalBilled += BigInt(inv.grandTotalPaise || 0);
    }

    let cashCollected = 0n;
    let upiCollected = 0n;
    let bankCollected = 0n;
    const onlineTransactions: any[] = [];

    for (const p of localPays) {
      const amt = BigInt(p.amountPaise || 0);
      const cust = p.customerId ? localStore.getCustomerById(p.customerId) : undefined;
      const custName = cust?.name || cust?.shopName || 'Counter Customer';
      const timeStr = p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

      if (p.mode === 'CASH') {
        cashCollected += amt;
      } else if (p.mode === 'UPI') {
        upiCollected += amt;
        onlineTransactions.push({
          id: p.id,
          mode: 'UPI',
          amountPaise: amt.toString(),
          referenceNumber: p.referenceNumber || 'UPI Ref',
          customerName: custName,
          time: timeStr,
        });
      } else {
        bankCollected += amt;
        onlineTransactions.push({
          id: p.id,
          mode: p.mode || 'BANK',
          amountPaise: amt.toString(),
          referenceNumber: p.referenceNumber || 'Bank Ref',
          customerName: custName,
          time: timeStr,
        });
      }
    }

    // Check if any invoices had paidNow that were not captured in payments
    const paidInvoiceNumbers = new Set<string>();
    for (const p of localPays) {
      for (const inv of localInvs) {
        if (p.referenceNumber && p.referenceNumber.includes(inv.invoiceNumber)) {
          paidInvoiceNumbers.add(inv.invoiceNumber);
        }
      }
    }
    for (const inv of localInvs) {
      if (!paidInvoiceNumbers.has(inv.invoiceNumber)) {
        const paid = BigInt(inv.paidNowPaise || '0');
        if (paid > 0n) {
          cashCollected += paid;
        }
      }
    }

    let newUdhaar = 0n;
    for (const inv of localInvs) {
      const gTotal = BigInt(inv.grandTotalPaise || '0');
      const paid = BigInt(inv.paidNowPaise || '0');
      if (gTotal > paid) {
        newUdhaar += (gTotal - paid);
      }
    }

    // If day was already settled, honor the locked figures
    if (existingSettlement) {
      cashCollected = BigInt(existingSettlement.cashSalesPaise || '0');
      upiCollected = BigInt(existingSettlement.upiTotalPaise || '0');
      bankCollected = BigInt(existingSettlement.bankTotalPaise || '0');
    }

    const totalCollected = cashCollected + upiCollected + bankCollected;
    const totalCogs = (totalBilled * 75n) / 100n;
    const grossProfit = totalBilled > totalCogs ? totalBilled - totalCogs : 0n;
    const marginPct = totalBilled > 0n ? Number((grossProfit * 100n) / totalBilled) : 0;

    return NextResponse.json({
      success: true,
      date: requestedDate,
      summary: {
        date: requestedDate,
        openingFloatPaise: existingSettlement?.openingFloatPaise || defaultOpeningFloatPaise,
        totalBilledPaise: totalBilled.toString(),
        totalCogsPaise: totalCogs.toString(),
        grossProfitPaise: grossProfit.toString(),
        grossMarginPercent: marginPct,
        totalTaxPaise: ((totalBilled * 18n) / 118n).toString(),
        cashCollectedPaise: cashCollected.toString(),
        upiCollectedPaise: upiCollected.toString(),
        bankCollectedPaise: bankCollected.toString(),
        totalCollectedPaise: totalCollected.toString(),
        newCreditGivenPaise: newUdhaar.toString(),
        invoicesCount: localInvs.length,
        paymentsCount: localPays.length,
      },
      onlineTransactions,
      isClosed: !!existingSettlement,
      savedSettlement: existingSettlement || null,
      recentSettlements: allSettlements.slice(0, 7),
      invoices: localInvs.map((inv) => {
        const cust = inv.customerId ? localStore.getCustomerById(inv.customerId) : undefined;
        return {
          id: inv.id,
          number: inv.invoiceNumber,
          grandTotalPaise: inv.grandTotalPaise,
          status: inv.status || 'PAID',
          customerName: cust?.name || cust?.shopName || 'Walk-in',
          time: new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        };
      }),
    });
  } catch (error: any) {
    console.error('Error generating settlement report:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate settlement report' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-royal-1';

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
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const saved = localStore.saveCashSettlement({
      tenantId: targetTenantId,
      date,
      openingFloatPaise: openingFloatPaise.toString(),
      cashSalesPaise: cashSalesPaise.toString(),
      cashReceiptsPaise: cashReceiptsPaise.toString(),
      cashExpensesPaise: cashExpensesPaise.toString(),
      expectedCashPaise: expectedCashPaise.toString(),
      denominations,
      countedCashPaise: countedCashPaise.toString(),
      differencePaise: differencePaise.toString(),
      retainedFloatPaise: retainedFloatPaise.toString(),
      withdrawnPaise: withdrawnPaise.toString(),
      upiTotalPaise: upiTotalPaise.toString(),
      bankTotalPaise: bankTotalPaise.toString(),
      upiVerified: Boolean(upiVerified),
      notes: notes || '',
      status: status as 'BALANCED' | 'SHORT' | 'EXCESS',
      closedByUserId: authUser?.id,
      closedByName: authUser?.name || 'Store Owner',
    });

    return NextResponse.json({
      success: true,
      message: 'Day-end cash settlement recorded successfully',
      settlement: saved,
    });
  } catch (error: any) {
    console.error('Error saving cash settlement:', error);
    return NextResponse.json({ error: error.message || 'Failed to save cash settlement' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-royal-1';
    const { searchParams } = new URL(req.url);
    const idOrDate = searchParams.get('id') || searchParams.get('date');

    if (!idOrDate) {
      return NextResponse.json({ error: 'ID or date is required for deletion' }, { status: 400 });
    }

    const deleted = localStore.deleteCashSettlement(idOrDate, targetTenantId);
    return NextResponse.json({
      success: true,
      deleted,
      message: deleted ? 'Settlement record deleted and register re-opened' : 'No settlement found to delete',
    });
  } catch (error: any) {
    console.error('Error deleting cash settlement:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete cash settlement' }, { status: 500 });
  }
}
