import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { postDebitNoteGLEntries } from '@/server/lib/gl';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ success: true, debitNotes: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ success: true, debitNotes: [] });

    const debitNotes = await prisma.debitNote.findMany({
      where: { tenantId },
      include: { supplier: { select: { id: true, name: true, phone: true, gstin: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      debitNotes: debitNotes.map(d => ({
        ...d,
        amount: d.amount.toString(),
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
    if (!hasDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await req.json();
    const { supplierId, reason, amountPaise, items = [], restock = true } = body;

    if (!supplierId || !isUuid(supplierId)) {
      return NextResponse.json({ error: 'Valid supplierId is required' }, { status: 400 });
    }
    if (!amountPaise || BigInt(amountPaise) <= 0n) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Validate supplier belongs to tenant
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Generate debit note number
    const count = await prisma.debitNote.count({ where: { tenantId } });
    const dnNumber = `DN/2026-27/${String(count + 1).padStart(4, '0')}`;

    const debitNote = await prisma.$transaction(async (tx) => {
      const dn = await tx.debitNote.create({
        data: {
          tenantId,
          supplierId,
          number: dnNumber,
          reason: reason || null,
          amount: BigInt(amountPaise),
          items: items.length > 0 ? items : null,
          restock,
          createdBy: authUser?.id || null,
        },
      });

      // Restock: add positive stock movements for each item
      if (restock && items.length > 0) {
        for (const item of items) {
          if (item.productId && isUuid(item.productId) && item.qty > 0) {
            await tx.stockMovement.create({
              data: {
                tenantId,
                productId: item.productId,
                qty: Math.abs(item.qty),
                reason: 'RETURN_IN',
                refType: 'DEBIT_NOTE',
                refId: dn.id,
                unitCost: item.ratePaise ? BigInt(item.ratePaise) : null,
              },
            });
          }
        }
      }

      return dn;
    });

    // Auto-post to Double-Entry General Ledger (Tally GL Parity)
    await postDebitNoteGLEntries({
      tenantId,
      debitNoteId: debitNote.id,
      number: debitNote.number,
      amount: debitNote.amount,
      entryDate: debitNote.createdAt,
      createdBy: authUser?.id || null,
    });

    return NextResponse.json({
      success: true,
      debitNote: { ...debitNote, amount: debitNote.amount.toString() },
    }, { status: 201 });
  } catch (error: any) {
    console.error('DebitNote POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
