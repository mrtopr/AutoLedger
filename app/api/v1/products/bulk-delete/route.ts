import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { createAuditLog } from '@/server/lib/audit';

const isValidUuid = (val: any): boolean => {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can perform bulk product deletions' },
        { status: 403 }
      );
    }
    const targetTenantId = authUser.tenantId;

    const body = await req.json();
    const { action, productIds, filter, confirmAll } = body;

    if (action === 'ALL' && authUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: only business OWNER can perform a full inventory wipe' },
        { status: 403 }
      );
    }

    const hasDb = await isPostgresAvailable();
    const dbTenantId = isValidUuid(targetTenantId) ? targetTenantId : null;

    let deletedCount = 0;

    // 1. DELETE SELECTED
    if (action === 'SELECTED') {
      const ids: string[] = Array.isArray(productIds) ? productIds : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No product IDs provided' }, { status: 400 });
      }

      // Soft-delete in PostgreSQL scoped to dbTenantId
      if (hasDb && dbTenantId) {
        const validUuids = ids.filter(id => isValidUuid(id));
        if (validUuids.length > 0) {
          try {
            const res = await prisma.product.updateMany({
              where: {
                id: { in: validUuids },
                tenantId: dbTenantId,
              },
              data: { isActive: false },
            });
            deletedCount = Math.max(deletedCount, res.count);
          } catch (dbErr) {
            console.warn('Postgres bulk delete error:', dbErr);
          }
        }
      }

      // Remove from localStore scoped to targetTenantId
      const localCount = localStore.deleteProducts(ids, targetTenantId);
      deletedCount = Math.max(deletedCount, localCount, ids.length);

      await createAuditLog({
        tenantId: targetTenantId,
        userId: authUser.id,
        action: 'PRODUCT_BULK_DELETED',
        entity: 'PRODUCT',
        after: { action: 'SELECTED', count: ids.length, productIds: ids.slice(0, 10) },
      });

      return NextResponse.json({
        success: true,
        count: ids.length,
        message: `Successfully deleted ${ids.length} products`,
      });
    }

    // 2. DELETE ALL STOCK
    if (action === 'ALL') {
      if (!confirmAll) {
        return NextResponse.json(
          { error: 'Confirmation required to delete all stock' }, 
          { status: 400 }
        );
      }

      if (hasDb && dbTenantId) {
        try {
          const res = await prisma.product.updateMany({
            where: { tenantId: dbTenantId, isActive: true },
            data: { isActive: false },
          });
          deletedCount = res.count;
        } catch (dbErr) {
          console.warn('Postgres delete all error:', dbErr);
        }
      }

      const localCount = localStore.deleteProductsByFilter(targetTenantId, { all: true });
      deletedCount = Math.max(deletedCount, localCount);

      await createAuditLog({
        tenantId: targetTenantId,
        userId: authUser.id,
        action: 'PRODUCT_BULK_DELETED',
        entity: 'PRODUCT',
        after: { action: 'ALL', count: deletedCount },
      });

      return NextResponse.json({
        success: true,
        count: deletedCount,
        message: 'All inventory products have been removed successfully',
      });
    }

    // 3. DELETE BY FILTER
    if (action === 'FILTER') {
      const category = filter?.category;
      const brand = filter?.brand;
      const zeroStockOnly = Boolean(filter?.zeroStockOnly);
      const search = filter?.search;

      if (hasDb && dbTenantId) {
        try {
          const whereClause: any = {
            tenantId: dbTenantId,
            isActive: true,
          };
          if (category && category !== 'All Departments') {
            whereClause.category = category;
          }
          if (brand) {
            whereClause.brand = brand;
          }
          if (search) {
            whereClause.OR = [
              { name: { contains: search, mode: 'insensitive' } },
              { partNumber: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
            ];
          }

          const res = await prisma.product.updateMany({
            where: whereClause,
            data: { isActive: false },
          });
          deletedCount = res.count;
        } catch (dbErr) {
          console.warn('Postgres filter delete error:', dbErr);
        }
      }

      const localCount = localStore.deleteProductsByFilter(targetTenantId, {
        category,
        brand,
        zeroStockOnly,
        search,
      });
      deletedCount = Math.max(deletedCount, localCount);

      await createAuditLog({
        tenantId: targetTenantId,
        userId: authUser.id,
        action: 'PRODUCT_BULK_DELETED',
        entity: 'PRODUCT',
        after: { action: 'FILTER', count: deletedCount, filter },
      });

      return NextResponse.json({
        success: true,
        count: deletedCount,
        message: `Successfully deleted ${deletedCount} filtered products`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in bulk-delete API:', error);
    return NextResponse.json({ error: error.message || 'Bulk delete failed' }, { status: 500 });
  }
}
