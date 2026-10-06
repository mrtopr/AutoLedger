import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { StockReason } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const make = searchParams.get('make') || '';
    const category = searchParams.get('category') || '';
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    let formatted: any[] = [];

    // 1. Try Prisma first if Postgres is reachable
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const products = await prisma.product.findMany({
          where: {
            ...(authUser ? { tenantId: authUser.tenantId } : {}),
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
              stockQty: stockQty,
              reorderLevel: p.reorderLevel,
              isLowStock: stockQty <= p.reorderLevel,
              models: models.length > 0 ? models : ['Universal / Multi-Fit'],
            };
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable for products GET, using localStore fallback');
      }
    }

    // 2. If no products from DB or DB offline, use localStore
    if (formatted.length === 0) {
      const localProducts = localStore.getProducts(authUser?.tenantId);
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
    const body = await req.json();

    const {
      name,
      partNumber,
      brand,
      category,
      hsnCode = '8714',
      gstRateBp = 1800,
      unit = 'pcs',
      purchasePricePaise = 0,
      salePricePaise,
      mrpPaise = 0,
      openingStock = 0,
      reorderLevel = 10,
      bikeModelIds = [],
    } = body;

    if (!name || salePricePaise === undefined) {
      return NextResponse.json(
        { error: 'Product name and sale price are required' },
        { status: 400 }
      );
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';
    let createdProd: any = null;

    // 1. Try Prisma first if available
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const product = await prisma.product.create({
          data: {
            tenantId: targetTenantId,
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
              tenantId: targetTenantId,
              productId: product.id,
              qty: parseInt(openingStock, 10),
              reason: StockReason.OPENING,
              unitCost: BigInt(purchasePricePaise || 0),
              createdBy: authUser?.id || null,
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
      } catch (dbErr) {
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

    return NextResponse.json({
      success: true,
      product: createdProd || localProd,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
