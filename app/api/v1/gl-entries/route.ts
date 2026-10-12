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
      return NextResponse.json({ success: true, entries: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) return NextResponse.json({ success: true, entries: [] });

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    const refType   = searchParams.get('refType');
    const from      = searchParams.get('from');
    const to        = searchParams.get('to');
    const limit     = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    const where: any = { tenantId };
    if (accountId && isUuid(accountId)) where.accountId = accountId;
    if (refType) where.refType = refType;
    if (from || to) {
      where.entryDate = {};
      if (from) where.entryDate.gte = new Date(from);
      if (to)   where.entryDate.lte = new Date(to);
    }

    const entries = await prisma.gLEntry.findMany({
      where,
      include: { account: { select: { code: true, name: true, groupName: true } } },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json({
      success: true,
      entries: entries.map(e => ({
        id: e.id,
        accountId: e.accountId,
        accountCode: e.account.code,
        accountName: e.account.name,
        accountGroup: e.account.groupName,
        debit: e.debit.toString(),
        credit: e.credit.toString(),
        narration: e.narration,
        refType: e.refType,
        refId: e.refId,
        entryDate: e.entryDate,
        createdAt: e.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
