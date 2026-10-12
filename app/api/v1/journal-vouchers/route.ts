import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function toBigIntPaise(val: any): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(Math.round(val));
  if (typeof val === 'string') {
    const num = parseFloat(val);
    if (!isNaN(num)) return BigInt(Math.round(num));
  }
  return 0n;
}

function fmtEntry(e: any) {
  return {
    ...e,
    lines: e.lines?.map((l: any) => ({
      ...l,
      debit: (l.debit ?? 0n).toString(),
      credit: (l.credit ?? 0n).toString(),
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ success: true, vouchers: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ success: true, vouchers: [] });

    const { searchParams } = new URL(req.url);
    const from  = searchParams.get('from');
    const to    = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    const where: any = { tenantId };
    if (from || to) {
      where.voucherDate = {};
      if (from) where.voucherDate.gte = new Date(from);
      if (to)   where.voucherDate.lte = new Date(to);
    }

    const vouchers = await prisma.journalVoucher.findMany({
      where,
      include: {
        lines: true,
      },
      orderBy: { voucherDate: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, vouchers: vouchers.map(fmtEntry) });
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
    const { voucherDate, narration, lines = [] } = body;

    if (!voucherDate) {
      return NextResponse.json({ error: 'voucherDate is required' }, { status: 400 });
    }

    const parsedDate = new Date(voucherDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid voucherDate format' }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json({ error: 'At least 2 lines required for a journal voucher' }, { status: 400 });
    }

    // Parse debits and credits safely into BigInt paise
    const parsedLines = lines.map((l: any) => ({
      accountId: l.accountId,
      debit: toBigIntPaise(l.debit),
      credit: toBigIntPaise(l.credit),
      narration: l.narration || null,
    }));

    // Verify each line has valid amounts and non-negative values
    for (const l of parsedLines) {
      if (l.debit < 0n || l.credit < 0n) {
        return NextResponse.json({ error: 'Debit and credit values cannot be negative' }, { status: 400 });
      }
      if (l.debit === 0n && l.credit === 0n) {
        return NextResponse.json({ error: 'Each line must have either a debit or credit amount' }, { status: 400 });
      }
    }

    // Validate double-entry: sum of Dr must equal sum of Cr
    const totalDr = parsedLines.reduce((s: bigint, l) => s + l.debit, 0n);
    const totalCr = parsedLines.reduce((s: bigint, l) => s + l.credit, 0n);

    if (totalDr <= 0n) {
      return NextResponse.json({ error: 'Total voucher amount must be greater than zero' }, { status: 400 });
    }

    if (totalDr !== totalCr) {
      return NextResponse.json({
        error: `Journal is not balanced. Total Dr: ₹${(Number(totalDr) / 100).toFixed(2)}, Total Cr: ₹${(Number(totalCr) / 100).toFixed(2)}`,
      }, { status: 400 });
    }

    // Generate JV number
    const existing = await prisma.journalVoucher.count({ where: { tenantId } });
    const jvNumber = `JV/2026-27/${String(existing + 1).padStart(4, '0')}`;

    // Verify all account IDs belong to this tenant
    for (const line of parsedLines) {
      if (!isUuid(line.accountId)) {
        return NextResponse.json({ error: `Invalid accountId: ${line.accountId}` }, { status: 400 });
      }
      const acc = await prisma.account.findFirst({ where: { id: line.accountId, tenantId } });
      if (!acc) {
        return NextResponse.json({ error: `Account not found: ${line.accountId}` }, { status: 404 });
      }
    }

    const voucher = await prisma.$transaction(async (tx: any) => {
      const v = await tx.journalVoucher.create({
        data: {
          tenantId,
          number: jvNumber,
          voucherDate: parsedDate,
          narration: narration || null,
          isBalanced: true,
          createdBy: authUser?.id || null,
          lines: {
            create: parsedLines.map((l: any) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              narration: l.narration,
            })),
          },
        },
        include: { lines: true },
      });

      // Post each line to GL
      await tx.gLEntry.createMany({
        data: parsedLines.map((l: any) => ({
          tenantId,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          narration: narration || l.narration || null,
          refType: 'JOURNAL',
          refId: v.id,
          entryDate: parsedDate,
          voucherId: v.id,
          createdBy: authUser?.id || null,
        })),
      });

      return v;
    });

    return NextResponse.json({ success: true, voucher: fmtEntry(voucher) }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Voucher number already exists' }, { status: 409 });
    }
    console.error('Journal Voucher POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
