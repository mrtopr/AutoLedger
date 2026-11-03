import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable, getStorageMode } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { CreditStatus, InvoiceStatus, InvoiceType, LedgerEntryType, PaymentMode, PaymentStatus, StockReason } from '@prisma/client';
import { calculateInvoiceTax, LineItemInput } from '@/server/lib/tax';
import {
  allocateNextInvoiceNumberPrisma,
  allocateNextInvoiceNumberLocalStore,
  getIndianFinancialYear,
} from '@/server/lib/invoiceNumbering';
import { createAuditLog } from '@/server/lib/audit';
import { CreateInvoiceSchema, InvoiceDTO, InvoiceItemDTO } from './schema';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    let invoices: InvoiceDTO[] = [];
    let dbSuccess = false;
    const hasDb = await isPostgresAvailable();
    const effectiveTenantId = isUuid(targetTenantId) ? targetTenantId : null;

    if (hasDb && effectiveTenantId) {
      try {
        const dbInvoices = await prisma.invoice.findMany({
          where: { tenantId: effectiveTenantId },
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
              subtotalPaise: inv.grandTotal.toString(),
              paidNowPaise: paidNow.toString(),
              amountPaidPaise: paidNow.toString(),
              creditBalancePaise: balDue.toString(),
              balanceDuePaise: balDue.toString(),
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
        dbSuccess = true;
      } catch (err) {
        console.warn('Postgres unavailable for invoices GET, using localStore fallback');
      }
    }

    if (!dbSuccess) {
      const localInvs = localStore.getInvoices(targetTenantId);
      invoices = localInvs.map((inv) => {
        const cust = localStore.getCustomerById(inv.customerId || '');
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          customerName: cust?.name || inv.customerName || 'Walk-in Customer',
          customerShop: cust?.shopName || inv.customerName || 'Walk-in Customer',
          customerPhone: cust?.phone || inv.customerPhone || '',
          customerGstin: cust?.gstin || inv.customerGstin || null,
          customerAddress: cust?.address || '',
          status: inv.status || (BigInt(inv.creditBalancePaise || '0') === 0n ? 'PAID' : 'ISSUED'),
          cancelReason: inv.cancelReason || null,
          grandTotalPaise: inv.grandTotalPaise,
          subtotalPaise: inv.grandTotalPaise,
          paidNowPaise: inv.paidNowPaise,
          amountPaidPaise: inv.paidNowPaise,
          creditBalancePaise: inv.creditBalancePaise,
          balanceDuePaise: inv.creditBalancePaise,
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
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to get invoices';
    console.error('Error getting invoices:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

const invoiceIdempotencyCache = new Map<string, {
  invoice: unknown;
  invoiceNumber: string;
  customerId?: string;
  itemCount?: number;
  grandTotalPaise: string;
  taxSummary: unknown;
  timestamp: number;
}>();

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    const body = await req.json().catch(() => ({}));
    const parseResult = CreateInvoiceSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid invoice payload';
      return NextResponse.json({ error: firstError, details: parseResult.error.flatten() }, { status: 400 });
    }

    const {
      customerId,
      placeOfSupply = '27',
      items = [],
      upiRef,
      invoiceDate,
      customerName,
      customerPhone,
      customerGstin,
    } = parseResult.data;

    let cashPaidPaise = body.cashPaidPaise !== undefined ? body.cashPaidPaise : 0;
    let upiPaidPaise = body.upiPaidPaise !== undefined ? body.upiPaidPaise : 0;
    if (Number(cashPaidPaise) === 0 && Number(upiPaidPaise) === 0) {
      if (body.paidNowPaise !== undefined) {
        cashPaidPaise = body.paidNowPaise;
      } else if (body.paidNowRupees !== undefined) {
        cashPaidPaise = Math.round(Number(body.paidNowRupees) * 100);
      }
    }

    const idempotencyKey = (
      req.headers.get('idempotency-key') ||
      body.idempotencyKey ||
      body.clientRequestId ||
      ''
    ).trim();

    const hasDb = await isPostgresAvailable();
    const dbTenantId = isUuid(targetTenantId) ? targetTenantId : null;

    // Fail-safe: In production / PostgreSQL storage mode, never silently fall back to localStore
    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Transaction cannot be safely recorded.' },
        { status: 503 }
      );
    }

    if (idempotencyKey) {
      const cacheKey = `${targetTenantId}:${idempotencyKey}`;
      const cached = invoiceIdempotencyCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
        if (cached.customerId && customerId && cached.customerId !== customerId) {
          return NextResponse.json(
            { error: 'Idempotency key conflict: This key was previously used for a different customer' },
            { status: 409 }
          );
        }
        if (items && Array.isArray(items) && cached.itemCount !== undefined && items.length !== cached.itemCount) {
          return NextResponse.json(
            { error: 'Idempotency key conflict: Request items do not match original transaction' },
            { status: 409 }
          );
        }
        return NextResponse.json({
          success: true,
          isDuplicate: true,
          invoice: cached.invoice,
          invoiceNumber: cached.invoiceNumber,
          grandTotalPaise: cached.grandTotalPaise,
          taxSummary: cached.taxSummary,
        }, { status: 200 });
      }

      // Durable PostgreSQL idempotency check across server restarts and multiple instances
      if (hasDb && dbTenantId) {
        const existing = await prisma.invoice.findFirst({
          where: { tenantId: dbTenantId, idempotencyKey },
          include: { customer: true, items: true },
        });
        if (existing) {
          if (existing.customerId && customerId && existing.customerId !== customerId) {
            return NextResponse.json(
              { error: 'Idempotency key conflict: This key was previously used for a different customer' },
              { status: 409 }
            );
          }
          if (items && Array.isArray(items) && existing.items && existing.items.length > 0 && existing.items.length !== items.length) {
            return NextResponse.json(
              { error: 'Idempotency key conflict: Request items do not match original transaction' },
              { status: 409 }
            );
          }
          return NextResponse.json({
            success: true,
            isDuplicate: true,
            invoice: existing,
            invoiceNumber: existing.number,
            grandTotalPaise: (existing.grandTotal ?? 0n).toString(),
            taxSummary: {
              taxableValue: (existing.taxableValue ?? existing.grandTotal ?? 0n).toString(),
              totalTax: '0',
              grandTotal: (existing.grandTotal ?? 0n).toString(),
            },
          }, { status: 200 });
        }
      } else if (!hasDb) {
        const localExisting = localStore.getInvoiceByIdempotencyKey(targetTenantId, idempotencyKey);
        if (localExisting) {
          if (localExisting.customerId && customerId && localExisting.customerId !== customerId) {
            return NextResponse.json(
              { error: 'Idempotency key conflict: This key was previously used for a different customer' },
              { status: 409 }
            );
          }
          if (items && Array.isArray(items) && localExisting.items && localExisting.items.length !== items.length) {
            return NextResponse.json(
              { error: 'Idempotency key conflict: Request items do not match original transaction' },
              { status: 409 }
            );
          }
          return NextResponse.json({
            success: true,
            isDuplicate: true,
            invoice: localExisting,
            invoiceNumber: localExisting.invoiceNumber,
            grandTotalPaise: localExisting.grandTotalPaise,
            taxSummary: {
              taxableValue: localExisting.grandTotalPaise,
              totalTax: '0',
              grandTotal: localExisting.grandTotalPaise,
            },
          }, { status: 200 });
        }
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invoice must contain at least one item' }, { status: 400 });
    }

    // Strict validation of items & quantity policy (must be positive whole number)
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const rawQty = it.qty !== undefined ? it.qty : it.quantity;
      const numQty = Number(rawQty);
      if (!Number.isInteger(numQty) || numQty <= 0) {
        return NextResponse.json({ error: `Item ${i + 1}: Quantity must be a valid positive number (whole numbers only)` }, { status: 400 });
      }

      if (it.rateRupees !== undefined && (it.ratePaise === undefined || it.ratePaise === null)) {
        it.ratePaise = Math.round(Number(it.rateRupees) * 100);
      }
      if (it.discountRupees !== undefined && (it.discountPaise === undefined || it.discountPaise === null)) {
        it.discountPaise = Math.round(Number(it.discountRupees) * 100);
      }

      const rawRate = it.ratePaise !== undefined ? it.ratePaise : (it.unitPrice !== undefined ? Number(it.unitPrice) * 100 : undefined);
      const numRate = Number(rawRate);
      if (rawRate === undefined || !Number.isFinite(numRate) || numRate < 0) {
        return NextResponse.json({ error: `Item ${i + 1}: Rate must be a valid non-negative amount` }, { status: 400 });
      }

      if (it.discountPaise !== undefined && it.discountPaise !== null && it.discountPaise !== '') {
        const numDisc = Number(it.discountPaise);
        if (!Number.isFinite(numDisc) || numDisc < 0) {
          return NextResponse.json({ error: `Item ${i + 1}: Discount amount cannot be negative or invalid` }, { status: 400 });
        }
        const grossLinePaise = Math.round(numQty * numRate);
        if (numDisc > grossLinePaise) {
          return NextResponse.json({ error: `Item ${i + 1}: Discount cannot exceed item gross total` }, { status: 400 });
        }
      }

      if (it.discountPercent !== undefined && it.discountPercent !== null && it.discountPercent !== '') {
        const numDiscPct = Number(it.discountPercent);
        if (!Number.isFinite(numDiscPct) || numDiscPct < 0 || numDiscPct > 100) {
          return NextResponse.json({ error: `Item ${i + 1}: Discount percent must be between 0 and 100` }, { status: 400 });
        }
      }
    }

    // Product Tenant Isolation Verification
    const productIdsToCheck = items
      .map((it: any) => it.productId)
      .filter((pid: any) => pid && typeof pid === 'string' && pid.trim().length > 0);

    if (hasDb && dbTenantId && productIdsToCheck.length > 0) {
      const validUuids = productIdsToCheck.filter((pid: string) => isUuid(pid));
      if (validUuids.length > 0) {
        const tenantProducts = await prisma.product.findMany({
          where: { id: { in: validUuids }, tenantId: dbTenantId },
          select: { id: true },
        });
        const foundSet = new Set(tenantProducts.map(p => p.id));
        for (const pid of validUuids) {
          if (!foundSet.has(pid)) {
            return NextResponse.json({ error: 'Product not found in your organization' }, { status: 400 });
          }
        }
      }
    } else if (!hasDb && productIdsToCheck.length > 0) {
      for (const pid of productIdsToCheck) {
        const localP = localStore.getProductById(pid, targetTenantId);
        if (!localP) {
          return NextResponse.json({ error: 'Product not found in your organization' }, { status: 400 });
        }
      }
    }

    // Validate cash and UPI payment inputs
    const numCash = Number(cashPaidPaise || 0);
    const numUpi = Number(upiPaidPaise || 0);
    if (!Number.isFinite(numCash) || numCash < 0) {
      return NextResponse.json({ error: 'Cash paid amount cannot be negative or invalid' }, { status: 400 });
    }
    if (!Number.isFinite(numUpi) || numUpi < 0) {
      return NextResponse.json({ error: 'UPI paid amount cannot be negative or invalid' }, { status: 400 });
    }

    // Parse custom invoice date and retain real-time timestamp
    let invoiceCreatedDate = new Date();
    if (invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
      const now = new Date();
      const [year, month, day] = invoiceDate.split('-').map(Number);
      invoiceCreatedDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }
    const invoiceCreatedIso = invoiceCreatedDate.toISOString();

    // 1. Calculate Bill Totals (Basic Non-GST Sales Bill / Cash Receipt)
    // Line total = Quantity * Rate - Discounts (no GST addition or CGST/SGST/IGST splitting)
    const calculationInputs: LineItemInput[] = items.map((item: any) => ({
      qty: item.qty || 1,
      rate: BigInt(
        item.ratePaise !== undefined
          ? item.ratePaise
          : item.unitPrice
            ? item.unitPrice * 100
            : 0
      ),
      discountPaise: BigInt(item.discountPaise || 0),
      discountPercent: item.discountPercent || 0,
      gstRateBp: 0,
      isTaxInclusive: false,
    }));

    const taxSummary = calculateInvoiceTax(calculationInputs, '27', placeOfSupply);
    const totalPaidNow = BigInt(cashPaidPaise || 0) + BigInt(upiPaidPaise || 0);

    // Reject walk-in overpayment (cannot hold unallocated credit without a customer account)
    if (!customerId && totalPaidNow > taxSummary.grandTotal) {
      return NextResponse.json({
        error: 'Walk-in cash/UPI payment cannot exceed the bill grand total',
      }, { status: 400 });
    }

    const balanceOnCredit = taxSummary.grandTotal > totalPaidNow ? taxSummary.grandTotal - totalPaidNow : 0n;

    // 2. Try Prisma first if DB available (ACID transaction with atomic sequence increment)
    let dbInvoice: any = null;

    let dbCustomerId = (customerId && isUuid(customerId)) ? customerId : null;
    if (dbCustomerId && hasDb && dbTenantId) {
      const cust = await prisma.customer.findFirst({
        where: { id: dbCustomerId, tenantId: dbTenantId },
        select: { id: true },
      });
      if (!cust) {
        return NextResponse.json({ error: 'Customer does not belong to your organization' }, { status: 400 });
      }
    } else if (customerId && !hasDb) {
      const localCust = localStore.getCustomerById(customerId, targetTenantId);
      if (!localCust) {
        return NextResponse.json({ error: 'Customer does not belong to your organization' }, { status: 400 });
      }
    }

    // Fail-safe: In production / PostgreSQL storage mode, never silently fall back to localStore
    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Transaction cannot be safely recorded.' },
        { status: 503 }
      );
    }

    if (hasDb && dbTenantId) {
      try {
        const txResult = await prisma.$transaction(async (tx) => {
          // 1. Atomic, concurrency-safe sequential invoice number allocation
          const allocated = await allocateNextInvoiceNumberPrisma(tx, dbTenantId, {
            seriesCode: 'INV',
            date: invoiceCreatedDate,
          });
          const allocatedNumber = allocated.invoiceNumber;

          // 2. Create Bill (Non-GST Retail Bill) with durable tenant-scoped idempotency key
          const invoice = await tx.invoice.create({
            data: {
              tenantId: dbTenantId,
              customerId: dbCustomerId,
              invoiceType: InvoiceType.RETAIL_BILL,
              number: allocatedNumber,
              seriesCode: allocated.seriesCode,
              fy: allocated.fy,
              idempotencyKey: idempotencyKey || null,
              status: totalPaidNow >= taxSummary.grandTotal ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
              subtotal: taxSummary.subtotal,
              discountTotal: taxSummary.discountTotal,
              taxableValue: taxSummary.taxableValue,
              cgst: 0n,
              sgst: 0n,
              igst: 0n,
              roundOff: taxSummary.roundOff,
              grandTotal: taxSummary.grandTotal,
              paidNow: totalPaidNow,
              amountPaid: totalPaidNow,
              balanceDue: balanceOnCredit,
              createdAt: invoiceCreatedDate,
              items: {
                create: items.map((it: any) => ({
                  productId: (it.productId && isUuid(it.productId)) ? it.productId : null,
                  description: it.name || it.description || 'Part',
                  hsnCode: it.hsnCode || null,
                  gstRateBp: 0,
                  unit: it.unit || 'pcs',
                  qty: Number(it.qty !== undefined ? it.qty : it.quantity),
                  rate: BigInt(it.ratePaise !== undefined ? it.ratePaise : (it.unitPrice ? it.unitPrice * 100 : 0)),
                  discount: BigInt(it.discountPaise || 0),
                  taxableValue: BigInt(it.taxableValuePaise || it.ratePaise || (it.unitPrice ? it.unitPrice * 100 : 0)),
                  taxAmount: 0n,
                  lineTotal: BigInt(it.totalPaise || it.ratePaise || (it.unitPrice ? it.unitPrice * 100 : 0)),
                }))
              }
            }
          });

          // 3. Double-Entry Ledger Posting in Postgres
          if (dbCustomerId) {
            await tx.ledgerEntry.create({
              data: {
                tenantId: dbTenantId,
                customerId: dbCustomerId,
                entryType: LedgerEntryType.INVOICE,
                refId: invoice.id,
                debit: taxSummary.grandTotal,
                credit: 0n,
                narration: `Sales Bill #${allocatedNumber}`,
                createdAt: invoiceCreatedDate,
              },
            });

            // 4. Record Counter Payments
            const cashAmt = BigInt(cashPaidPaise || 0);
            const upiAmt = BigInt(upiPaidPaise || 0);

            if (cashAmt > 0n) {
              const cashPay = await tx.payment.create({
                data: {
                  tenantId: dbTenantId,
                  customerId: dbCustomerId,
                  amount: cashAmt,
                  mode: PaymentMode.CASH,
                  reference: `CASH-${allocatedNumber}`,
                  status: PaymentStatus.CLEARED,
                  notes: `Counter Cash Settlement for Bill #${allocatedNumber}`,
                  createdAt: invoiceCreatedDate,
                },
              });
              await tx.paymentAllocation.create({
                data: {
                  paymentId: cashPay.id,
                  invoiceId: invoice.id,
                  amount: cashAmt,
                  strategy: 'DIRECT_LINK',
                },
              });
            }

            if (upiAmt > 0n) {
              const upiPay = await tx.payment.create({
                data: {
                  tenantId: dbTenantId,
                  customerId: dbCustomerId,
                  amount: upiAmt,
                  mode: PaymentMode.UPI,
                  reference: upiRef || `UPI-${allocatedNumber}`,
                  status: PaymentStatus.CLEARED,
                  notes: `Counter UPI Settlement for Bill #${allocatedNumber}`,
                  createdAt: invoiceCreatedDate,
                },
              });
              await tx.paymentAllocation.create({
                data: {
                  paymentId: upiPay.id,
                  invoiceId: invoice.id,
                  amount: upiAmt,
                  strategy: 'DIRECT_LINK',
                },
              });
            }

            if (cashAmt <= 0n && upiAmt <= 0n && totalPaidNow > 0n) {
              const fallbackPay = await tx.payment.create({
                data: {
                  tenantId: dbTenantId,
                  customerId: dbCustomerId,
                  amount: totalPaidNow,
                  mode: PaymentMode.CASH,
                  reference: `POS-${allocatedNumber}`,
                  status: PaymentStatus.CLEARED,
                  notes: `Counter Settlement for Invoice #${allocatedNumber}`,
                  createdAt: invoiceCreatedDate,
                },
              });
              await tx.paymentAllocation.create({
                data: {
                  paymentId: fallbackPay.id,
                  invoiceId: invoice.id,
                  amount: totalPaidNow,
                  strategy: 'DIRECT_LINK',
                },
              });
            }

            if (totalPaidNow > 0n) {
              await tx.ledgerEntry.create({
                data: {
                  tenantId: dbTenantId,
                  customerId: dbCustomerId,
                  entryType: LedgerEntryType.PAYMENT,
                  refId: invoice.id,
                  debit: 0n,
                  credit: totalPaidNow,
                  narration: `Counter Settlement for Invoice #${allocatedNumber}`,
                  createdAt: invoiceCreatedDate,
                },
              });
            }

            // 5. Update customer credit health status
            const customer = await tx.customer.findUnique({
              where: { id: dbCustomerId },
              include: { ledgerEntries: { select: { debit: true, credit: true } } },
            });
            if (customer) {
              const runningBal = customer.ledgerEntries.reduce<bigint>(
                (sum, e) => sum + BigInt(e.debit || 0) - BigInt(e.credit || 0),
                0n
              );
              await tx.customer.update({
                where: { id: dbCustomerId },
                data: { status: runningBal <= customer.creditLimit ? 'GREEN' : 'YELLOW' },
              });
            }
          }

          // 6. Decrement Product Inventory via Stock Movements (Append-Only Ledger)
          for (const it of items) {
            if (it.productId && isUuid(it.productId)) {
              await tx.stockMovement.create({
                data: {
                  tenantId: dbTenantId,
                  productId: it.productId,
                  qty: -Number(it.qty),
                  reason: StockReason.SALE,
                  refType: 'INVOICE',
                  refId: invoice.id,
                  unitCost: it.ratePaise ? BigInt(it.ratePaise) : undefined,
                  createdBy: (authUser.id && isUuid(authUser.id)) ? authUser.id : undefined,
                },
              });
            }
          }

          // 7. Record Invoice Event Audit Trail with Idempotency Tracking
          await tx.invoiceEvent.create({
            data: {
              invoiceId: invoice.id,
              event: 'CREATED',
              meta: {
                idempotencyKey: idempotencyKey || null,
                createdBy: authUser.id || null,
                createdAt: invoiceCreatedIso,
              },
            },
          });

          // 8. Record Immutable Audit Trail Entry
          await createAuditLog({
            tenantId: dbTenantId,
            userId: authUser.id,
            action: 'INVOICE_CREATED',
            entity: 'INVOICE',
            entityId: invoice.id,
            after: {
              invoiceNumber: allocatedNumber,
              grandTotalPaise: taxSummary.grandTotal.toString(),
              paidNowPaise: totalPaidNow.toString(),
              itemCount: items.length,
            },
          }, tx);

          return invoice;
        }, { maxWait: 10000, timeout: 25000 });

        dbInvoice = txResult;
      } catch (dbErr: any) {
        if (dbErr?.code === 'P2002' && idempotencyKey) {
          // A concurrent request with the same idempotency key won the race.
          // Fetch the winning invoice durably from PostgreSQL and return it idempotently.
          let winningInvoice = await prisma.invoice.findFirst({
            where: {
              tenantId: dbTenantId,
              idempotencyKey: idempotencyKey,
            },
            include: {
              items: true,
              allocations: true,
            },
          });
          if (!winningInvoice) {
            await new Promise((r) => setTimeout(r, 200));
            winningInvoice = await prisma.invoice.findFirst({
              where: {
                tenantId: dbTenantId,
                idempotencyKey: idempotencyKey,
              },
              include: {
                items: true,
                allocations: true,
              },
            });
          }
          if (winningInvoice) {
            return NextResponse.json({
              success: true,
              isDuplicate: true,
              invoice: {
                id: winningInvoice.id,
                invoiceNumber: winningInvoice.number,
                seriesCode: winningInvoice.seriesCode,
                fy: winningInvoice.fy,
                grandTotalPaise: winningInvoice.grandTotal.toString(),
                status: winningInvoice.status,
                createdAt: winningInvoice.createdAt.toISOString(),
                items: winningInvoice.items.map((it) => ({
                  productId: it.productId,
                  name: it.description,
                  qty: Number(it.qty),
                  ratePaise: it.rate.toString(),
                  lineTotalPaise: it.lineTotal.toString(),
                })),
              },
            });
          }
        }

        console.error('Postgres transaction failed for invoice create:', dbErr?.message);
        return NextResponse.json(
          { error: 'Failed to create invoice' },
          { status: 500 }
        );
      }
    }

    // 3. Determine final invoice number for localStore synchronization
    let localSequenceNum: number | undefined = undefined;
    let localInvoiceNumber = dbInvoice?.number;
    let seriesCode = dbInvoice?.seriesCode || 'INV';
    let fy = dbInvoice?.fy || getIndianFinancialYear(invoiceCreatedDate);

    if (!localInvoiceNumber) {
      const allocatedLocal = allocateNextInvoiceNumberLocalStore(targetTenantId, {
        seriesCode,
        date: invoiceCreatedDate,
        fy,
      });
      localInvoiceNumber = allocatedLocal.invoiceNumber;
      localSequenceNum = allocatedLocal.sequenceNumber;
      seriesCode = allocatedLocal.seriesCode;
      fy = allocatedLocal.fy;
    }
    const finalInvoiceNumber = dbInvoice?.number || localInvoiceNumber;

    // 4. Save in localStore for instant local cache availability
    const localInvoice = localStore.createInvoice({
      tenantId: targetTenantId,
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerGstin: customerGstin || undefined,
      invoiceNumber: finalInvoiceNumber,
      idempotencyKey: idempotencyKey || undefined,
      number: localSequenceNum,
      seriesCode,
      fy,
      status: balanceOnCredit === 0n ? 'PAID' : 'ISSUED',
      grandTotalPaise: taxSummary.grandTotal.toString(),
      paidNowPaise: totalPaidNow.toString(),
      creditBalancePaise: balanceOnCredit.toString(),
      createdAt: invoiceCreatedIso,
      items: items.map((it: any) => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        ratePaise: it.ratePaise,
      })),
    });

    // Double-Entry Ledger Posting & Payment Recording in localStore
    if (customerId) {
      localStore.addLedgerEntry({
        tenantId: targetTenantId,
        customerId,
        type: 'INVOICE',
        refNo: finalInvoiceNumber,
        narration: `Sales Bill #${finalInvoiceNumber}`,
        debitPaise: taxSummary.grandTotal.toString(),
        creditPaise: '0',
        date: invoiceCreatedIso.split('T')[0],
        createdAt: invoiceCreatedIso,
      });
    }

    // If paid at counter (full or partial), record payment in localStore
    const cashPaiseVal = BigInt(cashPaidPaise || 0);
    const upiPaiseVal = BigInt(upiPaidPaise || 0);

    if (cashPaiseVal > 0n) {
      localStore.createPayment({
        tenantId: targetTenantId,
        customerId: customerId || undefined,
        amountPaise: cashPaiseVal.toString(),
        mode: 'CASH',
        referenceNumber: `CASH-${finalInvoiceNumber}`,
        createdAt: invoiceCreatedIso,
      });
    }

    if (upiPaiseVal > 0n) {
      localStore.createPayment({
        tenantId: targetTenantId,
        customerId: customerId || undefined,
        amountPaise: upiPaiseVal.toString(),
        mode: 'UPI',
        referenceNumber: upiRef || `UPI-${finalInvoiceNumber}`,
        createdAt: invoiceCreatedIso,
      });
    }

    if (cashPaiseVal <= 0n && upiPaiseVal <= 0n && totalPaidNow > 0n) {
      localStore.createPayment({
        tenantId: targetTenantId,
        customerId: customerId || undefined,
        amountPaise: totalPaidNow.toString(),
        mode: 'CASH',
        referenceNumber: `POS-${finalInvoiceNumber}`,
        createdAt: invoiceCreatedIso,
      });
    }

    if (customerId && totalPaidNow > 0n) {
      localStore.addLedgerEntry({
        tenantId: targetTenantId,
        customerId,
        type: 'PAYMENT',
        refNo: finalInvoiceNumber,
        narration: `Counter Settlement for Bill #${finalInvoiceNumber}`,
        debitPaise: '0',
        creditPaise: totalPaidNow.toString(),
        date: invoiceCreatedIso.split('T')[0],
        createdAt: invoiceCreatedIso,
      });
    }

    if (idempotencyKey) {
      invoiceIdempotencyCache.set(`${targetTenantId}:${idempotencyKey}`, {
        invoice: dbInvoice || localInvoice,
        invoiceNumber: finalInvoiceNumber,
        customerId: customerId || undefined,
        itemCount: items.length,
        grandTotalPaise: taxSummary.grandTotal.toString(),
        taxSummary: {
          taxableValue: taxSummary.taxableValue.toString(),
          totalTax: taxSummary.totalTax.toString(),
          grandTotal: taxSummary.grandTotal.toString(),
        },
        timestamp: Date.now(),
      });
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'INVOICE_CREATED',
      entity: 'INVOICE',
      entityId: (dbInvoice?.id || localInvoice?.id) as string,
      after: {
        invoiceNumber: finalInvoiceNumber,
        grandTotalPaise: taxSummary.grandTotal.toString(),
        itemCount: items.length,
      },
    });

    const invData = dbInvoice || localInvoice;
    const invoiceResponse = {
      ...(typeof invData === 'object' ? invData : {}),
      status: balanceOnCredit === 0n ? 'PAID' : 'ISSUED',
      subtotalPaise: taxSummary.subtotal.toString(),
      grandTotalPaise: taxSummary.grandTotal.toString(),
      paidNowPaise: totalPaidNow.toString(),
      amountPaidPaise: totalPaidNow.toString(),
      creditBalancePaise: balanceOnCredit.toString(),
      balanceDuePaise: balanceOnCredit.toString(),
    };

    return NextResponse.json({
      success: true,
      invoice: invoiceResponse,
      invoiceNumber: finalInvoiceNumber,
      grandTotalPaise: taxSummary.grandTotal.toString(),
      amountPaidPaise: totalPaidNow.toString(),
      balanceDuePaise: balanceOnCredit.toString(),
      taxSummary: {
        subtotal: taxSummary.subtotal.toString(),
        discountTotal: taxSummary.discountTotal.toString(),
        taxableValue: taxSummary.taxableValue.toString(),
        totalTax: taxSummary.totalTax.toString(),
        grandTotal: taxSummary.grandTotal.toString(),
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to issue invoice';
    console.error('Invoice create error:', error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 1. Authenticate and enforce server-side verified identity
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to cancel an invoice' },
        { status: 401 }
      );
    }

    // 2. Enforce Role-Based Authorization: Only OWNER and MANAGER are permitted
    const userRole = (authUser.role || '').toUpperCase();
    if (userRole !== 'OWNER' && userRole !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: Only owners and managers are authorized to cancel invoices' },
        { status: 403 }
      );
    }

    // 3. Enforce Tenant Isolation context
    const userTenantId = authUser.tenantId;
    if (!userTenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing tenant context in session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    let id = searchParams.get('id');
    let reason = searchParams.get('reason') || 'Billing cancellation';

    if (!id) {
      try {
        const body = await req.json();
        if (body.id) id = body.id;
        if (body.reason) reason = body.reason;
      } catch {
        // Query param or empty body
      }
    }

    if (!id || typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }
    id = id.trim();

    // 4. PostgreSQL Persistence Path (Atomic Transaction & Strict Tenant Isolation)
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(id) && isUuid(userTenantId)) {
      try {
        const txResult = await prisma.$transaction(async (tx) => {
          // Strict tenant-scoped query
          const invoice = await tx.invoice.findFirst({
            where: {
              id,
              tenantId: userTenantId,
            },
            include: { items: true, customer: true },
          });

          if (!invoice) {
            return { notFound: true };
          }

          // Idempotency: If already cancelled, return immediately without duplicate mutations
          if (invoice.status === InvoiceStatus.CANCELLED) {
            return { alreadyCancelled: true, invoiceNumber: invoice.number };
          }

          // A. Mark Invoice as CANCELLED and zero out balance due
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: InvoiceStatus.CANCELLED,
              cancelReason: reason,
              balanceDue: 0n,
            },
          });

          // B. Restore Stock Movements for items (RETURN_IN)
          for (const item of invoice.items) {
            if (item.productId) {
              await tx.stockMovement.create({
                data: {
                  tenantId: invoice.tenantId,
                  productId: item.productId,
                  qty: Number(item.qty),
                  reason: StockReason.RETURN_IN,
                  refType: 'INVOICE_CANCEL',
                  refId: invoice.id,
                  unitCost: item.rate,
                  createdBy: authUser.id,
                },
              });
            }
          }

          // C. Reverse Customer Khata Ledger Entry
          if (invoice.customerId) {
            await tx.ledgerEntry.create({
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

            // Recompute Customer Running Balance & Health Status
            const customer = await tx.customer.findUnique({
              where: { id: invoice.customerId },
              include: { ledgerEntries: { select: { debit: true, credit: true } } },
            });

            if (customer) {
              const runningBal = customer.ledgerEntries.reduce((sum, e) => sum + e.debit - e.credit, 0n);
              await tx.customer.update({
                where: { id: invoice.customerId },
                data: {
                  status: runningBal <= customer.creditLimit ? CreditStatus.GREEN : CreditStatus.YELLOW,
                },
              });
            }
          }

          // D. Record Invoice Event Audit Trail
          await tx.invoiceEvent.create({
            data: {
              invoiceId: invoice.id,
              event: 'CANCELLED',
              meta: {
                cancelledBy: authUser.id,
                cancelledByRole: userRole,
                reason,
                timestamp: new Date().toISOString(),
              },
            },
          });

          // E. Record Immutable Audit Trail Entry
          await createAuditLog({
            tenantId: invoice.tenantId,
            userId: authUser.id,
            action: 'INVOICE_CANCELLED',
            entity: 'INVOICE',
            entityId: invoice.id,
            after: {
              invoiceNumber: invoice.number,
              reason,
              cancelledByRole: userRole,
            },
          }, tx);

          return { success: true, invoiceNumber: invoice.number };
        }, { maxWait: 10000, timeout: 25000 });

        if (txResult.notFound) {
          return NextResponse.json(
            { error: 'Invoice not found in your organization' },
            { status: 404 }
          );
        }

        if (txResult.alreadyCancelled) {
          return NextResponse.json({
            success: true,
            alreadyCancelled: true,
            message: 'Invoice is already cancelled',
            invoiceNumber: txResult.invoiceNumber,
          });
        }

        // Keep localStore in sync if present
        if (typeof localStore.cancelInvoice === 'function') {
          localStore.cancelInvoice(id, reason);
        }

        return NextResponse.json({
          success: true,
          message: 'Invoice cancelled successfully. Inventory stock and Khata ledger have been reversed.',
          invoiceNumber: txResult.invoiceNumber,
        });
      } catch (dbErr: any) {
        console.error('PostgreSQL invoice cancellation transaction error:', dbErr?.message || dbErr);
        return NextResponse.json(
          { error: 'Database transaction failed during invoice cancellation' },
          { status: 500 }
        );
      }
    }

    // 5. LocalStore Persistence Fallback (Strict Tenant Isolation)
    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Cancellation cannot be safely processed.' },
        { status: 503 }
      );
    }

    const localInvoices = localStore.getInvoices(userTenantId);
    const localInvoice = localInvoices.find((inv) => inv.id === id || inv.invoiceNumber === id);

    if (!localInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found in your organization' },
        { status: 404 }
      );
    }

    if (localInvoice.status === 'CANCELLED') {
      return NextResponse.json({
        success: true,
        alreadyCancelled: true,
        storage: 'localStore',
        message: 'Invoice is already cancelled',
      });
    }

    localStore.cancelInvoice(localInvoice.id, reason, userTenantId);

    await createAuditLog({
      tenantId: userTenantId,
      userId: authUser.id,
      action: 'INVOICE_CANCELLED',
      entity: 'INVOICE',
      entityId: localInvoice.id,
      after: {
        invoiceNumber: localInvoice.invoiceNumber,
        reason,
        cancelledByRole: userRole,
      },
    });

    return NextResponse.json({
      success: true,
      storage: 'localStore',
      message: 'Invoice cancelled successfully in local store. Inventory stock and Khata ledger have been reversed.',
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to cancel invoice';
    console.error('Invoice cancel error:', errMsg);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
