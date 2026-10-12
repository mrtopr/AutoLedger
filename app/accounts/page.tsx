'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Trash2, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown,
  Layers,
  Building2,
  Calendar,
  X,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  groupName: string;
  subGroup: string | null;
  isSystem: boolean;
  isActive: boolean;
  openingDr: string;
  openingCr: string;
  totalDr?: string;
  totalCr?: string;
  balancePaise?: string;
  balanceType?: 'Dr' | 'Cr';
}

interface GLEntry {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
  debit: string;
  credit: string;
  narration: string | null;
  refType: string | null;
  refId: string | null;
  entryDate: string;
  createdAt: string;
}

interface JournalLineInput {
  accountId: string;
  debitPaise: string;
  creditPaise: string;
  narration: string;
}

interface DebitNote {
  id: string;
  number: string;
  reason: string | null;
  amount: string;
  restock: boolean;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
    phone: string | null;
    gstin: string | null;
  };
}

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'chart' | 'gl' | 'jv' | 'debit_notes'>('chart');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  // Account creation modal
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccGroup, setNewAccGroup] = useState('Current Assets');
  const [newAccSubGroup, setNewAccSubGroup] = useState('');
  const [newAccOpeningDr, setNewAccOpeningDr] = useState('');
  const [newAccOpeningCr, setNewAccOpeningCr] = useState('');
  const [submittingAccount, setSubmittingAccount] = useState(false);

  // Journal Voucher modal
  const [showJVModal, setShowJVModal] = useState(false);
  const [jvDate, setJvDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [jvNarration, setJvNarration] = useState('');
  const [jvLines, setJvLines] = useState<JournalLineInput[]>([
    { accountId: '', debitPaise: '', creditPaise: '0', narration: '' },
    { accountId: '', debitPaise: '0', creditPaise: '', narration: '' },
  ]);
  const [submittingJV, setSubmittingJV] = useState(false);
  const [jvError, setJvError] = useState('');

  // Selected account statement modal
  const [selectedAccountForStatement, setSelectedAccountForStatement] = useState<Account | null>(null);
  const [accountStatement, setAccountStatement] = useState<any[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Load accounts
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/accounts?withBalance=true');
      const data = await res.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load GL entries
  const fetchGLEntries = async () => {
    try {
      const res = await fetch('/api/v1/gl-entries?limit=300');
      const data = await res.json();
      if (data.success && data.entries) {
        setGlEntries(data.entries);
      }
    } catch (err) {
      console.error('Error fetching GL entries:', err);
    }
  };

  // Load Debit Notes
  const fetchDebitNotes = async () => {
    try {
      const res = await fetch('/api/v1/debit-notes');
      const data = await res.json();
      if (data.success && data.debitNotes) {
        setDebitNotes(data.debitNotes);
      }
    } catch (err) {
      console.error('Error fetching debit notes:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchGLEntries();
    fetchDebitNotes();
  }, []);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.code.includes(searchQuery) ||
        (acc.subGroup && acc.subGroup.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchGroup = selectedGroup === 'ALL' || acc.groupName === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [accounts, searchQuery, selectedGroup]);

  // Grouped by GroupName
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const acc of filteredAccounts) {
      if (!groups[acc.groupName]) groups[acc.groupName] = [];
      groups[acc.groupName].push(acc);
    }
    return groups;
  }, [filteredAccounts]);

  // Format INR paise to Rupees
  const fmtPaise = (paiseStr?: string | bigint) => {
    if (!paiseStr) return '₹0.00';
    const val = typeof paiseStr === 'bigint' ? paiseStr : BigInt(paiseStr || 0);
    const absVal = val < 0n ? -val : val;
    const isNegative = val < 0n;
    const rupees = (Number(absVal) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${isNegative ? '-' : ''}₹${rupees}`;
  };

  // Handle Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode || !newAccName || !newAccGroup) return;

    try {
      setSubmittingAccount(true);
      const res = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newAccCode.trim(),
          name: newAccName.trim(),
          groupName: newAccGroup,
          subGroup: newAccSubGroup.trim() || undefined,
          openingDr: Math.round(parseFloat(newAccOpeningDr || '0') * 100),
          openingCr: Math.round(parseFloat(newAccOpeningCr || '0') * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create account');
        return;
      }
      setShowAddAccountModal(false);
      setNewAccCode('');
      setNewAccName('');
      setNewAccSubGroup('');
      setNewAccOpeningDr('');
      setNewAccOpeningCr('');
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Error creating account');
    } finally {
      setSubmittingAccount(false);
    }
  };

  // Calculate JV Totals
  const jvTotalDr = useMemo(() => {
    return jvLines.reduce((sum, line) => {
      const val = parseFloat(line.debitPaise || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [jvLines]);

  const jvTotalCr = useMemo(() => {
    return jvLines.reduce((sum, line) => {
      const val = parseFloat(line.creditPaise || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [jvLines]);

  const isJvBalanced = Math.abs(jvTotalDr - jvTotalCr) < 0.001 && jvTotalDr > 0;

  // Submit Journal Voucher
  const handleCreateJV = async (e: React.FormEvent) => {
    e.preventDefault();
    setJvError('');

    if (!isJvBalanced) {
      setJvError(`Voucher is not balanced! Debit: ₹${jvTotalDr.toFixed(2)}, Credit: ₹${jvTotalCr.toFixed(2)}`);
      return;
    }

    try {
      setSubmittingJV(true);
      const payloadLines = jvLines
        .filter((l) => l.accountId && (parseFloat(l.debitPaise || '0') > 0 || parseFloat(l.creditPaise || '0') > 0))
        .map((l) => ({
          accountId: l.accountId,
          debit: Math.round(parseFloat(l.debitPaise || '0') * 100),
          credit: Math.round(parseFloat(l.creditPaise || '0') * 100),
          narration: l.narration || undefined,
        }));

      const res = await fetch('/api/v1/journal-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherDate: jvDate,
          narration: jvNarration || undefined,
          lines: payloadLines,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setJvError(data.error || 'Failed to create Journal Voucher');
        return;
      }

      setShowJVModal(false);
      setJvNarration('');
      setJvLines([
        { accountId: '', debitPaise: '', creditPaise: '0', narration: '' },
        { accountId: '', debitPaise: '0', creditPaise: '', narration: '' },
      ]);
      fetchAccounts();
      fetchGLEntries();
    } catch (err: any) {
      setJvError(err.message || 'Error submitting voucher');
    } finally {
      setSubmittingJV(false);
    }
  };

  // Open statement drill-down
  const viewAccountStatement = async (acc: Account) => {
    setSelectedAccountForStatement(acc);
    setLoadingStatement(true);
    try {
      const res = await fetch(`/api/v1/accounts/${acc.id}`);
      const data = await res.json();
      if (data.success && data.account) {
        setAccountStatement(data.account.statement || []);
      }
    } catch (err) {
      console.error('Error fetching statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Chart of Accounts & General Ledger
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time Double-Entry Tally ERP Architecture • Verified Balanced Ledgers
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowJVModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Journal Voucher (F7)
          </button>

          <button
            onClick={() => setShowAddAccountModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('chart')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'chart'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Chart of Accounts ({accounts.length})
        </button>

        <button
          onClick={() => setActiveTab('gl')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'gl'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          General Ledger Day Book ({glEntries.length})
        </button>

        <button
          onClick={() => setActiveTab('debit_notes')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'debit_notes'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Debit Notes ({debitNotes.length})
        </button>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search account name, code, group..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold uppercase text-slate-400">Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="text-sm py-1.5 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="ALL">All Groups</option>
                <option value="Capital">Capital</option>
                <option value="Current Liabilities">Current Liabilities</option>
                <option value="Current Assets">Current Assets</option>
                <option value="Fixed Assets">Fixed Assets</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>

              <button
                onClick={fetchAccounts}
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                title="Refresh balances"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grouped Table View */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading chart of accounts...
            </div>
          ) : Object.keys(groupedAccounts).length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              No accounts match the selected filter.
            </div>
          ) : (
            Object.entries(groupedAccounts).map(([groupName, accList]) => (
              <div key={groupName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      {groupName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                      {accList.length} accounts
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400 bg-white">
                        <th className="py-2.5 px-4 w-24">Code</th>
                        <th className="py-2.5 px-4">Account Name</th>
                        <th className="py-2.5 px-4">Sub-Group</th>
                        <th className="py-2.5 px-4 text-right">Debit Total</th>
                        <th className="py-2.5 px-4 text-right">Credit Total</th>
                        <th className="py-2.5 px-4 text-right">Closing Balance</th>
                        <th className="py-2.5 px-4 text-center w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accList.map((acc) => {
                        const balType = acc.balanceType || 'Dr';
                        const balPaise = acc.balancePaise || '0';
                        return (
                          <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-4 font-mono font-medium text-slate-500 text-xs">
                              {acc.code}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <span>{acc.name}</span>
                                {acc.isSystem && (
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                                    System
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 text-xs">
                              {acc.subGroup || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                              {fmtPaise(acc.totalDr)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                              {fmtPaise(acc.totalCr)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold">
                              <span
                                className={
                                  balType === 'Dr'
                                    ? 'text-indigo-600'
                                    : 'text-emerald-600'
                                }
                              >
                                {fmtPaise(balPaise)} {balType}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                onClick={() => viewAccountStatement(acc)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                title="View Statement"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: GENERAL LEDGER (DAY BOOK) */}
      {activeTab === 'gl' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">General Ledger Audit Stream</h2>
              <p className="text-xs text-slate-500">
                Immutable, real-time double entries posted by Invoices, POS, Counter Settlements, and JVs.
              </p>
            </div>
            <button
              onClick={fetchGLEntries}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Narration</th>
                  <th className="py-3 px-4 text-right text-indigo-600">Debit (Dr)</th>
                  <th className="py-3 px-4 text-right text-emerald-600">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {glEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No GL transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  glEntries.map((entry) => {
                    const isDr = BigInt(entry.debit) > 0n;
                    const isCr = BigInt(entry.credit) > 0n;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                          {new Date(entry.entryDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{entry.accountName}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {entry.accountCode} • {entry.accountGroup}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {entry.refType || 'ENTRY'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                          {entry.narration || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-indigo-600">
                          {isDr ? fmtPaise(entry.debit) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                          {isCr ? fmtPaise(entry.credit) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DEBIT NOTES */}
      {activeTab === 'debit_notes' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Debit Notes (Purchase Returns)</h2>
              <p className="text-xs text-slate-500">
                Supplier debit claims with automated inventory restocking and GL ledger reduction.
              </p>
            </div>
            <button
              onClick={fetchDebitNotes}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-center">Restock</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debitNotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No debit notes recorded.
                    </td>
                  </tr>
                ) : (
                  debitNotes.map((dn) => (
                    <tr key={dn.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        {dn.number}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(dn.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {dn.supplier?.name || 'Supplier'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {dn.reason || 'Purchase Return'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            dn.restock ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {dn.restock ? 'RESTOCKED' : 'NO RESTOCK'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {fmtPaise(dn.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD ACCOUNT */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Create New Ledger Account</h3>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Account Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2008"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Group Classification *
                  </label>
                  <select
                    value={newAccGroup}
                    onChange={(e) => setNewAccGroup(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Capital">Capital</option>
                    <option value="Current Liabilities">Current Liabilities</option>
                    <option value="Current Assets">Current Assets</option>
                    <option value="Fixed Assets">Fixed Assets</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICICI Bank Current Account"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Sub-Group / Under (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank Accounts, Indirect Expense"
                  value={newAccSubGroup}
                  onChange={(e) => setNewAccSubGroup(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Opening Debit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newAccOpeningDr}
                    onChange={(e) => setNewAccOpeningDr(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Opening Credit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newAccOpeningCr}
                    onChange={(e) => setNewAccOpeningCr(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAccount}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingAccount ? 'Creating...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: JOURNAL VOUCHER (F7) */}
      {showJVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">New Journal Voucher (JV)</h3>
                <p className="text-xs text-slate-500">
                  Double-entry voucher with automatic Dr == Cr balance enforcement
                </p>
              </div>
              <button onClick={() => setShowJVModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJV} className="p-5 space-y-4 overflow-y-auto flex-1">
              {jvError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{jvError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Voucher Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={jvDate}
                    onChange={(e) => setJvDate(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Narration / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Being depreciation for FY26"
                    value={jvNarration}
                    onChange={(e) => setJvNarration(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Journal Lines Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                  <span>Particulars / Accounts</span>
                  <button
                    type="button"
                    onClick={() =>
                      setJvLines([
                        ...jvLines,
                        { accountId: '', debitPaise: '', creditPaise: '', narration: '' },
                      ])
                    }
                    className="text-indigo-600 hover:underline flex items-center gap-1 normal-case font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2">
                  {jvLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => {
                          const updated = [...jvLines];
                          updated[idx].accountId = e.target.value;
                          setJvLines(updated);
                        }}
                        className="flex-1 text-sm py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name} ({a.groupName})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Debit ₹"
                        value={line.debitPaise}
                        onChange={(e) => {
                          const updated = [...jvLines];
                          updated[idx].debitPaise = e.target.value;
                          if (parseFloat(e.target.value) > 0) updated[idx].creditPaise = '0';
                          setJvLines(updated);
                        }}
                        className="w-28 text-sm py-1.5 px-2 border border-slate-200 rounded-lg font-mono text-right"
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Credit ₹"
                        value={line.creditPaise}
                        onChange={(e) => {
                          const updated = [...jvLines];
                          updated[idx].creditPaise = e.target.value;
                          if (parseFloat(e.target.value) > 0) updated[idx].debitPaise = '0';
                          setJvLines(updated);
                        }}
                        className="w-28 text-sm py-1.5 px-2 border border-slate-200 rounded-lg font-mono text-right"
                      />

                      {jvLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setJvLines(jvLines.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Balanced verification status */}
              <div className="p-3 rounded-xl border flex items-center justify-between text-xs font-semibold bg-slate-50">
                <div className="flex items-center gap-2">
                  {isJvBalanced ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" /> Balanced Double-Entry
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="w-4 h-4" /> Out of Balance by ₹
                      {Math.abs(jvTotalDr - jvTotalCr).toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="font-mono space-x-3">
                  <span>Total Dr: ₹{jvTotalDr.toFixed(2)}</span>
                  <span>Total Cr: ₹{jvTotalCr.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowJVModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isJvBalanced || submittingJV}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingJV ? 'Posting JV...' : 'Post Journal Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ACCOUNT STATEMENT DRILL-DOWN */}
      {selectedAccountForStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                    {selectedAccountForStatement.code}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedAccountForStatement.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Group: {selectedAccountForStatement.groupName} • Sub-Group:{' '}
                  {selectedAccountForStatement.subGroup || '—'}
                </p>
              </div>
              <button
                onClick={() => setSelectedAccountForStatement(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingStatement ? (
                <div className="p-8 text-center text-slate-400">Loading ledger statement...</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Narration / Ref</th>
                      <th className="py-2 px-3 text-right">Debit (Dr)</th>
                      <th className="py-2 px-3 text-right">Credit (Cr)</th>
                      <th className="py-2 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {/* Opening Balance Row */}
                    <tr className="bg-slate-50/50 font-semibold text-slate-600">
                      <td className="py-2 px-3">—</td>
                      <td className="py-2 px-3">Opening Balance</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {fmtPaise(selectedAccountForStatement.openingDr)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {fmtPaise(selectedAccountForStatement.openingCr)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {fmtPaise(
                          BigInt(selectedAccountForStatement.openingDr || 0) -
                            BigInt(selectedAccountForStatement.openingCr || 0)
                        )}
                      </td>
                    </tr>

                    {accountStatement.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No transactions found for this account.
                        </td>
                      </tr>
                    ) : (
                      accountStatement.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(st.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {st.narration || st.refType || 'Entry'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-indigo-600">
                            {BigInt(st.debit) > 0n ? fmtPaise(st.debit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600">
                            {BigInt(st.credit) > 0n ? fmtPaise(st.credit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {fmtPaise(st.runningBalancePaise)} {st.balanceType}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
