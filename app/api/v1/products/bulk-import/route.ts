import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { StockReason } from '@prisma/client';

export interface BulkImportItem {
  name: string;
  partNumber?: string;
  brand?: string;
  category?: string;
  hsnCode?: string;
  gstRateBp?: number;
  unit?: string;
  purchasePricePaise?: number | string;
  salePricePaise?: number | string;
  mrpPaise?: number | string;
  stockQty?: number | string;
  reorderLevel?: number | string;
  models?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();
    const items: BulkImportItem[] = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No product rows provided in import payload' },
        { status: 400 }
      );
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';
    const hasDb = await isPostgresAvailable();

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const trimmedName = (item.name || '').trim();

      if (!trimmedName) {
        skippedCount++;
        errors.push(`Row ${i + 1}: Missing product name`);
        continue;
      }

      const salePricePaise = Number(item.salePricePaise) || 0;
      const purchasePricePaise = Number(item.purchasePricePaise) || 0;
      const mrpPaise = Number(item.mrpPaise) || salePricePaise;
      const stockQty = Math.max(0, parseInt(String(item.stockQty || 0), 10) || 0);
      const reorderLevel = Math.max(0, parseInt(String(item.reorderLevel || 5), 10) || 5);
      const gstRateBp = Number(item.gstRateBp) || 1800;
      const unit = (item.unit || 'pcs').trim().toLowerCase();
      const hsnCode = (item.hsnCode || '8714').trim();
      const category = (item.category || 'General Supplies').trim();
      const brand = (item.brand || 'Standard').trim();
      const partNumber = (item.partNumber || `SKU-${Date.now().toString(36).toUpperCase()}-${i + 1}`).trim();
      const models = Array.isArray(item.models) && item.models.length > 0 ? item.models : ['Universal / Multi-Fit'];

      // 1. Try Prisma if available
      if (hasDb) {
        try {
          const product = await prisma.product.create({
            data: {
              tenantId: targetTenantId,
              name: trimmedName,
              partNumber: partNumber,
              brand: brand,
              category: category,
              hsnCode: hsnCode,
              gstRateBp: gstRateBp,
              unit: unit,
              purchasePrice: BigInt(purchasePricePaise),
              salePrice: BigInt(salePricePaise),
              mrp: BigInt(mrpPaise),
              reorderLevel: reorderLevel,
              isActive: true,
            },
          });

          if (stockQty > 0) {
            await prisma.stockMovement.create({
              data: {
                tenantId: targetTenantId,
                productId: product.id,
                qty: stockQty,
                reason: StockReason.OPENING,
                unitCost: BigInt(purchasePricePaise),
                createdBy: authUser?.id || null,
              },
            });
          }
        } catch (dbErr) {
          // If duplicate part number or db error, fallback to localStore
        }
      }

      // 2. Always persist in localStore for instant reactivity
      localStore.createProduct({
        tenantId: targetTenantId,
        name: trimmedName,
        partNumber: partNumber,
        brand: brand,
        category: category,
        hsnCode: hsnCode,
        gstRateBp: gstRateBp,
        unit: unit,
        purchasePricePaise: String(purchasePricePaise),
        salePricePaise: String(salePricePaise),
        mrpPaise: String(mrpPaise),
        stockQty: stockQty,
        reorderLevel: reorderLevel,
        models: models,
      });

      importedCount++;
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      totalRows: items.length,
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Error in bulk import:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to bulk import products' },
      { status: 500 }
    );
  }
}
