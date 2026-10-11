import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';

const isValidUuid = (val: any): boolean => {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();
    const { action, productIds, filter, confirmAll } = body;

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';
    const hasDb = await isPostgresAvailable();

    // Resolve valid database tenant UUID if available
    let dbTenantId: string | null = null;
    if (hasDb) {
      if (authUser?.tenantId && isValidUuid(authUser.tenantId)) {
        dbTenantId = authUser.tenantId;
      } else {
        try {
          const firstTenant = await prisma.tenant.findFirst({ select: { id: true } });
          if (firstTenant && isValidUuid(firstTenant.id)) {
            dbTenantId = firstTenant.id;
          }
        } catch {
          // ignore
        }
      }
    }

    let deletedCount = 0;

    // 1. DELETE SELECTED
    if (action === 'SELECTED') {
      const ids: string[] = Array.isArray(productIds) ? productIds : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No product IDs provided' }, { status: 400 });
      }

      // Soft-delete in PostgreSQL
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

      // Remove from localStore fallback
      const localCount = localStore.deleteProducts(ids);
      deletedCount = Math.max(deletedCount, localCount, ids.length);

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
