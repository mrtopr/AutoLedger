import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { StockReason } from '@prisma/client';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function POST(
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
        { error: 'Forbidden: only OWNER or MANAGER can adjust stock' },
        { status: 403 }
      );
    }
    const targetTenantId = authUser.tenantId;
    const productId = params.id;
    const body = await req.json();

    const { qty, qtyDelta, reason = 'ADJUSTMENT', unitCostPaise = 0 } = body;
    const rawQty = qty !== undefined ? qty : qtyDelta;

    if (rawQty === undefined || rawQty === null) {
      return NextResponse.json({ error: 'Quantity change is required' }, { status: 400 });
    }

    const delta = parseInt(rawQty, 10);

    // 1. Try Prisma if available and productId is a valid UUID
    const hasDb = await isPostgresAvailable();
    let dbSuccess = false;

    if (hasDb && isUuid(productId) && isUuid(targetTenantId)) {
      try {
        const product = await prisma.product.findFirst({
          where: { id: productId, tenantId: targetTenantId },
        });

        if (!product) {
          return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
        }

        let stockReason: StockReason = StockReason.ADJUSTMENT;
        if (reason === 'PURCHASE') stockReason = StockReason.PURCHASE;
        else if (reason === 'RETURN_IN') stockReason = StockReason.RETURN_IN;
        else if (reason === 'RETURN_OUT') stockReason = StockReason.RETURN_OUT;
        else if (reason === 'OPENING') stockReason = StockReason.OPENING;

        await prisma.stockMovement.create({
          data: {
            tenantId: product.tenantId,
            productId: product.id,
            qty: delta,
            reason: stockReason,
            unitCost: unitCostPaise ? BigInt(unitCostPaise) : null,
            createdBy: (authUser?.id && isUuid(authUser.id)) ? authUser.id : null,
          }
        });
        dbSuccess = true;
      } catch (dbErr) {
        console.warn('Postgres unavailable during stock adjustment, using localStore fallback:', dbErr);
      }
    }

    // 2. Validate tenant ownership in localStore
    const localProd = localStore.getProductById(productId, targetTenantId);
    if (!dbSuccess && !localProd) {
      return NextResponse.json({ error: 'Product not found in your organization' }, { status: 404 });
    }

    const updated = localStore.adjustProductStock(productId, delta, targetTenantId);

    await createAuditLog({
      tenantId: targetTenantId,
      userId: authUser.id,
      action: 'STOCK_ADJUSTED',
      entity: 'PRODUCT',
      entityId: productId,
      after: {
        qtyDelta: delta,
        reason,
        unitCostPaise,
        newStockQty: updated?.stockQty || delta,
      },
    });

    return NextResponse.json({
      success: true,
      newStockQty: updated?.stockQty || delta,
      product: updated,
    });
  } catch (error: any) {
    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
