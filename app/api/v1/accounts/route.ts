import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';

const isUuid = (id?: string | null) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Default Chart of Accounts seeded per tenant on first access
const DEFAULT_ACCOUNTS = [
  // ── Capital & Liabilities ──
  { code: '1001', name: 'Capital Account',           groupName: 'Capital',               subGroup: 'Capital' },
  { code: '1100', name: 'Current Liabilities',       groupName: 'Current Liabilities',   subGroup: null },
  { code: '1101', name: 'Sundry Creditors',          groupName: 'Current Liabilities',   subGroup: 'Sundry Creditors' },
  { code: '1102', name: 'GST Payable - CGST',        groupName: 'Current Liabilities',   subGroup: 'Duties & Taxes' },
  { code: '1103', name: 'GST Payable - SGST',        groupName: 'Current Liabilities',   subGroup: 'Duties & Taxes' },
  { code: '1104', name: 'GST Payable - IGST',        groupName: 'Current Liabilities',   subGroup: 'Duties & Taxes' },
  { code: '1105', name: 'TDS Payable',               groupName: 'Current Liabilities',   subGroup: 'Duties & Taxes' },
  // ── Assets ──
  { code: '2001', name: 'Cash in Hand',              groupName: 'Current Assets',        subGroup: 'Cash-in-Hand' },
  { code: '2002', name: 'Bank Account - Primary',    groupName: 'Current Assets',        subGroup: 'Bank Accounts' },
  { code: '2003', name: 'Sundry Debtors',            groupName: 'Current Assets',        subGroup: 'Sundry Debtors' },
  { code: '2004', name: 'Stock in Hand',             groupName: 'Current Assets',        subGroup: 'Stock-in-Hand' },
  { code: '2005', name: 'GST Input Credit - CGST',   groupName: 'Current Assets',        subGroup: 'Duties & Taxes' },
  { code: '2006', name: 'GST Input Credit - SGST',   groupName: 'Current Assets',        subGroup: 'Duties & Taxes' },
  { code: '2007', name: 'GST Input Credit - IGST',   groupName: 'Current Assets',        subGroup: 'Duties & Taxes' },
  { code: '2100', name: 'Fixed Assets',              groupName: 'Fixed Assets',          subGroup: null },
  // ── Income ──
  { code: '3001', name: 'Sales - Spare Parts',       groupName: 'Income',                subGroup: 'Direct Income' },
  { code: '3002', name: 'Sales Returns',             groupName: 'Income',                subGroup: 'Direct Income' },
  { code: '3003', name: 'Discount Received',         groupName: 'Income',                subGroup: 'Indirect Income' },
  { code: '3004', name: 'Interest Received',         groupName: 'Income',                subGroup: 'Indirect Income' },
  // ── Expenses ──
  { code: '4001', name: 'Purchases - Spare Parts',   groupName: 'Expense',               subGroup: 'Direct Expense' },
  { code: '4002', name: 'Purchase Returns',          groupName: 'Expense',               subGroup: 'Direct Expense' },
  { code: '4003', name: 'Salaries & Wages',          groupName: 'Expense',               subGroup: 'Indirect Expense' },
  { code: '4004', name: 'Rent',                      groupName: 'Expense',               subGroup: 'Indirect Expense' },
  { code: '4005', name: 'Electricity Charges',       groupName: 'Expense',               subGroup: 'Indirect Expense' },
  { code: '4006', name: 'Transportation Expense',    groupName: 'Expense',               subGroup: 'Indirect Expense' },
  { code: '4007', name: 'Discount Allowed',          groupName: 'Expense',               subGroup: 'Indirect Expense' },
  { code: '4008', name: 'Bank Charges',              groupName: 'Expense',               subGroup: 'Indirect Expense' },
  { code: '4009', name: 'Miscellaneous Expense',     groupName: 'Expense',               subGroup: 'Indirect Expense' },
];

async function ensureDefaultAccounts(tenantId: string) {
  const existing = await prisma.account.count({ where: { tenantId } });
  if (existing === 0) {
    await prisma.account.createMany({
      data: DEFAULT_ACCOUNTS.map(a => ({
        tenantId,
        code: a.code,
        name: a.name,
        groupName: a.groupName,
        subGroup: a.subGroup,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const tenantId = authUser?.tenantId;
    const groupName = searchParams.get('group');
    const withBalance = searchParams.get('withBalance') === 'true';

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ success: true, accounts: [] });
    }

    const hasDb = await isPostgresAvailable();
    if (!hasDb) {
      return NextResponse.json({ success: true, accounts: [] });
    }

    await ensureDefaultAccounts(tenantId);

    const whereClause: any = { tenantId, isActive: true };
    if (groupName) whereClause.groupName = groupName;

    const accounts = await prisma.account.findMany({
      where: whereClause,
      orderBy: [{ groupName: 'asc' }, { code: 'asc' }],
    });

    let result: any[] = accounts;

    if (withBalance) {
      // Compute running balance from GL entries
      result = await Promise.all(accounts.map(async (acc) => {
        const totals = await prisma.gLEntry.aggregate({
          where: { accountId: acc.id },
          _sum: { debit: true, credit: true },
        });
        const dr = (acc.openingDr || 0n) + (totals._sum.debit || 0n);
        const cr = (acc.openingCr || 0n) + (totals._sum.credit || 0n);
        const balance = dr - cr; // positive = Dr balance, negative = Cr balance
        return {
          ...acc,
          openingDr: acc.openingDr.toString(),
          openingCr: acc.openingCr.toString(),
          totalDr: dr.toString(),
          totalCr: cr.toString(),
          balancePaise: balance.toString(),
          balanceType: balance >= 0n ? 'Dr' : 'Cr',
        };
      }));
    } else {
      result = accounts.map(acc => ({
        ...acc,
        openingDr: acc.openingDr.toString(),
        openingCr: acc.openingCr.toString(),
      }));
    }

    return NextResponse.json({ success: true, accounts: result });
  } catch (error: any) {
    console.error('Accounts GET error:', error);
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
    const { code, name, groupName, subGroup, openingDr = 0, openingCr = 0 } = body;

    if (!code || !name || !groupName) {
      return NextResponse.json({ error: 'code, name, and groupName are required' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        tenantId,
        code,
        name,
        groupName,
        subGroup: subGroup || null,
        openingDr: BigInt(openingDr),
        openingCr: BigInt(openingCr),
        isSystem: false,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        openingDr: account.openingDr.toString(),
        openingCr: account.openingCr.toString(),
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
    }
    console.error('Account POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
