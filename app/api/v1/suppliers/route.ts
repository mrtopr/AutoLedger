import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ success: true, suppliers: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ success: true, suppliers: [] });

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { purchaseOrders: true, debitNotes: true, goodsReceipts: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        gstin: s.gstin,
        address: s.address,
        email: s.email,
        creditDays: s.creditDays,
        poCount: s._count.purchaseOrders,
        grnCount: s._count.goodsReceipts,
        debitNoteCount: s._count.debitNotes,
        createdAt: s.createdAt,
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
    const { name, phone, gstin, address, email, creditDays = 30 } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: name.trim(),
        phone: phone?.trim() || null,
        gstin: gstin?.trim()?.toUpperCase() || null,
        address: address?.trim() || null,
        email: email?.trim() || null,
        creditDays: Number(creditDays) || 30,
      },
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
