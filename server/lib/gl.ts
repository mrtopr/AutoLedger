import { prisma } from './prisma';

export const DEFAULT_ACCOUNTS = [
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

export async function ensureDefaultAccounts(tenantId: string) {
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

export async function getAccountByCode(tenantId: string, code: string) {
  await ensureDefaultAccounts(tenantId);
  return prisma.account.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });
}

/**
 * Posts balanced double-entry GL records for a customer sales invoice.
 * DR: Cash in Hand (cashAmt)
 * DR: Bank Account (upiAmt)
 * DR: Sundry Debtors (creditAmt)
 * CR: Sales (taxableValue)
 * CR: CGST Payable (cgst)
 * CR: SGST Payable (sgst)
 * CR: IGST Payable (igst)
 */
export async function postInvoiceGLEntries(params: {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  entryDate: Date;
  grandTotal: bigint;
  taxableValue: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  cashAmt: bigint;
  upiAmt: bigint;
  creditAmt: bigint;
  createdBy?: string | null;
}) {
  const {
    tenantId,
    invoiceId,
    invoiceNumber,
    entryDate,
    grandTotal,
    taxableValue,
    cgst,
    sgst,
    igst,
    cashAmt,
    upiAmt,
    creditAmt,
    createdBy,
  } = params;

  await ensureDefaultAccounts(tenantId);

  // Accounts lookup
  const cashAcc = await getAccountByCode(tenantId, '2001'); // Cash in Hand
  const bankAcc = await getAccountByCode(tenantId, '2002'); // Bank Account - Primary
  const debtorsAcc = await getAccountByCode(tenantId, '2003'); // Sundry Debtors
  const salesAcc = await getAccountByCode(tenantId, '3001'); // Sales
  const cgstAcc = await getAccountByCode(tenantId, '1102'); // CGST Payable
  const sgstAcc = await getAccountByCode(tenantId, '1103'); // SGST Payable
  const igstAcc = await getAccountByCode(tenantId, '1104'); // IGST Payable

  if (!salesAcc) {
    console.warn(`[GL] Sales account not found for tenant ${tenantId}`);
    return;
  }

  const entries: {
    tenantId: string;
    accountId: string;
    debit: bigint;
    credit: bigint;
    narration: string;
    refType: string;
    refId: string;
    entryDate: Date;
    createdBy?: string | null;
  }[] = [];

  // DEBITS
  if (cashAmt > 0n && cashAcc) {
    entries.push({
      tenantId,
      accountId: cashAcc.id,
      debit: cashAmt,
      credit: 0n,
      narration: `Cash received on Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  if (upiAmt > 0n && bankAcc) {
    entries.push({
      tenantId,
      accountId: bankAcc.id,
      debit: upiAmt,
      credit: 0n,
      narration: `Digital payment on Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  if (creditAmt > 0n && debtorsAcc) {
    entries.push({
      tenantId,
      accountId: debtorsAcc.id,
      debit: creditAmt,
      credit: 0n,
      narration: `Sundry debtor credit for Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  // CREDITS
  if (taxableValue > 0n) {
    entries.push({
      tenantId,
      accountId: salesAcc.id,
      debit: 0n,
      credit: taxableValue,
      narration: `Sales revenue for Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  if (cgst > 0n && cgstAcc) {
    entries.push({
      tenantId,
      accountId: cgstAcc.id,
      debit: 0n,
      credit: cgst,
      narration: `CGST Output for Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  if (sgst > 0n && sgstAcc) {
    entries.push({
      tenantId,
      accountId: sgstAcc.id,
      debit: 0n,
      credit: sgst,
      narration: `SGST Output for Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  if (igst > 0n && igstAcc) {
    entries.push({
      tenantId,
      accountId: igstAcc.id,
      debit: 0n,
      credit: igst,
      narration: `IGST Output for Invoice #${invoiceNumber}`,
      refType: 'INVOICE',
      refId: invoiceId,
      entryDate,
      createdBy,
    });
  }

  // Double check balance integrity
  const totalDr = entries.reduce((s, e) => s + e.debit, 0n);
  const totalCr = entries.reduce((s, e) => s + e.credit, 0n);

  if (totalDr !== totalCr) {
    console.warn(`[GL] Double-entry mismatch in Invoice #${invoiceNumber}: Dr=${totalDr}, Cr=${totalCr}`);
    // Adjust rounding difference to sales if trivial (within 100 paise)
    const diff = totalDr - totalCr;
    if (diff !== 0n && Math.abs(Number(diff)) <= 100) {
      const salesEntry = entries.find(e => e.accountId === salesAcc.id);
      if (salesEntry) {
        salesEntry.credit += diff;
      }
    }
  }

  if (entries.length > 0) {
    await prisma.gLEntry.createMany({ data: entries });
  }
}

/**
 * Posts double-entry GL records for a customer receipt/payment.
 * DR: Cash in Hand (if CASH) OR Bank Account (if BANK/UPI/CHEQUE)
 * CR: Sundry Debtors
 */
export async function postPaymentGLEntries(params: {
  tenantId: string;
  paymentId: string;
  amount: bigint;
  mode: string;
  reference?: string | null;
  entryDate: Date;
  createdBy?: string | null;
}) {
  const { tenantId, paymentId, amount, mode, reference, entryDate, createdBy } = params;

  if (amount <= 0n) return;

  await ensureDefaultAccounts(tenantId);
  const isCash = mode === 'CASH';
  const debitAccCode = isCash ? '2001' : '2002';

  const debitAcc = await getAccountByCode(tenantId, debitAccCode);
  const debtorsAcc = await getAccountByCode(tenantId, '2003');

  if (!debitAcc || !debtorsAcc) return;

  await prisma.gLEntry.createMany({
    data: [
      {
        tenantId,
        accountId: debitAcc.id,
        debit: amount,
        credit: 0n,
        narration: `Payment receipt via ${mode} (${reference || 'Direct'})`,
        refType: 'PAYMENT',
        refId: paymentId,
        entryDate,
        createdBy,
      },
      {
        tenantId,
        accountId: debtorsAcc.id,
        debit: 0n,
        credit: amount,
        narration: `Settlement of Sundry Debtors via ${mode} (${reference || 'Direct'})`,
        refType: 'PAYMENT',
        refId: paymentId,
        entryDate,
        createdBy,
      },
    ],
  });
}

/**
 * Posts double-entry GL records for a Debit Note (Purchase return / supplier credit adjustment).
 * DR: Sundry Creditors (reduces liability to supplier)
 * CR: Purchase Returns
 */
export async function postDebitNoteGLEntries(params: {
  tenantId: string;
  debitNoteId: string;
  number: string;
  amount: bigint;
  entryDate: Date;
  createdBy?: string | null;
}) {
  const { tenantId, debitNoteId, number, amount, entryDate, createdBy } = params;

  if (amount <= 0n) return;

  await ensureDefaultAccounts(tenantId);
  const creditorsAcc = await getAccountByCode(tenantId, '1101'); // Sundry Creditors
  const purchaseReturnAcc = await getAccountByCode(tenantId, '4002'); // Purchase Returns

  if (!creditorsAcc || !purchaseReturnAcc) return;

  await prisma.gLEntry.createMany({
    data: [
      {
        tenantId,
        accountId: creditorsAcc.id,
        debit: amount,
        credit: 0n,
        narration: `Debit Note #${number} issued to supplier`,
        refType: 'DEBIT_NOTE',
        refId: debitNoteId,
        entryDate,
        createdBy,
      },
      {
        tenantId,
        accountId: purchaseReturnAcc.id,
        debit: 0n,
        credit: amount,
        narration: `Purchase return on Debit Note #${number}`,
        refType: 'DEBIT_NOTE',
        refId: debitNoteId,
        entryDate,
        createdBy,
      },
    ],
  });
}

/**
 * Posts double-entry GL records for a Goods Receipt Note (GRN - Stock in from supplier).
 * DR: Purchases - Spare Parts (4001)
 * CR: Sundry Creditors (1101)
 */
export async function postGRNGLEntries(params: {
  tenantId: string;
  grnId: string;
  number: string;
  supplierName: string;
  amount: bigint;
  entryDate: Date;
  createdBy?: string | null;
}) {
  const { tenantId, grnId, number, supplierName, amount, entryDate, createdBy } = params;

  if (amount <= 0n) return;

  await ensureDefaultAccounts(tenantId);
  const purchaseAcc = await getAccountByCode(tenantId, '4001'); // Purchases
  const creditorsAcc = await getAccountByCode(tenantId, '1101'); // Sundry Creditors

  if (!purchaseAcc || !creditorsAcc) return;

  await prisma.gLEntry.createMany({
    data: [
      {
        tenantId,
        accountId: purchaseAcc.id,
        debit: amount,
        credit: 0n,
        narration: `Goods Received Note #${number} from ${supplierName}`,
        refType: 'GRN',
        refId: grnId,
        entryDate,
        createdBy,
      },
      {
        tenantId,
        accountId: creditorsAcc.id,
        debit: 0n,
        credit: amount,
        narration: `Sundry Creditor payable for GRN #${number} (${supplierName})`,
        refType: 'GRN',
        refId: grnId,
        entryDate,
        createdBy,
      },
    ],
  });
}

