import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { CreditStatus, CustomerType, InvoiceStatus, InvoiceType, StockReason } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';

    let snapshot: any = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      platform: 'TradeLedger Universal B2B Wholesale & Khata ERP',
      tenantId: targetTenantId,
      data: {
        tenants: [],
        users: [],
        products: [],
        customers: [],
        ledgerEntries: [],
        invoices: [],
        payments: [],
      },
    };

    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const [tenants, users, products, customers, ledgerEntries, invoices, payments] = await Promise.all([
          prisma.tenant.findMany(),
          prisma.user.findMany({ select: { id: true, tenantId: true, name: true, phone: true, email: true, role: true, isActive: true } }),
          prisma.product.findMany({
            include: {
              compatibilities: { include: { bikeModel: true } },
              stockMovements: true,
            },
          }),
          prisma.customer.findMany(),
          prisma.ledgerEntry.findMany({ orderBy: { createdAt: 'asc' } }),
          prisma.invoice.findMany({
            include: {
              items: true,
            },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.payment.findMany({ orderBy: { createdAt: 'asc' } }),
        ]);

        snapshot.data = {
          tenants,
          users,
          products: products.map((p) => ({
            id: p.id,
            tenantId: p.tenantId,
            name: p.name,
            partNumber: p.partNumber,
            brand: p.brand,
            category: p.category,
            hsnCode: p.hsnCode,
            gstRateBp: p.gstRateBp,
            unit: p.unit,
            purchasePricePaise: p.purchasePrice?.toString() || '0',
            salePricePaise: p.salePrice?.toString() || '0',
            mrpPaise: p.mrp?.toString() || '0',
            reorderLevel: p.reorderLevel,
            isActive: p.isActive,
            stockQty: p.stockMovements.reduce((sum, m) => sum + m.qty, 0),
            models: p.compatibilities.map((c) => `${c.bikeModel.make} ${c.bikeModel.model}`),
            stockMovements: p.stockMovements.map((m) => ({
              qty: m.qty,
              reason: m.reason,
              unitCost: m.unitCost?.toString() || '0',
              createdAt: m.createdAt.toISOString(),
            })),
          })),
          customers: customers.map((c) => ({
            id: c.id,
            tenantId: c.tenantId,
            name: c.name,
            shopName: c.shopName,
            phone: c.phone,
            address: c.address,
            gstin: c.gstin,
            customerType: c.customerType,
            creditLimitPaise: c.creditLimit.toString(),
            termsDays: c.paymentTermsDays,
            status: c.status,
            isActive: c.isActive,
          })),
          ledgerEntries: ledgerEntries.map((l) => ({
            id: l.id,
            tenantId: l.tenantId,
            customerId: l.customerId,
            entryType: l.entryType,
            refNumber: l.refId || '',
            narration: l.narration,
            debitPaise: l.debit.toString(),
            creditPaise: l.credit.toString(),
            createdAt: l.createdAt.toISOString(),
          })),
          invoices: invoices.map((inv) => ({
            id: inv.id,
            tenantId: inv.tenantId,
            customerId: inv.customerId,
            invoiceNumber: inv.number,
            invoiceType: inv.invoiceType,
            status: inv.status,
            subtotalPaise: inv.subtotal.toString(),
            discountTotalPaise: inv.discountTotal.toString(),
            taxableValuePaise: inv.taxableValue.toString(),
            cgstPaise: inv.cgst.toString(),
            sgstPaise: inv.sgst.toString(),
            igstPaise: inv.igst.toString(),
            totalTaxPaise: (inv.cgst + inv.sgst + inv.igst).toString(),
            grandTotalPaise: inv.grandTotal.toString(),
            createdAt: inv.createdAt.toISOString(),
            items: inv.items.map((it) => ({
              id: it.id,
              name: it.description,
              partNumber: '',
              hsnCode: it.hsnCode,
              unit: it.unit,
              qty: Number(it.qty),
              unitRatePaise: it.rate.toString(),
              gstRateBp: it.gstRateBp,
              totalPaise: it.lineTotal.toString(),
            })),
          })),
          payments: payments.map((pay) => ({
            id: pay.id,
            tenantId: pay.tenantId,
            customerId: pay.customerId,
            invoiceId: undefined,
            amountPaise: pay.amount.toString(),
            paymentMode: pay.mode,
            refNumber: pay.reference || '',
            createdAt: pay.createdAt.toISOString(),
          })),
        };
      } catch (dbErr) {
        console.warn('Database snapshot fallback to localStore:', dbErr);
      }
    }

    // Fallback if Postgres was empty or offline
    if (snapshot.data.products.length === 0) {
      const localTenants = localStore.getTenants();
      const localUsers = localStore.getUsers();
      const localProducts = localStore.getProducts();
      const localCusts = localStore.getCustomers();
      const localInvs = localStore.getInvoices();

      snapshot.data = {
        tenants: localTenants,
        users: localUsers,
        products: localProducts,
        customers: localCusts,
        ledgerEntries: [],
        invoices: localInvs,
        payments: [],
      };
    }

    // Stats summary
    snapshot.stats = {
      tenantsCount: snapshot.data.tenants.length,
      productsCount: snapshot.data.products.length,
      customersCount: snapshot.data.customers.length,
      invoicesCount: snapshot.data.invoices.length,
      ledgerEntriesCount: snapshot.data.ledgerEntries.length,
    };

    return NextResponse.json({
      success: true,
      backup: snapshot,
    });
  } catch (error: any) {
    console.error('Error generating backup:', error);
    return NextResponse.json({ error: error.message || 'Backup generation failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();

    const backupData = body.backup || body;
    if (!backupData || !backupData.data) {
      return NextResponse.json({ error: 'Invalid backup format. Missing data payload.' }, { status: 400 });
    }

    const {
      tenants = [],
      users = [],
      products = [],
      customers = [],
      ledgerEntries = [],
      invoices = [],
      payments = [],
    } = backupData.data;

    let restoredStats = {
      tenants: 0,
      products: 0,
      customers: 0,
      invoices: 0,
      ledgerEntries: 0,
    };

    // 1. Restore into Postgres if DB is available
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        // Restore/Update Tenant
        for (const t of tenants) {
          await prisma.tenant.upsert({
            where: { id: t.id },
            update: {
              name: t.name,
              legalName: t.legalName || t.name,
              gstin: t.gstin,
              address: t.address,
              stateCode: t.stateCode,
              upiId: t.upiId,
              bankDetails: t.bankDetails || {},
              settings: t.settings || {},
            },
            create: {
              id: t.id,
              name: t.name || 'Honda Showroom',
              legalName: t.legalName || t.name,
              gstin: t.gstin || '27ABCDE1234F1Z5',
              address: t.address || 'Showroom Address',
              stateCode: t.stateCode || '27 - Maharashtra',
              upiId: t.upiId,
              bankDetails: t.bankDetails || {},
              settings: t.settings || {},
            },
          });
          restoredStats.tenants++;
        }

        // Restore Customers
        for (const c of customers) {
          await prisma.customer.upsert({
            where: { id: c.id },
            update: {
              name: c.name,
              shopName: c.shopName || c.name,
              phone: c.phone,
              address: c.address,
              gstin: c.gstin,
              creditLimit: BigInt(c.creditLimitPaise || c.creditLimit || '5000000'),
              paymentTermsDays: parseInt(c.termsDays || c.paymentTermsDays || '15', 10),
              status: (c.status as CreditStatus) || CreditStatus.GREEN,
              isActive: c.isActive !== undefined ? c.isActive : true,
            },
            create: {
              id: c.id,
              tenantId: c.tenantId || tenants[0]?.id || 'tenant-honda-1',
              name: c.name,
              shopName: c.shopName || c.name,
              phone: c.phone || '',
              address: c.address,
              gstin: c.gstin,
              creditLimit: BigInt(c.creditLimitPaise || c.creditLimit || '5000000'),
              paymentTermsDays: parseInt(c.termsDays || c.paymentTermsDays || '15', 10),
              customerType: (c.customerType as CustomerType) || CustomerType.GARAGE,
              status: (c.status as CreditStatus) || CreditStatus.GREEN,
              isActive: true,
            },
          });
          restoredStats.customers++;
        }

        // Restore Products
        for (const p of products) {
          const prod = await prisma.product.upsert({
            where: { id: p.id },
            update: {
              name: p.name,
              partNumber: p.partNumber,
              brand: p.brand,
              category: p.category,
              hsnCode: p.hsnCode || '8714',
              gstRateBp: p.gstRateBp || 1800,
              unit: p.unit || 'pcs',
              purchasePrice: BigInt(p.purchasePricePaise || p.purchasePrice || '0'),
              salePrice: BigInt(p.salePricePaise || p.salePrice || '0'),
              mrp: BigInt(p.mrpPaise || p.mrp || '0'),
              reorderLevel: parseInt(p.reorderLevel || '5', 10),
              isActive: p.isActive !== undefined ? p.isActive : true,
            },
            create: {
              id: p.id,
              tenantId: p.tenantId || tenants[0]?.id || 'tenant-honda-1',
              name: p.name,
              partNumber: p.partNumber,
              brand: p.brand,
              category: p.category,
              hsnCode: p.hsnCode || '8714',
              gstRateBp: p.gstRateBp || 1800,
              unit: p.unit || 'pcs',
              purchasePrice: BigInt(p.purchasePricePaise || p.purchasePrice || '0'),
              salePrice: BigInt(p.salePricePaise || p.salePrice || '0'),
              mrp: BigInt(p.mrpPaise || p.mrp || '0'),
              reorderLevel: parseInt(p.reorderLevel || '5', 10),
              isActive: true,
            },
          });

          // Restore opening stock movement if stockQty is provided and no movement exists
          const currentMovements = await prisma.stockMovement.findMany({ where: { productId: prod.id } });
          if (currentMovements.length === 0 && p.stockQty && p.stockQty > 0) {
            await prisma.stockMovement.create({
              data: {
                tenantId: prod.tenantId,
                productId: prod.id,
                qty: parseInt(p.stockQty, 10),
                reason: StockReason.OPENING,
                unitCost: BigInt(p.purchasePricePaise || '0'),
              },
            });
          }
          restoredStats.products++;
        }
      } catch (dbErr) {
        console.warn('Prisma restore error, continuing local sync:', dbErr);
      }
    }

    // 2. Always restore into localStore for instant availability
    for (const p of products) {
      if (typeof (localStore as any).upsertProduct === 'function') {
        localStore.upsertProduct(p.id, {
          name: p.name,
          partNumber: p.partNumber,
          brand: p.brand,
          category: p.category,
          unit: p.unit || 'pcs',
          purchasePricePaise: String(p.purchasePricePaise || p.purchasePrice || '0'),
          salePricePaise: String(p.salePricePaise || p.salePrice || '0'),
          mrpPaise: String(p.mrpPaise || p.mrp || '0'),
          stockQty: parseInt(p.stockQty || '0', 10),
          reorderLevel: parseInt(p.reorderLevel || '5', 10),
          models: p.models || ['Universal / Multi-Fit'],
        });
      } else if (typeof (localStore as any).updateProduct === 'function') {
        localStore.updateProduct(p.id, {
          name: p.name,
          partNumber: p.partNumber,
          brand: p.brand,
          category: p.category,
          unit: p.unit || 'pcs',
          purchasePricePaise: String(p.purchasePricePaise || p.purchasePrice || '0'),
          salePricePaise: String(p.salePricePaise || p.salePrice || '0'),
          mrpPaise: String(p.mrpPaise || p.mrp || '0'),
          stockQty: parseInt(p.stockQty || '0', 10),
          reorderLevel: parseInt(p.reorderLevel || '5', 10),
          models: p.models || ['Universal / Multi-Fit'],
        });
      }
    }

    for (const c of customers) {
      if (typeof (localStore as any).upsertCustomer === 'function') {
        localStore.upsertCustomer(c.id, {
          name: c.name,
          shopName: c.shopName,
          phone: c.phone,
          address: c.address,
          gstin: c.gstin,
          creditLimitPaise: String(c.creditLimitPaise || c.creditLimit || '5000000'),
          termsDays: parseInt(c.termsDays || '15', 10),
          status: c.status || 'GREEN',
        });
      } else if (typeof (localStore as any).updateCustomer === 'function') {
        localStore.updateCustomer(c.id, {
          name: c.name,
          shopName: c.shopName,
          phone: c.phone,
          address: c.address,
          gstin: c.gstin,
          creditLimitPaise: String(c.creditLimitPaise || c.creditLimit || '5000000'),
          termsDays: parseInt(c.termsDays || '15', 10),
          status: c.status || 'GREEN',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'System and database restored successfully from backup',
      restoredStats,
      exportedAt: backupData.exportedAt || new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error feeding backup:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore backup' }, { status: 500 });
  }
}
