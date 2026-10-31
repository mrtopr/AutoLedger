import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable, getStorageMode } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { StockReason } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const make = searchParams.get('make') || '';
    const category = searchParams.get('category') || '';
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    let formatted: any[] = [];
    let dbSuccess = false;

    // 1. LOCAL-FIRST: Always fetch from local database first (instant <5ms, exact stock & pricing from Excel)
    const localProducts = localStore.getProducts(targetTenantId);
    if (localProducts.length > 0) {
      formatted = localProducts.map((p) => ({
        id: p.id,
        name: p.name,
        partNumber: p.partNumber || '',
        brand: p.brand || 'Unbranded',
        category: p.category || 'General',
        hsnCode: p.hsnCode || '8714',
        gstRateBp: p.gstRateBp,
        unit: p.unit,
        purchasePricePaise: p.purchasePricePaise || '0',
        salePricePaise: p.salePricePaise || '0',
        mrpPaise: p.mrpPaise || '0',
        stockQty: p.stockQty,
        reorderLevel: p.reorderLevel,
        isLowStock: p.stockQty <= p.reorderLevel,
        models: p.models || ['Universal / Multi-Fit'],
      }));
      dbSuccess = true;
    }

    // 2. Cloud Fallback: If local store has no products yet, load from PostgreSQL
    if (!dbSuccess) {
      const hasDb = await Promise.race([
        isPostgresAvailable(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);

      if (hasDb && isUuid(targetTenantId)) {
        try {
          const products = await prisma.product.findMany({
            where: {
              tenantId: targetTenantId,
              isActive: true,
              ...(query ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { partNumber: { contains: query, mode: 'insensitive' } },
                  { brand: { contains: query, mode: 'insensitive' } },
                ]
              } : {}),
              ...(category && category !== 'ALL' ? { category } : {}),
            },
            include: {
              compatibilities: { include: { bikeModel: true } },
              stockMovements: { select: { qty: true } },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (products.length > 0) {
            formatted = products.map((p) => {
              const stockQty = p.stockMovements.reduce((sum, m) => sum + m.qty, 0);
              const models = p.compatibilities.map((c) => `${c.bikeModel.make} ${c.bikeModel.model}`);
              return {
                id: p.id,
                name: p.name,
                partNumber: p.partNumber || '',
                brand: p.brand || 'Unbranded',
                category: p.category || 'General',
                hsnCode: p.hsnCode || '8714',
                gstRateBp: p.gstRateBp,
                unit: p.unit,
                purchasePricePaise: p.purchasePrice?.toString() || '0',
                salePricePaise: p.salePrice?.toString() || '0',
                mrpPaise: p.mrp?.toString() || '0',
                stockQty,
                reorderLevel: p.reorderLevel,
                isLowStock: stockQty <= p.reorderLevel,
                models: models.length > 0 ? models : ['Universal / Multi-Fit'],
              };
            });
            dbSuccess = true;
          }
        } catch (dbErr) {
          console.warn('PostgreSQL fetch fallback:', dbErr);
        }
      }
    }

    // Filter by query and make
    let filtered = formatted;
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.partNumber.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.models.some((m: string) => m.toLowerCase().includes(q))
      );
    }
    if (make && make !== 'ALL') {
      filtered = filtered.filter((p) =>
        p.models.some((m: string) => m.toLowerCase().startsWith(make.toLowerCase()))
      );
    }
    if (lowStockOnly) {
      filtered = filtered.filter((p) => p.isLowStock);
    }

    return NextResponse.json({ success: true, count: filtered.length, products: filtered });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can create catalog products' },
        { status: 403 }
      );
    }
    const targetTenantId = authUser.tenantId;

    const body = await req.json();

    const {
      name,
      partNumber,
      brand,
      category,
      hsnCode = '8714',
      gstRateBp = 1800,
      unit = 'pcs',
      reorderLevel = 10,
      bikeModelIds = [],
    } = body;

    const openingStock = body.openingStock !== undefined ? body.openingStock : (body.stockQty !== undefined ? body.stockQty : 0);

    let salePricePaise = body.salePricePaise;
    if (salePricePaise === undefined && body.salePriceRupees !== undefined) {
      salePricePaise = Math.round(Number(body.salePriceRupees) * 100);
    }
    let purchasePricePaise = body.purchasePricePaise !== undefined ? body.purchasePricePaise : 0;
    if (purchasePricePaise === 0 && body.purchasePriceRupees !== undefined) {
      purchasePricePaise = Math.round(Number(body.purchasePriceRupees) * 100);
    }
    let mrpPaise = body.mrpPaise !== undefined ? body.mrpPaise : 0;
    if (mrpPaise === 0 && body.mrpRupees !== undefined) {
      mrpPaise = Math.round(Number(body.mrpRupees) * 100);
    }

    if (!name || salePricePaise === undefined) {
      return NextResponse.json(
        { error: 'Product name and sale price are required' },
        { status: 400 }
      );
    }

    let createdProd: any = null;

    // 1. Try Prisma first if available and targetTenantId is a valid UUID
    const hasDb = await isPostgresAvailable();
    const dbTenantId = isUuid(targetTenantId) ? targetTenantId : null;

    // Fail-safe: In production / PostgreSQL storage mode, never silently fall back to localStore
    if (getStorageMode() === 'POSTGRES' && !hasDb) {
      return NextResponse.json(
        { error: 'Database service unavailable. Product record cannot be safely saved.' },
        { status: 503 }
      );
    }

    if (hasDb && dbTenantId) {
      try {
        const product = await prisma.product.create({
          data: {
            tenantId: dbTenantId,
            name,
            partNumber: partNumber || null,
            brand: brand || null,
            category: category || null,
            hsnCode: hsnCode || '8714',
            gstRateBp: parseInt(gstRateBp, 10),
            unit: unit || 'pcs',
            purchasePrice: BigInt(purchasePricePaise || 0),
            salePrice: BigInt(salePricePaise),
            mrp: BigInt(mrpPaise || 0),
            reorderLevel: parseInt(reorderLevel, 10) || 0,
            isActive: true,
          }
        });

        if (parseInt(openingStock, 10) > 0) {
          await prisma.stockMovement.create({
            data: {
              tenantId: dbTenantId,
              productId: product.id,
              qty: parseInt(openingStock, 10),
              reason: StockReason.OPENING,
              unitCost: BigInt(purchasePricePaise || 0),
              createdBy: authUser?.id && isUuid(authUser.id) ? authUser.id : null,
            }
          });
        }

        createdProd = {
          id: product.id,
          name: product.name,
          partNumber: product.partNumber,
          salePricePaise: product.salePrice?.toString(),
          stockQty: parseInt(openingStock, 10) || 0,
        };
      } catch (dbErr: any) {
        if (getStorageMode() === 'POSTGRES') {
          console.error('Postgres error during product create:', dbErr?.message);
          return NextResponse.json(
            { error: 'Failed to create product in database' },
            { status: 500 }
          );
        }
        console.warn('Postgres unavailable during product create, using localStore fallback');
      }
    }

    // 2. Always persist in localStore as well for resilience
    const localProd = localStore.createProduct({
      tenantId: targetTenantId,
      name,
      partNumber: partNumber || undefined,
      brand: brand || undefined,
      category: category || undefined,
      hsnCode: hsnCode || '8714',
      gstRateBp: parseInt(gstRateBp, 10),
      unit: unit || 'pcs',
      purchasePricePaise: String(purchasePricePaise || 0),
      salePricePaise: String(salePricePaise),
      mrpPaise: String(mrpPaise || 0),
      stockQty: parseInt(openingStock, 10) || 0,
      reorderLevel: parseInt(reorderLevel, 10) || 0,
      models: Array.isArray(bikeModelIds) && bikeModelIds.length > 0 ? bikeModelIds : ['Universal / Multi-Fit'],
    });

    const resultProd = createdProd || localProd;

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'PRODUCT_CREATED',
      entity: 'PRODUCT',
      entityId: resultProd.id,
      after: {
        name: resultProd.name,
        partNumber: resultProd.partNumber,
        salePricePaise: resultProd.salePricePaise,
        stockQty: resultProd.stockQty,
      },
    });

    return NextResponse.json({
      success: true,
      product: resultProd,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
