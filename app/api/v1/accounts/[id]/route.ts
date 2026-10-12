import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    const accountId = params.id;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isUuid(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId },
      include: {
        glEntries: {
          orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
          take: 500,
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Compute running balance statement (Tally ledger style)
    let runningDr = account.openingDr;
    let runningCr = account.openingCr;
    let currentBalance = runningDr - runningCr;

    const statementLines = account.glEntries.map((e) => {
      currentBalance = currentBalance + e.debit - e.credit;
      return {
        id: e.id,
        date: e.entryDate,
        narration: e.narration,
        refType: e.refType,
        refId: e.refId,
        debit: e.debit.toString(),
        credit: e.credit.toString(),
        runningBalancePaise: currentBalance.toString(),
        balanceType: currentBalance >= 0n ? 'Dr' : 'Cr',
      };
    });

    const totalDr = account.glEntries.reduce((s, e) => s + e.debit, 0n) + account.openingDr;
    const totalCr = account.glEntries.reduce((s, e) => s + e.credit, 0n) + account.openingCr;
    const closingBalance = totalDr - totalCr;

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        groupName: account.groupName,
        subGroup: account.subGroup,
        isSystem: account.isSystem,
        isActive: account.isActive,
        openingDr: account.openingDr.toString(),
        openingCr: account.openingCr.toString(),
        closingBalancePaise: closingBalance.toString(),
        closingBalanceType: closingBalance >= 0n ? 'Dr' : 'Cr',
        statement: statementLines,
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
    const accountId = params.id;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isUuid(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, subGroup, isActive, openingDr, openingCr } = body;

    const data: any = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof subGroup !== 'undefined') data.subGroup = subGroup || null;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof openingDr !== 'undefined') data.openingDr = BigInt(openingDr);
    if (typeof openingCr !== 'undefined') data.openingCr = BigInt(openingCr);

    const updated = await prisma.account.update({
      where: { id: accountId },
      data,
    });

    return NextResponse.json({
      success: true,
      account: {
        ...updated,
        openingDr: updated.openingDr.toString(),
        openingCr: updated.openingCr.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId;
    const accountId = params.id;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isUuid(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.isSystem) {
      return NextResponse.json(
        { error: 'System standard accounts cannot be deleted' },
        { status: 403 }
      );
    }

    const entryCount = await prisma.gLEntry.count({ where: { accountId } });
    if (entryCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete account with ${entryCount} existing transactions. Mark it inactive instead.` },
        { status: 409 }
      );
    }

    await prisma.account.delete({ where: { id: accountId } });

    return NextResponse.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
