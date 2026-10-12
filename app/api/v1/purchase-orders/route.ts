import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { PurchaseOrderStatus } from '@prisma/client';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ success: true, purchaseOrders: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ success: true, purchaseOrders: [] });

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');

    const where: any = { tenantId };
    if (supplierId && isUuid(supplierId)) where.supplierId = supplierId;
    if (status && Object.values(PurchaseOrderStatus).includes(status as any)) {
      where.status = status;
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, phone: true, gstin: true } },
        items: true,
        _count: { select: { grns: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      purchaseOrders: orders.map((po) => ({
        id: po.id,
        number: po.number,
        status: po.status,
        orderDate: po.orderDate,
        expectedBy: po.expectedBy,
        notes: po.notes,
        subtotalPaise: po.subtotal.toString(),
        taxTotalPaise: po.taxTotal.toString(),
        grandTotalPaise: po.grandTotal.toString(),
        supplier: po.supplier,
        itemCount: po.items.length,
        items: po.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          description: it.description,
          qtyOrdered: Number(it.qtyOrdered),
          qtyReceived: Number(it.qtyReceived),
          unit: it.unit,
          ratePaise: it.rate.toString(),
          gstRateBp: it.gstRateBp,
          taxableValuePaise: it.taxableValue.toString(),
          taxAmountPaise: it.taxAmount.toString(),
          lineTotalPaise: it.lineTotal.toString(),
        })),
        grnCount: po._count.grns,
        createdAt: po.createdAt,
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
      supplierId,
      orderDate,
      expectedBy,
      notes,
      items = [],
    } = body;

    if (!supplierId || !isUuid(supplierId)) {
      return NextResponse.json({ error: 'Valid supplierId is required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    // Verify supplier
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Generate PO Number
    const count = await prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO/2026-27/${String(count + 1).padStart(4, '0')}`;

    // Compute totals
    let subtotalPaise = 0n;
    let taxTotalPaise = 0n;

    const parsedItems = items.map((it: any) => {
      const qty = parseFloat(it.qtyOrdered || it.qty || '1');
      const rate = BigInt(Math.round(parseFloat(it.rate || it.ratePaise || '0')));
      const gstRateBp = Number(it.gstRateBp || 1800); // default 18%

      // Item total calculation
      const taxable = BigInt(Math.round(qty * Number(rate)));
      const tax = (taxable * BigInt(gstRateBp)) / 10000n;
      const lineTotal = taxable + tax;

      subtotalPaise += taxable;
      taxTotalPaise += tax;

      return {
        productId: it.productId && isUuid(it.productId) ? it.productId : null,
        description: it.description || it.name || 'Purchased Item',
        qtyOrdered: qty,
        unit: it.unit || 'pcs',
        rate,
        gstRateBp,
        taxableValue: taxable,
        taxAmount: tax,
        lineTotal,
      };
    });

    const grandTotalPaise = subtotalPaise + taxTotalPaise;

    const order = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId,
        number: poNumber,
        status: PurchaseOrderStatus.DRAFT,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedBy: expectedBy ? new Date(expectedBy) : null,
        notes: notes || null,
        subtotal: subtotalPaise,
        taxTotal: taxTotalPaise,
        grandTotal: grandTotalPaise,
        createdBy: authUser?.id || null,
        items: {
          create: parsedItems.map((p) => ({
            productId: p.productId,
            description: p.description,
            qtyOrdered: p.qtyOrdered,
            unit: p.unit,
            rate: p.rate,
            gstRateBp: p.gstRateBp,
            taxableValue: p.taxableValue,
            taxAmount: p.taxAmount,
            lineTotal: p.lineTotal,
          })),
        },
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        ...order,
        subtotalPaise: order.subtotal.toString(),
        taxTotalPaise: order.taxTotal.toString(),
        grandTotalPaise: order.grandTotal.toString(),
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
