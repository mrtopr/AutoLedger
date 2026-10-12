import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { PurchaseOrderStatus } from '@prisma/client';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    const poId = params.id;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isUuid(poId)) {
      return NextResponse.json({ error: 'Invalid PO ID' }, { status: 400 });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
      include: {
        supplier: true,
        items: true,
        grns: { include: { lines: true } },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        ...po,
        subtotalPaise: po.subtotal.toString(),
        taxTotalPaise: po.taxTotal.toString(),
        grandTotalPaise: po.grandTotal.toString(),
        items: po.items.map((it) => ({
          ...it,
          qtyOrdered: Number(it.qtyOrdered),
          qtyReceived: Number(it.qtyReceived),
          ratePaise: it.rate.toString(),
          taxableValuePaise: it.taxableValue.toString(),
          taxAmountPaise: it.taxAmount.toString(),
          lineTotalPaise: it.lineTotal.toString(),
        })),
        grns: po.grns.map((g) => ({
          ...g,
          totalAmountPaise: g.totalAmount.toString(),
          lines: g.lines.map((l) => ({
            ...l,
            qtyReceived: Number(l.qtyReceived),
            unitCostPaise: l.unitCost.toString(),
            lineTotalPaise: l.lineTotal.toString(),
          })),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    const poId = params.id;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isUuid(poId)) {
      return NextResponse.json({ error: 'Invalid PO ID' }, { status: 400 });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
    });
    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    const body = await req.json();
    const { status, notes } = body;

    const data: any = {};
    if (status && Object.values(PurchaseOrderStatus).includes(status)) {
      data.status = status;
    }
    if (typeof notes === 'string') {
      data.notes = notes;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data,
    });

    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
