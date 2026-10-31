import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable, getStorageMode } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { createAuditLog } from '@/server/lib/audit';
import {
  Prisma,
  CreditStatus,
  CustomerType,
  InvoiceStatus,
  InvoiceType,
  StockReason,
  PaymentMode,
  PaymentStatus,
  LedgerEntryType,
  PurchaseOrderStatus,
} from '@prisma/client';

export const dynamic = 'force-dynamic';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Safe BigInt and Date serialization helper
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj.toISOString();
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeBigInt(obj[key]);
    }
    return res;
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/backup - Transactionally Consistent Snapshot Export
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }

    if (authUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: only the business OWNER can export database backups' },
        { status: 403 }
      );
    }

    const targetTenantId = authUser.tenantId;

    let snapshot: any = {
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      platform: 'TradeLedger Universal B2B Wholesale & Khata ERP',
      tenantId: targetTenantId,
      data: {
        tenants: [] as any[],
        users: [] as any[],
        invoiceSeries: [] as any[],
        bikeModels: [] as any[],
        suppliers: [] as any[],
        products: [] as any[],
        stockMovements: [] as any[],
        customers: [] as any[],
        invoices: [] as any[],
        payments: [] as any[],
        paymentAllocations: [] as any[],
        ledgerEntries: [] as any[],
        invoiceEvents: [] as any[],
        creditNotes: [] as any[],
        accounts: [] as any[],
        glEntries: [] as any[],
        journalVouchers: [] as any[],
        debitNotes: [] as any[],
        purchaseOrders: [] as any[],
        goodsReceipts: [] as any[],
      },
    };

    const hasDb = await isPostgresAvailable();
    let postgresSucceeded = false;
    if (hasDb && isUuid(targetTenantId)) {
      try {
        // Execute queries inside a single PostgreSQL transaction with RepeatableRead
        // isolation level to guarantee a transactionally consistent point-in-time snapshot.
        const txData = await prisma.$transaction(
          async (tx) => {
            const tenant = await tx.tenant.findUnique({
              where: { id: targetTenantId },
            });

            // Exclude password and totpSecret for security
            const users = await tx.user.findMany({
              where: { tenantId: targetTenantId },
              select: {
                id: true,
                tenantId: true,
                name: true,
                phone: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            });

            const invoiceSeries = await tx.invoiceSeries.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { seriesCode: 'asc' },
            });

            const bikeModels = await tx.bikeModel.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { make: 'asc' },
            });

            const suppliers = await tx.supplier.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { name: 'asc' },
            });

            const products = await tx.product.findMany({
              where: { tenantId: targetTenantId },
              include: {
                compatibilities: true,
              },
              orderBy: { name: 'asc' },
            });

            const stockMovements = await tx.stockMovement.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { createdAt: 'asc' },
            });

            const customers = await tx.customer.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { createdAt: 'asc' },
            });

            const invoices = await tx.invoice.findMany({
              where: { tenantId: targetTenantId },
              include: {
                items: true,
                events: true,
              },
              orderBy: { createdAt: 'asc' },
            });

            const payments = await tx.payment.findMany({
              where: { tenantId: targetTenantId },
              include: {
                allocations: true,
              },
              orderBy: { createdAt: 'asc' },
            });

            const paymentAllocations = await tx.paymentAllocation.findMany({
              where: { payment: { tenantId: targetTenantId } },
              orderBy: { createdAt: 'asc' },
            });

            const ledgerEntries = await tx.ledgerEntry.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { createdAt: 'asc' },
            });

            const invoiceEvents = await tx.invoiceEvent.findMany({
              where: { invoice: { tenantId: targetTenantId } },
              orderBy: { createdAt: 'asc' },
            });

            const creditNotes = await tx.creditNote.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { createdAt: 'asc' },
            });

            const accounts = await tx.account.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { code: 'asc' },
            });

            const glEntries = await tx.gLEntry.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { createdAt: 'asc' },
            });

            const journalVouchers = await tx.journalVoucher.findMany({
              where: { tenantId: targetTenantId },
              include: { lines: true },
              orderBy: { createdAt: 'asc' },
            });

            const debitNotes = await tx.debitNote.findMany({
              where: { tenantId: targetTenantId },
              orderBy: { createdAt: 'asc' },
            });

            const purchaseOrders = await tx.purchaseOrder.findMany({
              where: { tenantId: targetTenantId },
              include: { items: true },
              orderBy: { createdAt: 'asc' },
            });

            const goodsReceipts = await tx.goodsReceipt.findMany({
              where: { tenantId: targetTenantId },
              include: { lines: true },
              orderBy: { createdAt: 'asc' },
            });

            return {
              tenant,
              users,
              invoiceSeries,
              bikeModels,
              suppliers,
              products,
              stockMovements,
              customers,
              invoices,
              payments,
              paymentAllocations,
              ledgerEntries,
              invoiceEvents,
              creditNotes,
              accounts,
              glEntries,
              journalVouchers,
              debitNotes,
              purchaseOrders,
              goodsReceipts,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            timeout: 60000,
          }
        );

        snapshot.data = serializeBigInt({
          tenants: txData.tenant ? [txData.tenant] : [],
          users: txData.users,
          invoiceSeries: txData.invoiceSeries,
          bikeModels: txData.bikeModels,
          suppliers: txData.suppliers,
          products: txData.products.map((p) => ({
            ...p,
            purchasePricePaise: p.purchasePrice?.toString() || '0',
            salePricePaise: p.salePrice?.toString() || '0',
            mrpPaise: p.mrp?.toString() || '0',
            stockQty: txData.stockMovements.filter((m) => m.productId === p.id).reduce((sum, m) => sum + m.qty, 0),
          })),
          stockMovements: txData.stockMovements.map((m) => ({
            ...m,
            unitCostPaise: m.unitCost?.toString() || '0',
          })),
          customers: txData.customers.map((c) => ({
            ...c,
            creditLimitPaise: c.creditLimit.toString(),
            termsDays: c.paymentTermsDays,
          })),
          invoices: txData.invoices.map((inv) => ({
            ...inv,
            subtotalPaise: inv.subtotal.toString(),
            discountTotalPaise: inv.discountTotal.toString(),
            taxableValuePaise: inv.taxableValue.toString(),
            cgstPaise: inv.cgst.toString(),
            sgstPaise: inv.sgst.toString(),
            igstPaise: inv.igst.toString(),
            roundOffPaise: inv.roundOff.toString(),
            grandTotalPaise: inv.grandTotal.toString(),
            paidNowPaise: inv.paidNow.toString(),
            amountPaidPaise: inv.amountPaid.toString(),
            balanceDuePaise: inv.balanceDue.toString(),
            items: inv.items.map((it) => ({
              ...it,
              qty: it.qty.toString(),
              ratePaise: it.rate.toString(),
              discountPaise: it.discount.toString(),
              taxableValuePaise: it.taxableValue.toString(),
              taxAmountPaise: it.taxAmount.toString(),
              lineTotalPaise: it.lineTotal.toString(),
            })),
          })),
          payments: txData.payments.map((pay) => ({
            ...pay,
            amountPaise: pay.amount.toString(),
          })),
          paymentAllocations: txData.paymentAllocations.map((alloc) => ({
            ...alloc,
            amountPaise: alloc.amount.toString(),
          })),
          ledgerEntries: txData.ledgerEntries.map((l) => ({
            ...l,
            debitPaise: l.debit.toString(),
            creditPaise: l.credit.toString(),
          })),
          invoiceEvents: txData.invoiceEvents,
          creditNotes: txData.creditNotes.map((cn) => ({
            ...cn,
            amountPaise: cn.amount.toString(),
          })),
          accounts: txData.accounts.map((a) => ({
            ...a,
            openingDrPaise: a.openingDr.toString(),
            openingCrPaise: a.openingCr.toString(),
          })),
          glEntries: txData.glEntries.map((g) => ({
            ...g,
            debitPaise: g.debit.toString(),
            creditPaise: g.credit.toString(),
          })),
          journalVouchers: txData.journalVouchers.map((jv) => ({
            ...jv,
            lines: jv.lines.map((l) => ({
              ...l,
              debitPaise: l.debit.toString(),
              creditPaise: l.credit.toString(),
            })),
          })),
          debitNotes: txData.debitNotes.map((dn) => ({
            ...dn,
            amountPaise: dn.amount.toString(),
          })),
          purchaseOrders: txData.purchaseOrders.map((po) => ({
            ...po,
            subtotalPaise: po.subtotal.toString(),
            taxTotalPaise: po.taxTotal.toString(),
            grandTotalPaise: po.grandTotal.toString(),
            items: po.items.map((it) => ({
              ...it,
              qtyOrdered: it.qtyOrdered.toString(),
              qtyReceived: it.qtyReceived.toString(),
              ratePaise: it.rate.toString(),
              taxableValuePaise: it.taxableValue.toString(),
              taxAmountPaise: it.taxAmount.toString(),
              lineTotalPaise: it.lineTotal.toString(),
            })),
          })),
          goodsReceipts: txData.goodsReceipts.map((grn) => ({
            ...grn,
            totalAmountPaise: grn.totalAmount.toString(),
            lines: grn.lines.map((l) => ({
              ...l,
              qtyReceived: l.qtyReceived.toString(),
              unitCostPaise: l.unitCost.toString(),
              lineTotalPaise: l.lineTotal.toString(),
            })),
          })),
        });
        postgresSucceeded = true;
      } catch (dbErr) {
        console.warn('Database transactional snapshot read failed, falling back to localStore:', dbErr);
      }
    }

    // Fallback if Postgres was offline or failed - strictly scoped to targetTenantId
    if (!postgresSucceeded) {
      const localTenant = localStore.getTenantById(targetTenantId);
      const localUsers = localStore.getUsers(targetTenantId);
      const localProducts = localStore.getProducts(targetTenantId);
      const localCusts = localStore.getCustomers(targetTenantId);
      const localInvs = localStore.getInvoices(targetTenantId);
      const localPays = localStore.getPayments(targetTenantId);

      snapshot.data = {
        tenants: localTenant ? [localTenant] : [],
        users: localUsers.map((u) => ({
          id: u.id,
          tenantId: u.tenantId,
          name: u.name,
          phone: u.phone,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
        })),
        invoiceSeries: [],
        bikeModels: [],
        suppliers: [],
        products: localProducts,
        stockMovements: [],
        customers: localCusts,
        invoices: localInvs,
        payments: localPays,
        paymentAllocations: [],
        ledgerEntries: [],
        invoiceEvents: [],
        creditNotes: [],
        accounts: [],
        glEntries: [],
        journalVouchers: [],
        debitNotes: [],
        purchaseOrders: [],
        goodsReceipts: [],
      };
    }

    // Summary stats
    snapshot.stats = {
      tenantsCount: snapshot.data.tenants.length,
      usersCount: snapshot.data.users.length,
      invoiceSeriesCount: snapshot.data.invoiceSeries.length,
      productsCount: snapshot.data.products.length,
      stockMovementsCount: snapshot.data.stockMovements.length,
      customersCount: snapshot.data.customers.length,
      invoicesCount: snapshot.data.invoices.length,
      paymentsCount: snapshot.data.payments.length,
      paymentAllocationsCount: snapshot.data.paymentAllocations.length,
      ledgerEntriesCount: snapshot.data.ledgerEntries.length,
      invoiceEventsCount: snapshot.data.invoiceEvents.length,
    };

    const filename = `tradeledger-backup-${targetTenantId}-${new Date().toISOString().split('T')[0]}.json`;

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'BACKUP_EXPORTED',
      entity: 'TENANT',
      entityId: targetTenantId,
      after: { stats: snapshot.stats, format: snapshot.version },
    });

    return NextResponse.json(
      {
        success: true,
        backup: snapshot,
      },
      {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error generating backup:', error);
    return NextResponse.json({ error: error.message || 'Backup generation failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/backup - Transactional Safe Idempotent Restore
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }

    if (authUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: only the business OWNER can restore backups' },
        { status: 403 }
      );
    }

    const targetTenantId = authUser.tenantId;
    const body = await req.json();

    const backupData = body.backup || body;
    if (!backupData || !backupData.data) {
      return NextResponse.json({ error: 'Invalid backup format. Missing data payload.' }, { status: 400 });
    }

    // Validate backup format version
    const version = backupData.version || '1.0.0';
    if (!['1.0.0', '1.1.0'].includes(version)) {
      return NextResponse.json(
        { error: `Unsupported backup version "${version}". Supported versions: 1.0.0, 1.1.0` },
        { status: 400 }
      );
    }

    const {
      tenants = [],
      invoiceSeries = [],
      bikeModels = [],
      suppliers = [],
      products = [],
      stockMovements = [],
      customers = [],
      invoices = [],
      payments = [],
      paymentAllocations = [],
      ledgerEntries = [],
      invoiceEvents = [],
      creditNotes = [],
      accounts = [],
      glEntries = [],
      journalVouchers = [],
      debitNotes = [],
      purchaseOrders = [],
      goodsReceipts = [],
    } = backupData.data;

    let restoredStats = {
      tenants: 0,
      invoiceSeries: 0,
      bikeModels: 0,
      suppliers: 0,
      products: 0,
      stockMovements: 0,
      customers: 0,
      invoices: 0,
      invoiceItems: 0,
      invoiceEvents: 0,
      payments: 0,
      paymentAllocations: 0,
      ledgerEntries: 0,
      creditNotes: 0,
      accounts: 0,
      glEntries: 0,
      journalVouchers: 0,
      debitNotes: 0,
      purchaseOrders: 0,
      goodsReceipts: 0,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Pre-Validation & Tenant Boundary Security Checks
    // ─────────────────────────────────────────────────────────────────────────
    const hasDb = await isPostgresAvailable();

    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Backup restore cannot be safely executed.' },
        { status: 503 }
      );
    }

    if (hasDb && isUuid(targetTenantId)) {
      // 1. Cross-tenant collision checks: ensure no ID belongs to a foreign tenant
      const custIds = customers.map((c: any) => c.id).filter(isUuid);
      if (custIds.length > 0) {
        const foreignCust = await prisma.customer.findFirst({
          where: { id: { in: custIds }, tenantId: { not: targetTenantId } },
          select: { id: true, tenantId: true },
        });
        if (foreignCust) {
          return NextResponse.json(
            { error: `Cross-tenant collision: Customer ${foreignCust.id} belongs to another tenant.` },
            { status: 409 }
          );
        }
      }

      const prodIds = products.map((p: any) => p.id).filter(isUuid);
      if (prodIds.length > 0) {
        const foreignProd = await prisma.product.findFirst({
          where: { id: { in: prodIds }, tenantId: { not: targetTenantId } },
          select: { id: true, tenantId: true },
        });
        if (foreignProd) {
          return NextResponse.json(
            { error: `Cross-tenant collision: Product ${foreignProd.id} belongs to another tenant.` },
            { status: 409 }
          );
        }
      }

      const invIds = invoices.map((i: any) => i.id).filter(isUuid);
      if (invIds.length > 0) {
        const foreignInv = await prisma.invoice.findFirst({
          where: { id: { in: invIds }, tenantId: { not: targetTenantId } },
          select: { id: true, tenantId: true },
        });
        if (foreignInv) {
          return NextResponse.json(
            { error: `Cross-tenant collision: Invoice ${foreignInv.id} belongs to another tenant.` },
            { status: 409 }
          );
        }
      }

      const payIds = payments.map((p: any) => p.id).filter(isUuid);
      if (payIds.length > 0) {
        const foreignPay = await prisma.payment.findFirst({
          where: { id: { in: payIds }, tenantId: { not: targetTenantId } },
          select: { id: true, tenantId: true },
        });
        if (foreignPay) {
          return NextResponse.json(
            { error: `Cross-tenant collision: Payment ${foreignPay.id} belongs to another tenant.` },
            { status: 409 }
          );
        }
      }

      // 2. Referential integrity pre-validation inside payload
      const payloadCustIdSet = new Set(customers.map((c: any) => c.id));
      const payloadProdIdSet = new Set(products.map((p: any) => p.id));
      const payloadInvIdSet = new Set(invoices.map((i: any) => i.id));
      const payloadPayIdSet = new Set(payments.map((p: any) => p.id));

      for (const inv of invoices) {
        if (inv.customerId && !payloadCustIdSet.has(inv.customerId)) {
          // Check if customer exists in target tenant DB
          const exists = await prisma.customer.findFirst({
            where: { id: inv.customerId, tenantId: targetTenantId },
          });
          if (!exists) {
            return NextResponse.json(
              { error: `Referential integrity broken: Invoice ${inv.id} references missing customer ${inv.customerId}` },
              { status: 400 }
            );
          }
        }
      }

      for (const pay of payments) {
        if (pay.customerId && !payloadCustIdSet.has(pay.customerId)) {
          const exists = await prisma.customer.findFirst({
            where: { id: pay.customerId, tenantId: targetTenantId },
          });
          if (!exists) {
            return NextResponse.json(
              { error: `Referential integrity broken: Payment ${pay.id} references missing customer ${pay.customerId}` },
              { status: 400 }
            );
          }
        }
      }

      for (const alloc of paymentAllocations) {
        const payValid = payloadPayIdSet.has(alloc.paymentId);
        const invValid = payloadInvIdSet.has(alloc.invoiceId);
        if (!payValid) {
          const exists = await prisma.payment.findFirst({
            where: { id: alloc.paymentId, tenantId: targetTenantId },
          });
          if (!exists) {
            return NextResponse.json(
              { error: `Referential integrity broken: PaymentAllocation ${alloc.id} references missing payment ${alloc.paymentId}` },
              { status: 400 }
            );
          }
        }
        if (!invValid) {
          const exists = await prisma.invoice.findFirst({
            where: { id: alloc.invoiceId, tenantId: targetTenantId },
          });
          if (!exists) {
            return NextResponse.json(
              { error: `Referential integrity broken: PaymentAllocation ${alloc.id} references missing invoice ${alloc.invoiceId}` },
              { status: 400 }
            );
          }
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // Phase 2: Transactional Idempotent Upsert
      // ───────────────────────────────────────────────────────────────────────
      try {
        await prisma.$transaction(
          async (tx) => {
            // 1. Tenant configuration upsert
            const matchingTenant = tenants.find((t: any) => t.id === targetTenantId) || tenants[0];
            if (matchingTenant) {
              await tx.tenant.upsert({
                where: { id: targetTenantId },
                update: {
                  name: matchingTenant.name,
                  legalName: matchingTenant.legalName || matchingTenant.name,
                  gstin: matchingTenant.gstin,
                  address: matchingTenant.address,
                  stateCode: matchingTenant.stateCode,
                  upiId: matchingTenant.upiId,
                  bankDetails: matchingTenant.bankDetails || {},
                  settings: matchingTenant.settings || {},
                },
                create: {
                  id: targetTenantId,
                  name: matchingTenant.name || 'Dealership',
                  legalName: matchingTenant.legalName || matchingTenant.name,
                  gstin: matchingTenant.gstin,
                  address: matchingTenant.address,
                  stateCode: matchingTenant.stateCode,
                  upiId: matchingTenant.upiId,
                  bankDetails: matchingTenant.bankDetails || {},
                  settings: matchingTenant.settings || {},
                },
              });
              restoredStats.tenants++;
            }

            // 2. InvoiceSeries: idempotent upsert preserving high watermark
            for (const s of invoiceSeries) {
              const seriesCode = s.seriesCode || 'INV';
              const fy = s.fy || '2026-27';
              const existing = await tx.invoiceSeries.findUnique({
                where: {
                  tenantId_seriesCode_fy: {
                    tenantId: targetTenantId,
                    seriesCode,
                    fy,
                  },
                },
              });
              const finalLastNumber = existing
                ? Math.max(existing.lastNumber, Number(s.lastNumber || 0))
                : Number(s.lastNumber || 0);

              await tx.invoiceSeries.upsert({
                where: {
                  tenantId_seriesCode_fy: {
                    tenantId: targetTenantId,
                    seriesCode,
                    fy,
                  },
                },
                update: {
                  lastNumber: finalLastNumber,
                  prefix: s.prefix || `${seriesCode}/${fy}/`,
                },
                create: {
                  tenantId: targetTenantId,
                  seriesCode,
                  fy,
                  prefix: s.prefix || `${seriesCode}/${fy}/`,
                  lastNumber: finalLastNumber,
                },
              });
              restoredStats.invoiceSeries++;
            }

            // 3. BikeModels
            for (const bm of bikeModels) {
              if (!isUuid(bm.id)) continue;
              await tx.bikeModel.upsert({
                where: { id: bm.id },
                update: {
                  make: bm.make,
                  model: bm.model,
                  yearFrom: bm.yearFrom ? Number(bm.yearFrom) : null,
                  yearTo: bm.yearTo ? Number(bm.yearTo) : null,
                },
                create: {
                  id: bm.id,
                  tenantId: targetTenantId,
                  make: bm.make,
                  model: bm.model,
                  yearFrom: bm.yearFrom ? Number(bm.yearFrom) : null,
                  yearTo: bm.yearTo ? Number(bm.yearTo) : null,
                },
              });
              restoredStats.bikeModels++;
            }

            // 4. Suppliers
            for (const sup of suppliers) {
              if (!isUuid(sup.id)) continue;
              await tx.supplier.upsert({
                where: { id: sup.id },
                update: {
                  name: sup.name,
                  phone: sup.phone,
                  gstin: sup.gstin,
                  address: sup.address,
                  email: sup.email,
                  creditDays: Number(sup.creditDays || 30),
                },
                create: {
                  id: sup.id,
                  tenantId: targetTenantId,
                  name: sup.name,
                  phone: sup.phone,
                  gstin: sup.gstin,
                  address: sup.address,
                  email: sup.email,
                  creditDays: Number(sup.creditDays || 30),
                },
              });
              restoredStats.suppliers++;
            }

            // 5. Products
            for (const p of products) {
              if (!isUuid(p.id)) continue;
              const prod = await tx.product.upsert({
                where: { id: p.id },
                update: {
                  name: p.name,
                  partNumber: p.partNumber,
                  brand: p.brand,
                  category: p.category,
                  hsnCode: p.hsnCode || '8714',
                  gstRateBp: Number(p.gstRateBp || 1800),
                  unit: p.unit || 'pcs',
                  purchasePrice: BigInt(p.purchasePricePaise || p.purchasePrice || '0'),
                  salePrice: BigInt(p.salePricePaise || p.salePrice || '0'),
                  mrp: BigInt(p.mrpPaise || p.mrp || '0'),
                  reorderLevel: Number(p.reorderLevel || 5),
                  isActive: p.isActive !== undefined ? p.isActive : true,
                },
                create: {
                  id: p.id,
                  tenantId: targetTenantId,
                  name: p.name,
                  partNumber: p.partNumber,
                  brand: p.brand,
                  category: p.category,
                  hsnCode: p.hsnCode || '8714',
                  gstRateBp: Number(p.gstRateBp || 1800),
                  unit: p.unit || 'pcs',
                  purchasePrice: BigInt(p.purchasePricePaise || p.purchasePrice || '0'),
                  salePrice: BigInt(p.salePricePaise || p.salePrice || '0'),
                  mrp: BigInt(p.mrpPaise || p.mrp || '0'),
                  reorderLevel: Number(p.reorderLevel || 5),
                  isActive: p.isActive !== undefined ? p.isActive : true,
                },
              });

              // Compatibilities if provided
              if (Array.isArray(p.compatibilities)) {
                for (const comp of p.compatibilities) {
                  if (comp.bikeModelId && isUuid(comp.bikeModelId)) {
                    await tx.productCompatibility.upsert({
                      where: {
                        productId_bikeModelId: {
                          productId: prod.id,
                          bikeModelId: comp.bikeModelId,
                        },
                      },
                      update: {},
                      create: {
                        productId: prod.id,
                        bikeModelId: comp.bikeModelId,
                      },
                    });
                  }
                }
              }

              // Handle legacy backup format where stockQty was on product without stock movements
              if (stockMovements.length === 0 && p.stockQty && Number(p.stockQty) > 0) {
                const currentMovements = await tx.stockMovement.findMany({
                  where: { productId: prod.id, tenantId: targetTenantId },
                });
                if (currentMovements.length === 0) {
                  await tx.stockMovement.create({
                    data: {
                      tenantId: targetTenantId,
                      productId: prod.id,
                      qty: Number(p.stockQty),
                      reason: StockReason.OPENING,
                      unitCost: BigInt(p.purchasePricePaise || '0'),
                    },
                  });
                }
              }

              restoredStats.products++;
            }

            // 6. Stock Movements (if present in backup)
            for (const sm of stockMovements) {
              if (!isUuid(sm.id) || !isUuid(sm.productId)) continue;
              const existingMove = await tx.stockMovement.findUnique({ where: { id: sm.id } });
              if (!existingMove) {
                await tx.stockMovement.create({
                  data: {
                    id: sm.id,
                    tenantId: targetTenantId,
                    productId: sm.productId,
                    qty: Number(sm.qty),
                    reason: (sm.reason as StockReason) || StockReason.OPENING,
                    refType: sm.refType || null,
                    refId: sm.refId && isUuid(sm.refId) ? sm.refId : null,
                    unitCost: sm.unitCostPaise || sm.unitCost ? BigInt(sm.unitCostPaise || sm.unitCost) : null,
                    createdBy: sm.createdBy && isUuid(sm.createdBy) ? sm.createdBy : null,
                    createdAt: sm.createdAt ? new Date(sm.createdAt) : new Date(),
                  },
                });
                restoredStats.stockMovements++;
              }
            }

            // 7. Customers
            for (const c of customers) {
              if (!isUuid(c.id)) continue;
              await tx.customer.upsert({
                where: { id: c.id },
                update: {
                  name: c.name,
                  shopName: c.shopName || c.name,
                  phone: c.phone || null,
                  address: c.address,
                  gstin: c.gstin,
                  customerType: (c.customerType as CustomerType) || CustomerType.GARAGE,
                  creditLimit: BigInt(c.creditLimitPaise || c.creditLimit || '5000000'),
                  paymentTermsDays: Number(c.termsDays || c.paymentTermsDays || 15),
                  status: (c.status as CreditStatus) || CreditStatus.GREEN,
                  isActive: c.isActive !== undefined ? c.isActive : true,
                },
                create: {
                  id: c.id,
                  tenantId: targetTenantId,
                  name: c.name,
                  shopName: c.shopName || c.name,
                  phone: c.phone || null,
                  address: c.address,
                  gstin: c.gstin,
                  customerType: (c.customerType as CustomerType) || CustomerType.GARAGE,
                  creditLimit: BigInt(c.creditLimitPaise || c.creditLimit || '5000000'),
                  paymentTermsDays: Number(c.termsDays || c.paymentTermsDays || 15),
                  status: (c.status as CreditStatus) || CreditStatus.GREEN,
                  isActive: c.isActive !== undefined ? c.isActive : true,
                },
              });
              restoredStats.customers++;
            }

            // 8. Invoices and InvoiceItems
            for (const inv of invoices) {
              if (!isUuid(inv.id)) continue;
              await tx.invoice.upsert({
                where: { id: inv.id },
                update: {
                  customerId: inv.customerId && isUuid(inv.customerId) ? inv.customerId : null,
                  invoiceType: (inv.invoiceType as InvoiceType) || InvoiceType.TAX_INVOICE,
                  number: inv.number || inv.invoiceNumber || null,
                  seriesCode: inv.seriesCode || null,
                  fy: inv.fy || null,
                  status: (inv.status as InvoiceStatus) || InvoiceStatus.ISSUED,
                  issueDate: inv.issueDate ? new Date(inv.issueDate) : null,
                  dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
                  placeOfSupply: inv.placeOfSupply || null,
                  subtotal: BigInt(inv.subtotalPaise || inv.subtotal || '0'),
                  discountTotal: BigInt(inv.discountTotalPaise || inv.discountTotal || '0'),
                  taxableValue: BigInt(inv.taxableValuePaise || inv.taxableValue || '0'),
                  cgst: BigInt(inv.cgstPaise || inv.cgst || '0'),
                  sgst: BigInt(inv.sgstPaise || inv.sgst || '0'),
                  igst: BigInt(inv.igstPaise || inv.igst || '0'),
                  roundOff: BigInt(inv.roundOffPaise || inv.roundOff || '0'),
                  grandTotal: BigInt(inv.grandTotalPaise || inv.grandTotal || '0'),
                  paidNow: BigInt(inv.paidNowPaise || inv.paidNow || '0'),
                  amountPaid: BigInt(inv.amountPaidPaise || inv.amountPaid || '0'),
                  balanceDue: BigInt(inv.balanceDuePaise || inv.balanceDue || inv.creditBalancePaise || '0'),
                  version: inv.version ? Number(inv.version) : 1,
                  cancelReason: inv.cancelReason || null,
                  idempotencyKey: inv.idempotencyKey || null,
                  notes: inv.notes || null,
                  terms: inv.terms || null,
                  createdBy: inv.createdBy && isUuid(inv.createdBy) ? inv.createdBy : null,
                  issuedAt: inv.issuedAt ? new Date(inv.issuedAt) : null,
                  createdAt: inv.createdAt ? new Date(inv.createdAt) : new Date(),
                },
                create: {
                  id: inv.id,
                  tenantId: targetTenantId,
                  customerId: inv.customerId && isUuid(inv.customerId) ? inv.customerId : null,
                  invoiceType: (inv.invoiceType as InvoiceType) || InvoiceType.TAX_INVOICE,
                  number: inv.number || inv.invoiceNumber || null,
                  seriesCode: inv.seriesCode || null,
                  fy: inv.fy || null,
                  status: (inv.status as InvoiceStatus) || InvoiceStatus.ISSUED,
                  issueDate: inv.issueDate ? new Date(inv.issueDate) : null,
                  dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
                  placeOfSupply: inv.placeOfSupply || null,
                  subtotal: BigInt(inv.subtotalPaise || inv.subtotal || '0'),
                  discountTotal: BigInt(inv.discountTotalPaise || inv.discountTotal || '0'),
                  taxableValue: BigInt(inv.taxableValuePaise || inv.taxableValue || '0'),
                  cgst: BigInt(inv.cgstPaise || inv.cgst || '0'),
                  sgst: BigInt(inv.sgstPaise || inv.sgst || '0'),
                  igst: BigInt(inv.igstPaise || inv.igst || '0'),
                  roundOff: BigInt(inv.roundOffPaise || inv.roundOff || '0'),
                  grandTotal: BigInt(inv.grandTotalPaise || inv.grandTotal || '0'),
                  paidNow: BigInt(inv.paidNowPaise || inv.paidNow || '0'),
                  amountPaid: BigInt(inv.amountPaidPaise || inv.amountPaid || '0'),
                  balanceDue: BigInt(inv.balanceDuePaise || inv.balanceDue || inv.creditBalancePaise || '0'),
                  version: inv.version ? Number(inv.version) : 1,
                  cancelReason: inv.cancelReason || null,
                  idempotencyKey: inv.idempotencyKey || null,
                  notes: inv.notes || null,
                  terms: inv.terms || null,
                  createdBy: inv.createdBy && isUuid(inv.createdBy) ? inv.createdBy : null,
                  issuedAt: inv.issuedAt ? new Date(inv.issuedAt) : null,
                  createdAt: inv.createdAt ? new Date(inv.createdAt) : new Date(),
                },
              });
              restoredStats.invoices++;

              // Items
              if (Array.isArray(inv.items)) {
                for (const it of inv.items) {
                  if (!isUuid(it.id)) continue;
                  await tx.invoiceItem.upsert({
                    where: { id: it.id },
                    update: {
                      productId: it.productId && isUuid(it.productId) ? it.productId : null,
                      description: it.description || it.name || 'Spare Part',
                      hsnCode: it.hsnCode || '8714',
                      qty: new Prisma.Decimal(it.qty || 1),
                      unit: it.unit || 'pcs',
                      rate: BigInt(it.ratePaise || it.rate || it.unitRatePaise || '0'),
                      discount: BigInt(it.discountPaise || it.discount || '0'),
                      taxableValue: BigInt(it.taxableValuePaise || it.taxableValue || it.lineTotal || '0'),
                      gstRateBp: Number(it.gstRateBp || 0),
                      taxAmount: BigInt(it.taxAmountPaise || it.taxAmount || '0'),
                      lineTotal: BigInt(it.lineTotalPaise || it.lineTotal || it.totalPaise || '0'),
                    },
                    create: {
                      id: it.id,
                      invoiceId: inv.id,
                      productId: it.productId && isUuid(it.productId) ? it.productId : null,
                      description: it.description || it.name || 'Spare Part',
                      hsnCode: it.hsnCode || '8714',
                      qty: new Prisma.Decimal(it.qty || 1),
                      unit: it.unit || 'pcs',
                      rate: BigInt(it.ratePaise || it.rate || it.unitRatePaise || '0'),
                      discount: BigInt(it.discountPaise || it.discount || '0'),
                      taxableValue: BigInt(it.taxableValuePaise || it.taxableValue || it.lineTotal || '0'),
                      gstRateBp: Number(it.gstRateBp || 0),
                      taxAmount: BigInt(it.taxAmountPaise || it.taxAmount || '0'),
                      lineTotal: BigInt(it.lineTotalPaise || it.lineTotal || it.totalPaise || '0'),
                    },
                  });
                  restoredStats.invoiceItems++;
                }
              }
            }

            // 9. Invoice Events
            for (const ev of invoiceEvents) {
              if (!isUuid(ev.id) || !isUuid(ev.invoiceId)) continue;
              const existingEvent = await tx.invoiceEvent.findUnique({ where: { id: ev.id } });
              if (!existingEvent) {
                await tx.invoiceEvent.create({
                  data: {
                    id: ev.id,
                    invoiceId: ev.invoiceId,
                    event: ev.event,
                    meta: ev.meta || {},
                    createdAt: ev.createdAt ? new Date(ev.createdAt) : new Date(),
                  },
                });
                restoredStats.invoiceEvents++;
              }
            }

            // 10. Payments
            for (const pay of payments) {
              if (!isUuid(pay.id) || !isUuid(pay.customerId)) continue;
              await tx.payment.upsert({
                where: { id: pay.id },
                update: {
                  customerId: pay.customerId,
                  amount: BigInt(pay.amountPaise || pay.amount || '0'),
                  mode: (pay.mode as PaymentMode) || (pay.paymentMode as PaymentMode) || PaymentMode.CASH,
                  reference: pay.reference || pay.refNumber || null,
                  receivedOn: pay.receivedOn ? new Date(pay.receivedOn) : new Date(),
                  status: (pay.status as PaymentStatus) || PaymentStatus.CLEARED,
                  gatewayRef: pay.gatewayRef || null,
                  idempotencyKey: pay.idempotencyKey || null,
                  notes: pay.notes || null,
                  reversesPaymentId: pay.reversesPaymentId && isUuid(pay.reversesPaymentId) ? pay.reversesPaymentId : null,
                  createdAt: pay.createdAt ? new Date(pay.createdAt) : new Date(),
                },
                create: {
                  id: pay.id,
                  tenantId: targetTenantId,
                  customerId: pay.customerId,
                  amount: BigInt(pay.amountPaise || pay.amount || '0'),
                  mode: (pay.mode as PaymentMode) || (pay.paymentMode as PaymentMode) || PaymentMode.CASH,
                  reference: pay.reference || pay.refNumber || null,
                  receivedOn: pay.receivedOn ? new Date(pay.receivedOn) : new Date(),
                  status: (pay.status as PaymentStatus) || PaymentStatus.CLEARED,
                  gatewayRef: pay.gatewayRef || null,
                  idempotencyKey: pay.idempotencyKey || null,
                  notes: pay.notes || null,
                  reversesPaymentId: pay.reversesPaymentId && isUuid(pay.reversesPaymentId) ? pay.reversesPaymentId : null,
                  createdAt: pay.createdAt ? new Date(pay.createdAt) : new Date(),
                },
              });
              restoredStats.payments++;
            }

            // 11. Payment Allocations
            for (const alloc of paymentAllocations) {
              if (!isUuid(alloc.id) || !isUuid(alloc.paymentId) || !isUuid(alloc.invoiceId)) continue;
              await tx.paymentAllocation.upsert({
                where: { id: alloc.id },
                update: {
                  paymentId: alloc.paymentId,
                  invoiceId: alloc.invoiceId,
                  amount: BigInt(alloc.amountPaise || alloc.amount || '0'),
                  strategy: alloc.strategy || 'OLDEST_FIRST',
                },
                create: {
                  id: alloc.id,
                  paymentId: alloc.paymentId,
                  invoiceId: alloc.invoiceId,
                  amount: BigInt(alloc.amountPaise || alloc.amount || '0'),
                  strategy: alloc.strategy || 'OLDEST_FIRST',
                  createdAt: alloc.createdAt ? new Date(alloc.createdAt) : new Date(),
                },
              });
              restoredStats.paymentAllocations++;
            }

            // 12. Ledger Entries
            for (const l of ledgerEntries) {
              if (!isUuid(l.id) || !isUuid(l.customerId)) continue;
              await tx.ledgerEntry.upsert({
                where: { id: l.id },
                update: {
                  customerId: l.customerId,
                  entryType: (l.entryType as LedgerEntryType) || LedgerEntryType.INVOICE,
                  refId: l.refId || l.refNumber || null,
                  debit: BigInt(l.debitPaise || l.debit || '0'),
                  credit: BigInt(l.creditPaise || l.credit || '0'),
                  entryDate: l.entryDate ? new Date(l.entryDate) : new Date(),
                  narration: l.narration || null,
                  createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
                },
                create: {
                  id: l.id,
                  tenantId: targetTenantId,
                  customerId: l.customerId,
                  entryType: (l.entryType as LedgerEntryType) || LedgerEntryType.INVOICE,
                  refId: l.refId || l.refNumber || null,
                  debit: BigInt(l.debitPaise || l.debit || '0'),
                  credit: BigInt(l.creditPaise || l.credit || '0'),
                  entryDate: l.entryDate ? new Date(l.entryDate) : new Date(),
                  narration: l.narration || null,
                  createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
                },
              });
              restoredStats.ledgerEntries++;
            }

            // 13. Credit Notes
            for (const cn of creditNotes) {
              if (!isUuid(cn.id) || !isUuid(cn.customerId)) continue;
              await tx.creditNote.upsert({
                where: { id: cn.id },
                update: {
                  customerId: cn.customerId,
                  invoiceId: cn.invoiceId && isUuid(cn.invoiceId) ? cn.invoiceId : null,
                  number: cn.number,
                  reason: cn.reason || null,
                  amount: BigInt(cn.amountPaise || cn.amount || '0'),
                  items: cn.items || null,
                  restock: cn.restock !== undefined ? cn.restock : true,
                },
                create: {
                  id: cn.id,
                  tenantId: targetTenantId,
                  customerId: cn.customerId,
                  invoiceId: cn.invoiceId && isUuid(cn.invoiceId) ? cn.invoiceId : null,
                  number: cn.number,
                  reason: cn.reason || null,
                  amount: BigInt(cn.amountPaise || cn.amount || '0'),
                  items: cn.items || null,
                  restock: cn.restock !== undefined ? cn.restock : true,
                  createdAt: cn.createdAt ? new Date(cn.createdAt) : new Date(),
                },
              });
              restoredStats.creditNotes++;
            }

            // 14. Accounts & General Ledger (if present)
            for (const acc of accounts) {
              if (!isUuid(acc.id)) continue;
              await tx.account.upsert({
                where: { id: acc.id },
                update: {
                  code: acc.code,
                  name: acc.name,
                  groupName: acc.groupName,
                  subGroup: acc.subGroup || null,
                  openingDr: BigInt(acc.openingDrPaise || acc.openingDr || '0'),
                  openingCr: BigInt(acc.openingCrPaise || acc.openingCr || '0'),
                  isSystem: Boolean(acc.isSystem),
                  isActive: acc.isActive !== undefined ? acc.isActive : true,
                },
                create: {
                  id: acc.id,
                  tenantId: targetTenantId,
                  code: acc.code,
                  name: acc.name,
                  groupName: acc.groupName,
                  subGroup: acc.subGroup || null,
                  openingDr: BigInt(acc.openingDrPaise || acc.openingDr || '0'),
                  openingCr: BigInt(acc.openingCrPaise || acc.openingCr || '0'),
                  isSystem: Boolean(acc.isSystem),
                  isActive: acc.isActive !== undefined ? acc.isActive : true,
                },
              });
              restoredStats.accounts++;
            }

            for (const gl of glEntries) {
              if (!isUuid(gl.id) || !isUuid(gl.accountId)) continue;
              await tx.gLEntry.upsert({
                where: { id: gl.id },
                update: {
                  accountId: gl.accountId,
                  debit: BigInt(gl.debitPaise || gl.debit || '0'),
                  credit: BigInt(gl.creditPaise || gl.credit || '0'),
                  narration: gl.narration || null,
                  refType: gl.refType || null,
                  refId: gl.refId && isUuid(gl.refId) ? gl.refId : null,
                  entryDate: gl.entryDate ? new Date(gl.entryDate) : new Date(),
                  voucherId: gl.voucherId && isUuid(gl.voucherId) ? gl.voucherId : null,
                },
                create: {
                  id: gl.id,
                  tenantId: targetTenantId,
                  accountId: gl.accountId,
                  debit: BigInt(gl.debitPaise || gl.debit || '0'),
                  credit: BigInt(gl.creditPaise || gl.credit || '0'),
                  narration: gl.narration || null,
                  refType: gl.refType || null,
                  refId: gl.refId && isUuid(gl.refId) ? gl.refId : null,
                  entryDate: gl.entryDate ? new Date(gl.entryDate) : new Date(),
                  voucherId: gl.voucherId && isUuid(gl.voucherId) ? gl.voucherId : null,
                  createdAt: gl.createdAt ? new Date(gl.createdAt) : new Date(),
                },
              });
              restoredStats.glEntries++;
            }

            for (const jv of journalVouchers) {
              if (!isUuid(jv.id)) continue;
              await tx.journalVoucher.upsert({
                where: { id: jv.id },
                update: {
                  number: jv.number,
                  voucherDate: jv.voucherDate ? new Date(jv.voucherDate) : new Date(),
                  narration: jv.narration || null,
                  isBalanced: Boolean(jv.isBalanced),
                },
                create: {
                  id: jv.id,
                  tenantId: targetTenantId,
                  number: jv.number,
                  voucherDate: jv.voucherDate ? new Date(jv.voucherDate) : new Date(),
                  narration: jv.narration || null,
                  isBalanced: Boolean(jv.isBalanced),
                },
              });
              restoredStats.journalVouchers++;
            }

            // 15. Procurement (Purchase Orders & Goods Receipts)
            for (const po of purchaseOrders) {
              if (!isUuid(po.id) || !isUuid(po.supplierId)) continue;
              await tx.purchaseOrder.upsert({
                where: { id: po.id },
                update: {
                  supplierId: po.supplierId,
                  number: po.number,
                  status: (po.status as PurchaseOrderStatus) || PurchaseOrderStatus.DRAFT,
                  orderDate: po.orderDate ? new Date(po.orderDate) : new Date(),
                  expectedBy: po.expectedBy ? new Date(po.expectedBy) : null,
                  notes: po.notes || null,
                  subtotal: BigInt(po.subtotalPaise || po.subtotal || '0'),
                  taxTotal: BigInt(po.taxTotalPaise || po.taxTotal || '0'),
                  grandTotal: BigInt(po.grandTotalPaise || po.grandTotal || '0'),
                },
                create: {
                  id: po.id,
                  tenantId: targetTenantId,
                  supplierId: po.supplierId,
                  number: po.number,
                  status: (po.status as PurchaseOrderStatus) || PurchaseOrderStatus.DRAFT,
                  orderDate: po.orderDate ? new Date(po.orderDate) : new Date(),
                  expectedBy: po.expectedBy ? new Date(po.expectedBy) : null,
                  notes: po.notes || null,
                  subtotal: BigInt(po.subtotalPaise || po.subtotal || '0'),
                  taxTotal: BigInt(po.taxTotalPaise || po.taxTotal || '0'),
                  grandTotal: BigInt(po.grandTotalPaise || po.grandTotal || '0'),
                },
              });
              restoredStats.purchaseOrders++;
            }

            for (const grn of goodsReceipts) {
              if (!isUuid(grn.id) || !isUuid(grn.supplierId)) continue;
              await tx.goodsReceipt.upsert({
                where: { id: grn.id },
                update: {
                  supplierId: grn.supplierId,
                  poId: grn.poId && isUuid(grn.poId) ? grn.poId : null,
                  number: grn.number,
                  receiptDate: grn.receiptDate ? new Date(grn.receiptDate) : new Date(),
                  notes: grn.notes || null,
                  totalAmount: BigInt(grn.totalAmountPaise || grn.totalAmount || '0'),
                },
                create: {
                  id: grn.id,
                  tenantId: targetTenantId,
                  supplierId: grn.supplierId,
                  poId: grn.poId && isUuid(grn.poId) ? grn.poId : null,
                  number: grn.number,
                  receiptDate: grn.receiptDate ? new Date(grn.receiptDate) : new Date(),
                  notes: grn.notes || null,
                  totalAmount: BigInt(grn.totalAmountPaise || grn.totalAmount || '0'),
                },
              });
              restoredStats.goodsReceipts++;
            }
          },
          {
            timeout: 60000,
          }
        );
      } catch (dbErr: any) {
        if (getStorageMode() === 'POSTGRES') {
          console.error('Prisma transactional restore rollback:', dbErr?.message);
          return NextResponse.json(
            { error: `Database restore failed and was safely rolled back: ${dbErr?.message}` },
            { status: 500 }
          );
        }
        console.warn('Prisma restore error, continuing local fallback sync:', dbErr);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: LocalStore Synchronization
    // ─────────────────────────────────────────────────────────────────────────
    for (const p of products) {
      localStore.updateProduct(p.id, {
        name: p.name,
        partNumber: p.partNumber,
        brand: p.brand,
        category: p.category,
        unit: p.unit || 'pcs',
        purchasePricePaise: String(p.purchasePricePaise || p.purchasePrice || '0'),
        salePricePaise: String(p.salePricePaise || p.salePrice || '0'),
        mrpPaise: String(p.mrpPaise || p.mrp || '0'),
        stockQty: Number(p.stockQty || '0'),
        reorderLevel: Number(p.reorderLevel || '5'),
        models: p.models || ['Universal / Multi-Fit'],
      }, targetTenantId);
    }

    for (const c of customers) {
      localStore.updateCustomer(c.id, {
        name: c.name,
        shopName: c.shopName,
        phone: c.phone,
        address: c.address,
        gstin: c.gstin,
        creditLimitPaise: String(c.creditLimitPaise || c.creditLimit || '5000000'),
        termsDays: Number(c.termsDays || c.paymentTermsDays || 15),
        status: c.status || 'GREEN',
      }, targetTenantId);
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'BACKUP_RESTORED',
      entity: 'TENANT',
      entityId: targetTenantId,
      after: { restoredStats, backupFormat: backupData.version },
    });

    return NextResponse.json({
      success: true,
      message: 'System and database restored successfully from backup',
      restoredStats,
      exportedAt: backupData.exportedAt || new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore backup' }, { status: 500 });
  }
}
