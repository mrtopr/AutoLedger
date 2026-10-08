import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { calculateInvoiceTax, LineItemInput } from '@/server/lib/tax';
import { InvoiceStatus, InvoiceType, LedgerEntryType, PaymentMode, PaymentStatus } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id;

    if (!targetTenantId) {
      return NextResponse.json({ success: true, invoices: [] });
    }

    let invoices: any[] = [];
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const dbInvoices = await prisma.invoice.findMany({
          where: { tenantId: targetTenantId },
          include: { customer: true, items: true, allocations: { include: { payment: true } } },
          orderBy: { createdAt: 'desc' },
        });

        if (dbInvoices.length > 0) {
          invoices = dbInvoices.map((inv: any) => {
            const allocatedPaid = inv.allocations?.reduce((sum: bigint, a: any) => sum + BigInt(a.amount || 0), 0n) || 0n;
            const paidNow = inv.paidNow ? BigInt(inv.paidNow) : allocatedPaid;
            const balDue = inv.grandTotal > paidNow ? inv.grandTotal - paidNow : 0n;

            return {
              id: inv.id,
              invoiceNumber: inv.number,
              customerId: inv.customerId,
              customerName: inv.customer?.name || 'Walk-in Customer',
              customerShop: inv.customer?.shopName || 'Walk-in Customer',
              customerPhone: inv.customer?.phone || '',
              customerGstin: inv.customer?.gstin || null,
              customerAddress: inv.customer?.address || '',
              status: inv.status,
              cancelReason: inv.cancelReason || null,
              grandTotalPaise: inv.grandTotal.toString(),
              paidNowPaise: paidNow.toString(),
              creditBalancePaise: balDue.toString(),
              taxableValuePaise: inv.taxableValue?.toString() || inv.grandTotal.toString(),
              totalTaxPaise: ((inv.cgst || 0n) + (inv.sgst || 0n) + (inv.igst || 0n)).toString(),
              cgstPaise: (inv.cgst || 0n).toString(),
              sgstPaise: (inv.sgst || 0n).toString(),
              items: inv.items.map((it: any) => ({
                id: it.id,
                name: it.description,
                partNumber: '',
                qty: Number(it.qty),
                unit: it.unit,
                ratePaise: it.rate.toString(),
                gstRateBp: it.gstRateBp,
                totalPaise: it.lineTotal.toString(),
              })),
              createdAt: inv.createdAt.toISOString(),
            };
          });
        }
      } catch (err) {
        console.warn('Postgres unavailable for invoices GET, using localStore fallback');
      }
    }

    if (invoices.length === 0) {
      const localInvs = localStore.getInvoices(targetTenantId);
      invoices = localInvs.map((inv) => {
        const cust = localStore.getCustomerById(inv.customerId || '');
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          customerName: cust?.name || 'Walk-in Customer',
          customerShop: cust?.shopName || 'Walk-in Customer',
          customerPhone: cust?.phone || '',
          customerGstin: cust?.gstin || null,
          customerAddress: cust?.address || '',
          status: inv.status || 'ISSUED',
          cancelReason: inv.cancelReason || null,
          grandTotalPaise: inv.grandTotalPaise,
          paidNowPaise: inv.paidNowPaise,
          creditBalancePaise: inv.creditBalancePaise,
          taxableValuePaise: inv.grandTotalPaise,
          totalTaxPaise: '0',
          cgstPaise: '0',
          sgstPaise: '0',
          items: inv.items || [],
          createdAt: inv.createdAt,
        };
      });
    }

    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    console.error('Error getting invoices:', error);
    return NextResponse.json({ error: error.message || 'Failed to get invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();

    const {
      customerId,
      placeOfSupply = '27',
      items = [],
      cashPaidPaise = 0,
      upiPaidPaise = 0,
      upiRef,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Invoice must contain at least one item' }, { status: 400 });
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';

    // 1. Calculate Tax & Totals
    const calculationInputs: LineItemInput[] = items.map((item: any) => ({
      qty: item.qty || 1,
      rate: BigInt(item.ratePaise || 0),
      discountPaise: BigInt(item.discountPaise || 0),
      discountPercent: item.discountPercent || 0,
      gstRateBp: item.gstRateBp || 1800,
      isTaxInclusive: !!item.isTaxInclusive,
    }));

    const taxSummary = calculateInvoiceTax(calculationInputs, '27', placeOfSupply);
    const totalPaidNow = BigInt(cashPaidPaise || 0) + BigInt(upiPaidPaise || 0);
    const balanceOnCredit = taxSummary.grandTotal > totalPaidNow ? taxSummary.grandTotal - totalPaidNow : 0n;

    const invoiceNumber = `INV/2026-27/${String(Math.floor(1000 + Math.random() * 9000))}`;

    // 2. Try Prisma first if DB available
    let dbInvoice: any = null;
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const invoice = await prisma.invoice.create({
          data: {
            tenantId: targetTenantId,
            customerId: customerId || null,
            invoiceType: InvoiceType.TAX_INVOICE,
            number: invoiceNumber,
            seriesCode: 'INV',
            status: totalPaidNow >= taxSummary.grandTotal ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
            subtotal: taxSummary.subtotal,
            discountTotal: taxSummary.discountTotal,
            taxableValue: taxSummary.taxableValue,
            cgst: taxSummary.cgst,
            sgst: taxSummary.sgst,
            igst: taxSummary.igst,
            roundOff: taxSummary.roundOff,
            grandTotal: taxSummary.grandTotal,
            paidNow: totalPaidNow,
            amountPaid: totalPaidNow,
            balanceDue: balanceOnCredit,
            items: {
              create: items.map((it: any) => ({
                productId: it.productId || null,
                description: it.name || 'Part',
                hsnCode: it.hsnCode || '8714',
                gstRateBp: it.gstRateBp || 1800,
                unit: it.unit || 'pcs',
                qty: it.qty || 1,
                rate: BigInt(it.ratePaise || 0),
                discount: BigInt(it.discountPaise || 0),
                taxableValue: BigInt(it.taxableValuePaise || it.ratePaise || 0),
                taxAmount: BigInt(it.totalTaxPaise || 0),
                lineTotal: BigInt(it.totalPaise || it.ratePaise || 0),
              }))
            }
          }
        });
        dbInvoice = invoice;

        // Double-Entry Ledger Posting in Postgres
        if (customerId && isUuid(customerId)) {
          // 1. Post Debit Ledger Entry for the Invoice
          await prisma.ledgerEntry.create({
            data: {
              tenantId: targetTenantId,
              customerId,
              entryType: LedgerEntryType.INVOICE,
              refId: invoice.id,
              debit: taxSummary.grandTotal,
              credit: 0n,
              narration: `Tax Invoice #${invoiceNumber}`,
            },
          });

          // 2. If paid at counter (full or partial), post Credit Ledger Entry & Payment Record
          if (totalPaidNow > 0n) {
            const mappedMode = Number(upiPaidPaise) > 0 ? PaymentMode.UPI : PaymentMode.CASH;
            const payment = await prisma.payment.create({
              data: {
                tenantId: targetTenantId,
                customerId,
                amount: totalPaidNow,
                mode: mappedMode,
                reference: upiRef || `POS-${invoiceNumber}`,
                status: PaymentStatus.CLEARED,
                notes: `Counter Settlement for Invoice #${invoiceNumber}`,
              },
            });

            await prisma.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                invoiceId: invoice.id,
                amount: totalPaidNow,
                strategy: 'DIRECT_LINK',
              },
            });

            await prisma.ledgerEntry.create({
              data: {
                tenantId: targetTenantId,
                customerId,
                entryType: LedgerEntryType.PAYMENT,
                refId: invoice.id,
                debit: 0n,
                credit: totalPaidNow,
                narration: `Counter Settlement (${mappedMode}) for Invoice #${invoiceNumber}`,
              },
            });
          }

          // 3. Re-calculate customer balance and update credit health status
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: { ledgerEntries: { select: { debit: true, credit: true } } },
          });
          if (customer) {
            const runningBal = customer.ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0n);
            await prisma.customer.update({
              where: { id: customerId },
              data: { status: runningBal <= customer.creditLimit ? 'GREEN' : 'YELLOW' },
            });
          }
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable for invoice create, using localStore fallback', dbErr);
      }
    }

    // 3. Always save in localStore
    const localInvoice = localStore.createInvoice({
      tenantId: targetTenantId,
      customerId: customerId || undefined,
      invoiceNumber,
      grandTotalPaise: taxSummary.grandTotal.toString(),
      paidNowPaise: totalPaidNow.toString(),
      creditBalancePaise: balanceOnCredit.toString(),
      items: items.map((it: any) => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        ratePaise: it.ratePaise,
      })),
    });

    // Double-Entry Ledger Posting in localStore
    if (customerId) {
      // 1. Post Debit Ledger Entry for the Invoice
      localStore.addLedgerEntry({
        tenantId: targetTenantId,
        customerId,
        type: 'INVOICE',
        refNo: invoiceNumber,
        narration: `Tax Invoice #${invoiceNumber}`,
        debitPaise: taxSummary.grandTotal.toString(),
        creditPaise: '0',
      });

      // 2. If paid at counter (full or partial), post Credit Ledger Entry & Payment Record
      if (totalPaidNow > 0n) {
        const payMode = Number(upiPaidPaise) > 0 ? 'UPI' : 'CASH';
        localStore.createPayment({
          tenantId: targetTenantId,
          customerId,
          amountPaise: totalPaidNow.toString(),
          mode: payMode,
          referenceNumber: upiRef || `POS-${invoiceNumber}`,
        });

        localStore.addLedgerEntry({
          tenantId: targetTenantId,
          customerId,
          type: 'PAYMENT',
          refNo: invoiceNumber,
          narration: `Counter Settlement (${payMode}) for Invoice #${invoiceNumber}`,
          debitPaise: '0',
          creditPaise: totalPaidNow.toString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      invoice: dbInvoice || localInvoice,
      invoiceNumber,
      grandTotalPaise: taxSummary.grandTotal.toString(),
      taxSummary: {
        taxableValue: taxSummary.taxableValue.toString(),
        totalTax: taxSummary.totalTax.toString(),
        grandTotal: taxSummary.grandTotal.toString(),
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Invoice create error:', error);
    return NextResponse.json({ error: error.message || 'Failed to issue invoice' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    
    let id = searchParams.get('id');
    let reason = searchParams.get('reason') || 'Billing cancellation';

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
        if (body.reason) reason = body.reason;
      } catch {
        // query param used
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id;

    // 1. Try Postgres reversal if available
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(id)) {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: { items: true, customer: true },
        });

        if (invoice) {
          if (invoice.status === InvoiceStatus.CANCELLED) {
            return NextResponse.json({ success: true, message: 'Invoice is already cancelled' });
          }

          // A. Mark Invoice Cancelled
          await prisma.invoice.update({
            where: { id },
            data: {
              status: InvoiceStatus.CANCELLED,
              cancelReason: reason,
            },
          });

          // B. Restore Stock Movement for items
          for (const item of invoice.items) {
            if (item.productId) {
              await prisma.stockMovement.create({
                data: {
                  tenantId: invoice.tenantId,
                  productId: item.productId,
                  qty: Number(item.qty),
                  reason: 'RETURN_IN',
                  refType: 'INVOICE_CANCEL',
                  refId: invoice.id,
                  unitCost: item.rate,
                },
              }).catch(() => {});
            }
          }

          // C. Reverse Customer Khata Ledger Entry
          if (invoice.customerId) {
            await prisma.ledgerEntry.create({
              data: {
                tenantId: invoice.tenantId,
                customerId: invoice.customerId,
                entryType: LedgerEntryType.ADJUSTMENT,
                refId: invoice.id,
                debit: 0n,
                credit: invoice.grandTotal,
                narration: `Reversal - Cancelled Invoice #${invoice.number || id.slice(0, 8)} (${reason})`,
              },
            });

            // Update Customer Running Balance & Health
            const cust = await prisma.customer.findUnique({
              where: { id: invoice.customerId },
              include: { ledgerEntries: { select: { debit: true, credit: true } } },
            });
            if (cust) {
              const runningBal = cust.ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0n);
              await prisma.customer.update({
                where: { id: invoice.customerId },
                data: { status: runningBal <= cust.creditLimit ? 'GREEN' : 'YELLOW' },
              });
            }
          }
        }
      } catch (dbErr) {
        console.warn('Postgres invoice cancel error, fallback to localStore:', dbErr);
      }
    }

    // 2. Always sync with localStore
    if (typeof localStore.cancelInvoice === 'function') {
      localStore.cancelInvoice(id, reason);
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice cancelled successfully. Inventory stock and Khata ledger have been reversed.',
    });
  } catch (error: any) {
    console.error('Invoice cancel error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel invoice' }, { status: 500 });
  }
}
