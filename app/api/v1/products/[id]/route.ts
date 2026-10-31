import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;
    const productId = params.id;

    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(productId) && isUuid(targetTenantId)) {
      try {
        const product = await prisma.product.findFirst({
          where: { id: productId, tenantId: targetTenantId },
          include: {
            compatibilities: { include: { bikeModel: true } },
            stockMovements: { select: { qty: true } },
          },
        });

        if (product) {
          const stockQty = product.stockMovements.reduce((sum, m) => sum + m.qty, 0);
          const models = product.compatibilities.map((c) => `${c.bikeModel.make} ${c.bikeModel.model}`);
          return NextResponse.json({
            success: true,
            product: {
              id: product.id,
              name: product.name,
              partNumber: product.partNumber || '',
              brand: product.brand || 'Unbranded',
              category: product.category || 'General',
              hsnCode: product.hsnCode || '8714',
              gstRateBp: product.gstRateBp,
              unit: product.unit,
              purchasePricePaise: product.purchasePrice?.toString() || '0',
              salePricePaise: product.salePrice?.toString() || '0',
              mrpPaise: product.mrp?.toString() || '0',
              stockQty,
              reorderLevel: product.reorderLevel,
              isLowStock: stockQty <= product.reorderLevel,
              models: models.length > 0 ? models : ['Universal / Multi-Fit'],
            },
          });
        }
      } catch (dbErr) {
        console.warn('Postgres GET product error, falling back:', dbErr);
      }
    }

    const localProd = localStore.getProductById(productId, targetTenantId);
    if (!localProd) {
      return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product: {
        ...localProd,
        isLowStock: localProd.stockQty <= localProd.reorderLevel,
      },
    });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can modify catalog products' },
        { status: 403 }
      );
    }
    const targetTenantId = authUser.tenantId;
    const productId = params.id;
    const body = await req.json();

    const {
      name,
      partNumber,
      brand,
      category,
      hsnCode,
      gstRateBp,
      unit,
      purchasePricePaise,
      salePricePaise,
      mrpPaise,
      reorderLevel,
      models,
    } = body;

    const hasDb = await isPostgresAvailable();
    let dbUpdated = false;

    if (hasDb && isUuid(productId) && isUuid(targetTenantId)) {
      try {
        const existing = await prisma.product.findFirst({
          where: { id: productId, tenantId: targetTenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
        }

        await prisma.product.update({
          where: { id: productId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(partNumber !== undefined ? { partNumber } : {}),
            ...(brand !== undefined ? { brand } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(hsnCode !== undefined ? { hsnCode } : {}),
            ...(gstRateBp !== undefined ? { gstRateBp: parseInt(gstRateBp, 10) } : {}),
            ...(unit !== undefined ? { unit } : {}),
            ...(purchasePricePaise !== undefined ? { purchasePrice: BigInt(purchasePricePaise) } : {}),
            ...(salePricePaise !== undefined ? { salePrice: BigInt(salePricePaise) } : {}),
            ...(mrpPaise !== undefined ? { mrp: BigInt(mrpPaise) } : {}),
            ...(reorderLevel !== undefined ? { reorderLevel: parseInt(reorderLevel, 10) } : {}),
          },
        });
        dbUpdated = true;
      } catch (dbErr) {
        console.warn('Postgres product update error, continuing with local store:', dbErr);
      }
    }

    const updated = localStore.updateProduct(productId, {
      ...(name !== undefined ? { name } : {}),
      ...(partNumber !== undefined ? { partNumber } : {}),
      ...(brand !== undefined ? { brand } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(hsnCode !== undefined ? { hsnCode } : {}),
      ...(gstRateBp !== undefined ? { gstRateBp: parseInt(gstRateBp, 10) } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(purchasePricePaise !== undefined ? { purchasePricePaise: String(purchasePricePaise) } : {}),
      ...(salePricePaise !== undefined ? { salePricePaise: String(salePricePaise) } : {}),
      ...(mrpPaise !== undefined ? { mrpPaise: String(mrpPaise) } : {}),
      ...(reorderLevel !== undefined ? { reorderLevel: parseInt(reorderLevel, 10) } : {}),
      ...(models !== undefined ? { models } : {}),
    }, targetTenantId);

    if (!dbUpdated && !updated) {
      return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'PRODUCT_UPDATED',
      entity: 'PRODUCT',
      entityId: productId,
      after: {
        name,
        partNumber,
        salePricePaise,
        purchasePricePaise,
        mrpPaise,
        reorderLevel,
      },
    });

    return NextResponse.json({
      success: true,
      product: updated || { id: productId, ...body },
    });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can delete catalog products' },
        { status: 403 }
      );
    }
    const targetTenantId = authUser.tenantId;
    const productId = params.id;

    const hasDb = await isPostgresAvailable();
    let dbDeleted = false;

    if (hasDb && isUuid(productId) && isUuid(targetTenantId)) {
      try {
        const existing = await prisma.product.findFirst({
          where: { id: productId, tenantId: targetTenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
        }

        await prisma.product.update({
          where: { id: productId },
          data: { isActive: false },
        });
        dbDeleted = true;
      } catch (dbErr) {
        console.warn('Postgres delete product error, falling back:', dbErr);
      }
    }

    const localDeleted = localStore.deleteProduct(productId, targetTenantId);
    if (!dbDeleted && !localDeleted) {
      return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
    }

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'PRODUCT_DELETED',
      entity: 'PRODUCT',
      entityId: productId,
    });

    return NextResponse.json({
      success: true,
      message: 'Product removed successfully',
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete product' }, { status: 500 });
  }
}
