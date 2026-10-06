import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { StockReason } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const productId = params.id;
    const body = await req.json();

    const { qty, reason = 'ADJUSTMENT', unitCostPaise = 0 } = body;

    if (qty === undefined || qty === null) {
      return NextResponse.json({ error: 'Quantity change is required' }, { status: 400 });
    }

    const delta = parseInt(qty, 10);

    // 1. Try Prisma if available
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });

        if (product) {
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
              createdBy: authUser?.id || null,
            }
          });
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable during stock adjustment, using localStore fallback');
      }
    }

    // 2. Adjust localStore product
    const updated = localStore.adjustProductStock(productId, delta);

    return NextResponse.json({
      success: true,
      newStockQty: updated?.stockQty || delta,
    });
  } catch (error: any) {
    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
