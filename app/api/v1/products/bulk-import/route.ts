import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { queueCloudSync } from '@/server/lib/cloudSync';
import { prisma } from '@/server/lib/prisma';

export interface BulkImportItem {
  name: string;
  partNumber?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  hsnCode?: string;
  gstRateBp?: number;
  unit?: string;
  purchasePricePaise?: number | string;
  salePricePaise?: number | string;
  mrpPaise?: number | string;
  stockQty?: number | string;
  reorderLevel?: number | string;
  models?: string[];
  existingProductId?: string;
  syncAction?: 'CREATE' | 'UPDATE' | 'SKIP';
  isUnpriced?: boolean;
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

    const isValidUuid = (val: any): boolean => {
      return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    };

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';

    // 1. Fast in-memory bulk upsert with single atomic disk write in localStore (runs in ~10ms)
    const localStorePayload = items.map((item, i) => {
      const trimmedName = (item.name || '').trim();
      const isUnpriced = Boolean(item.isUnpriced);
      const salePricePaise = isUnpriced ? '0' : String(Math.max(0, Number(item.salePricePaise) || 0));
      const purchasePricePaise = isUnpriced ? '0' : String(Math.max(0, Number(item.purchasePricePaise) || 0));
      const mrpPaise = isUnpriced ? '0' : String(Math.max(0, Number(item.mrpPaise) || Number(salePricePaise)));
      const stockQty = isUnpriced ? 0 : parseInt(String(item.stockQty || 0), 10) || 0;
      const reorderLevel = Math.max(0, parseInt(String(item.reorderLevel || 5), 10) || 5);

      return {
        name: trimmedName,
        partNumber: item.partNumber || `SKU-${Date.now().toString(36).toUpperCase()}-${i + 1}`,
        brand: item.brand,
        category: item.category,
        subcategory: item.subcategory,
        hsnCode: item.hsnCode,
        gstRateBp: item.gstRateBp,
        unit: item.unit,
        purchasePricePaise,
        salePricePaise,
        mrpPaise,
        stockQty,
        reorderLevel,
        models: item.models,
        existingProductId: item.existingProductId,
        syncAction: item.syncAction,
        isUnpriced: item.isUnpriced,
      };
    });

    const localSummary = localStore.bulkUpsertProducts(targetTenantId, localStorePayload);

    // 2. Background cloud synchronization: queue non-blocking sync with automatic retries
    let syncTenantId = authUser?.tenantId && isValidUuid(authUser.tenantId) ? authUser.tenantId : null;
    if (!syncTenantId) {
      try {
        const found = await prisma.tenant.findFirst({ select: { id: true } });
        if (found) syncTenantId = found.id;
      } catch {}
    }
    if (syncTenantId) {
      queueCloudSync(syncTenantId, items, (authUser?.id && isValidUuid(authUser.id)) ? authUser.id : null);
    }

    return NextResponse.json({
      success: true,
      importedCount: localSummary.importedCount,
      updatedCount: localSummary.updatedCount,
      skippedCount: localSummary.skippedCount,
      totalRows: items.length,
    });
  } catch (error: any) {
    console.error('Error in bulk import:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to bulk import products' },
      { status: 500 }
    );
  }
}
