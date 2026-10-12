import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { postGRNGLEntries } from '@/server/lib/gl';
import { PurchaseOrderStatus } from '@prisma/client';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ success: true, goodsReceipts: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ success: true, goodsReceipts: [] });

    const grns = await prisma.goodsReceipt.findMany({
      where: { tenantId },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        purchaseOrder: { select: { id: true, number: true } },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      goodsReceipts: grns.map((g) => ({
        id: g.id,
        number: g.number,
        receiptDate: g.receiptDate,
        supplier: g.supplier,
        poNumber: g.purchaseOrder?.number || null,
        poId: g.poId,
        notes: g.notes,
        totalAmountPaise: g.totalAmount.toString(),
        lines: g.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          description: l.description,
          qtyReceived: Number(l.qtyReceived),
          unitCostPaise: l.unitCost.toString(),
          lineTotalPaise: l.lineTotal.toString(),
        })),
        createdAt: g.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const body = await req.json();
    const {
      poId,
      supplierId,
      receiptDate,
      notes,
      lines = [],
    } = body;

    if (!supplierId || !isUuid(supplierId)) {
      return NextResponse.json({ error: 'Valid supplierId is required' }, { status: 400 });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'At least one received item line is required' }, { status: 400 });
    }

    // Verify supplier
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Generate GRN Number
    const count = await prisma.goodsReceipt.count({ where: { tenantId } });
    const grnNumber = `GRN/2026-27/${String(count + 1).padStart(4, '0')}`;

    // Calculate line totals
    let totalGrnAmount = 0n;
    const parsedLines = lines.map((l: any) => {
      const qty = parseFloat(l.qtyReceived || l.qty || '0');
      const unitCost = BigInt(Math.round(parseFloat(l.unitCost || l.unitCostPaise || '0')));
      const lineTotal = BigInt(Math.round(qty * Number(unitCost)));
      totalGrnAmount += lineTotal;

      return {
        productId: l.productId && isUuid(l.productId) ? l.productId : null,
        poItemId: l.poItemId && isUuid(l.poItemId) ? l.poItemId : null,
        description: l.description || l.name || 'Received Item',
        qtyReceived: qty,
        unitCost,
        lineTotal,
      };
    });

    const grn = await prisma.$transaction(async (tx) => {
      // 1. Create Goods Receipt
      const createdGrn = await tx.goodsReceipt.create({
        data: {
          tenantId,
          supplierId,
          poId: poId && isUuid(poId) ? poId : null,
          number: grnNumber,
          receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
          notes: notes || null,
          totalAmount: totalGrnAmount,
          createdBy: authUser?.id || null,
          lines: {
            create: parsedLines.map((pl) => ({
              productId: pl.productId,
              description: pl.description,
              qtyReceived: pl.qtyReceived,
              unitCost: pl.unitCost,
              lineTotal: pl.lineTotal,
            })),
          },
        },
        include: { lines: true },
      });

      // 2. Auto-stock in: create StockMovement and update Product stock
      for (const pl of parsedLines) {
        if (pl.productId && pl.qtyReceived > 0) {
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: pl.productId,
              qty: pl.qtyReceived,
              reason: 'PURCHASE',
              refType: 'GRN',
              refId: createdGrn.id,
              unitCost: pl.unitCost,
            },
          });

          // Update latest purchase price on Product
          await tx.product.update({
            where: { id: pl.productId },
            data: {
              purchasePrice: pl.unitCost,
            },
          });
        }

        // 3. Update PurchaseItem qtyReceived if poItemId supplied
        if (pl.poItemId) {
          await tx.purchaseItem.update({
            where: { id: pl.poItemId },
            data: {
              qtyReceived: { increment: pl.qtyReceived },
            },
          });
        }
      }

      // 4. Update PO status if linked
      if (poId && isUuid(poId)) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: poId },
          include: { items: true },
        });

        if (po) {
          const allReceived = po.items.every(
            (it) => Number(it.qtyReceived) >= Number(it.qtyOrdered)
          );
          const anyReceived = po.items.some((it) => Number(it.qtyReceived) > 0);

          let newStatus = po.status;
          if (allReceived) {
            newStatus = PurchaseOrderStatus.RECEIVED;
          } else if (anyReceived) {
            newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
          }

          if (newStatus !== po.status) {
            await tx.purchaseOrder.update({
              where: { id: poId },
              data: { status: newStatus },
            });
          }
        }
      }

      return createdGrn;
    });

    // 5. Auto-post double-entry GL (Tally Parity)
    await postGRNGLEntries({
      tenantId,
      grnId: grn.id,
      number: grn.number,
      supplierName: supplier.name,
      amount: totalGrnAmount,
      entryDate: grn.receiptDate,
      createdBy: authUser?.id || null,
    });

    return NextResponse.json({
      success: true,
      goodsReceipt: {
        ...grn,
        totalAmountPaise: grn.totalAmount.toString(),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('GRN POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
