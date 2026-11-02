import { prisma, isPostgresAvailable } from './prisma';
import { StockReason } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface CloudSyncProductItem {
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

const isValidUuid = (val: any): boolean => {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// Retry queue for when cloud database is offline or asleep
let syncQueue: Array<{
  tenantId: string;
  items: CloudSyncProductItem[];
  userId?: string | null;
  retries: number;
}> = [];

let isProcessingQueue = false;

/**
 * Enqueues products for background cloud synchronization.
 * Local database has already saved the data; this synchronizes to PostgreSQL in the background.
 */
export function queueCloudSync(
  tenantId: string,
  items: CloudSyncProductItem[],
  userId?: string | null
) {
  if (!isValidUuid(tenantId) || !Array.isArray(items) || items.length === 0) {
    return;
  }

  syncQueue.push({
    tenantId,
    items,
    userId: isValidUuid(userId) ? userId : null,
    retries: 0,
  });

  processSyncQueue();
}

/**
 * Background worker that drains the cloud sync queue gracefully.
 */
async function processSyncQueue() {
  if (isProcessingQueue || syncQueue.length === 0) return;
  isProcessingQueue = true;

  try {
    const hasDb = await Promise.race([
      isPostgresAvailable(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);

    if (!hasDb) {
      // Database not reachable, wait and try later
      isProcessingQueue = false;
      return;
    }

    while (syncQueue.length > 0) {
      const task = syncQueue.shift();
      if (!task) break;

      try {
        await executeCloudSync(task.tenantId, task.items, task.userId);
      } catch (err: any) {
        if (task.retries < 3) {
          task.retries += 1;
          syncQueue.push(task);
        }
        console.warn(`[CloudSync] Background sync postponed (${err.message || 'connection issue'}). Local store remains authoritative.`);
        break;
      }
    }
  } catch {
    // Silent failover to prevent unhandled rejection
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Executes a single cloud sync task with chunking and strict UUID verification.
 */
export async function executeCloudSync(
  dbTenantId: string,
  items: CloudSyncProductItem[],
  userId?: string | null
) {
  const CHUNK_SIZE = 250;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const chunkNames = chunk.map((it) => (it.name || '').trim()).filter(Boolean);
    const chunkParts = chunk.map((it) => (it.partNumber || '').trim()).filter(Boolean);

    // Find any products that already exist in PostgreSQL for this chunk
    let existingDbByName = new Map<string, string>();
    let existingDbByPart = new Map<string, string>();
    try {
      const existingDbProducts = await prisma.product.findMany({
        where: {
          tenantId: dbTenantId,
          OR: [
            ...(chunkNames.length > 0 ? [{ name: { in: chunkNames } }] : []),
            ...(chunkParts.length > 0 ? [{ partNumber: { in: chunkParts } }] : []),
          ],
        },
        select: { id: true, name: true, partNumber: true },
      });

      for (const ep of existingDbProducts) {
        if (ep.name) existingDbByName.set(ep.name.trim().toLowerCase(), ep.id);
        if (ep.partNumber) existingDbByPart.set(ep.partNumber.trim().toLowerCase(), ep.id);
      }
    } catch {
      // Continue if lookup fails
    }

    const dbNewProducts: any[] = [];
    const dbStockMovements: any[] = [];
    const dbExistingIdsToReactivate: string[] = [];
    const dbProductsToUpdate: Array<{
      id: string;
      partNumber?: string;
      brand?: string;
      category?: string;
      unit?: string;
      hsnCode?: string;
      gstRateBp?: number;
      purchasePrice: bigint;
      salePrice: bigint;
      mrp: bigint;
      reorderLevel: number;
    }> = [];

    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j];
      const trimmedName = (item.name || '').trim();
      if (!trimmedName || item.syncAction === 'SKIP') continue;

      const isUnpriced = Boolean(item.isUnpriced);
      const salePricePaise = isUnpriced ? 0 : Math.max(0, Number(item.salePricePaise) || 0);
      const purchasePricePaise = isUnpriced ? 0 : Math.max(0, Number(item.purchasePricePaise) || 0);
      const mrpPaise = isUnpriced ? 0 : Math.max(0, Number(item.mrpPaise) || salePricePaise);
      const stockQty = isUnpriced ? 0 : parseInt(String(item.stockQty || 0), 10) || 0;
      const reorderLevel = Math.max(0, parseInt(String(item.reorderLevel || 5), 10) || 5);

      // Only accept existing ID if it is a valid UUID
      const dbExistingId =
        (item.existingProductId && isValidUuid(item.existingProductId) ? item.existingProductId : null) ||
        existingDbByName.get(trimmedName.toLowerCase()) ||
        (item.partNumber ? existingDbByPart.get(item.partNumber.trim().toLowerCase()) : null);

      if (dbExistingId && isValidUuid(dbExistingId)) {
        dbExistingIdsToReactivate.push(dbExistingId);
        dbProductsToUpdate.push({
          id: dbExistingId,
          partNumber: item.partNumber || undefined,
          brand: item.brand || undefined,
          category: item.category || undefined,
          unit: item.unit || undefined,
          hsnCode: item.hsnCode || undefined,
          gstRateBp: Number(item.gstRateBp) || undefined,
          purchasePrice: BigInt(purchasePricePaise),
          salePrice: BigInt(salePricePaise),
          mrp: BigInt(mrpPaise),
          reorderLevel,
        });

        if (stockQty !== 0) {
          dbStockMovements.push({
            id: randomUUID(),
            tenantId: dbTenantId,
            productId: dbExistingId,
            qty: stockQty,
            reason: StockReason.OPENING,
            unitCost: BigInt(purchasePricePaise),
            createdBy: userId || null,
          });
        }
      } else {
        const newId = randomUUID();
        existingDbByName.set(trimmedName.toLowerCase(), newId);

        dbNewProducts.push({
          id: newId,
          tenantId: dbTenantId,
          name: trimmedName,
          partNumber: item.partNumber || `SKU-${Date.now().toString(36).toUpperCase()}-${i + j + 1}`,
          brand: item.brand || null,
          category: item.category || null,
          hsnCode: item.hsnCode || '8714',
          gstRateBp: Number(item.gstRateBp) || 1800,
          unit: item.unit || 'pcs',
          purchasePrice: BigInt(purchasePricePaise),
          salePrice: BigInt(salePricePaise),
          mrp: BigInt(mrpPaise),
          reorderLevel,
          isActive: true,
        });

        if (stockQty !== 0) {
          dbStockMovements.push({
            id: randomUUID(),
            tenantId: dbTenantId,
            productId: newId,
            qty: stockQty,
            reason: StockReason.OPENING,
            unitCost: BigInt(purchasePricePaise),
            createdBy: userId || null,
          });
        }
      }
    }

    // Reactivate and update existing products
    if (dbExistingIdsToReactivate.length > 0) {
      await prisma.product.updateMany({
        where: {
          id: { in: dbExistingIdsToReactivate },
          tenantId: dbTenantId,
        },
        data: {
          isActive: true,
        },
      });

      // Update product attributes in concurrent batches of 20 to prevent sequential network bottleneck
      const UPDATE_BATCH_SIZE = 20;
      for (let k = 0; k < dbProductsToUpdate.length; k += UPDATE_BATCH_SIZE) {
        const batch = dbProductsToUpdate.slice(k, k + UPDATE_BATCH_SIZE);
        await Promise.all(
          batch.map((up) =>
            prisma.product.update({
              where: { id: up.id },
              data: {
                isActive: true,
                salePrice: up.salePrice,
                purchasePrice: up.purchasePrice,
                mrp: up.mrp,
                reorderLevel: up.reorderLevel,
                ...(up.partNumber ? { partNumber: up.partNumber } : {}),
                ...(up.brand ? { brand: up.brand } : {}),
                ...(up.category ? { category: up.category } : {}),
                ...(up.unit ? { unit: up.unit } : {}),
                ...(up.hsnCode ? { hsnCode: up.hsnCode } : {}),
                ...(up.gstRateBp ? { gstRateBp: up.gstRateBp } : {}),
              },
            }).catch(() => null)
          )
        );
      }
    }

    // Insert new products
    const validNewProducts = dbNewProducts.filter((p) => isValidUuid(p.id) && isValidUuid(p.tenantId));
    if (validNewProducts.length > 0) {
      await prisma.product.createMany({
        data: validNewProducts,
        skipDuplicates: true,
      });
    }

    // Insert stock movements
    const validStockMovements = dbStockMovements.filter(
      (sm) => isValidUuid(sm.id) && isValidUuid(sm.tenantId) && isValidUuid(sm.productId)
    );
    if (validStockMovements.length > 0) {
      await prisma.stockMovement.createMany({
        data: validStockMovements,
      });
    }
  }
}
