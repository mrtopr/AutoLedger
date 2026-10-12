'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Calculator, 
  Receipt, 
  CheckCircle2, 
  Printer, 
  Split, 
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Lock,
  Smartphone,
  Landmark,
  Coins,
  Banknote,
  RotateCcw,
  History,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Check,
  Trash2,
  Plus,
  Minus,
  Unlock,
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';

interface OnlineTransaction {
  id: string;
  mode: string;
  amountPaise: string;
  referenceNumber: string;
  customerName: string;
  time: string;
  notes?: string;
}

interface SettlementSummary {
  date: string;
  openingFloatPaise: string;
  totalBilledPaise: string;
  totalCogsPaise: string;
  grossProfitPaise: string;
  grossMarginPercent: number;
  totalTaxPaise: string;
  cashCollectedPaise: string;
  upiCollectedPaise: string;
  bankCollectedPaise: string;
  totalCollectedPaise: string;
  newCreditGivenPaise: string;
  invoicesCount: number;
  paymentsCount: number;
}

interface SavedSettlement {
  id: string;
  date: string;
  openingFloatPaise: string;
  cashSalesPaise: string;
  cashReceiptsPaise: string;
  cashExpensesPaise: string;
  expectedCashPaise: string;
  denominations: Record<string, number>;
  countedCashPaise: string;
  differencePaise: string;
  retainedFloatPaise: string;
  withdrawnPaise: string;
  upiTotalPaise: string;
  bankTotalPaise: string;
  upiVerified: boolean;
  notes?: string;
  status: 'BALANCED' | 'SHORT' | 'EXCESS';
  closedByName?: string;
  createdAt: string;
}

const DENOMINATIONS = [
  { 
    value: 2000, 
    label: '₹2000 Note', 
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200', 
    dotColor: 'bg-purple-600',
    quickSteps: [1, 5, 10] 
  },
  { 
    value: 500, 
    label: '₹500 Note', 
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200', 
    dotColor: 'bg-emerald-600',
    quickSteps: [1, 5, 10] 
  },
  { 
    value: 200, 
    label: '₹200 Note', 
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200', 
    dotColor: 'bg-amber-500',
    quickSteps: [1, 5, 10] 
  },
  { 
    value: 100, 
    label: '₹100 Note', 
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', 
    dotColor: 'bg-blue-500',
    quickSteps: [1, 5, 10] 
  },
];

// Safe BigInt parser to prevent runtime SyntaxError crashes on invalid or empty strings
function safeBigInt(val: string | number | null | undefined): bigint {
  if (val === null || val === undefined || val === '') return 0n;
  if (typeof val === 'number') {
    return BigInt(Math.round(val));
  }
  try {
    const s = String(val).trim();
    if (s.includes('.')) {
      const num = parseFloat(s);
      return isNaN(num) ? 0n : BigInt(Math.round(num));
    }
    return BigInt(s);
  } catch {
    return 0n;
  }
}

function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ExpenseItem {
  id: string;
  amountRupees: string;
  note: string;
}

export default function DayEndSettlementPage() {
  const { user, tenant } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [onlineTxs, setOnlineTxs] = useState<OnlineTransaction[]>([]);
  const [savedSettlement, setSavedSettlement] = useState<SavedSettlement | null>(null);
  const [recentSettlements, setRecentSettlements] = useState<SavedSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [openingFloatRupees, setOpeningFloatRupees] = useState<string>('0.00');
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([
    { id: '1', amountRupees: '', note: '' },
  ]);
  const [noteCounts, setNoteCounts] = useState<Record<number, number>>({
    2000: 0, 500: 0, 200: 0, 100: 0,
  });
  const [coinsTotalRupees, setCoinsTotalRupees] = useState<string>('');
  const [retainedFloatRupees, setRetainedFloatRupees] = useState<string>('2000.00');
  const [remarks, setRemarks] = useState<string>('');
  const [upiVerified, setUpiVerified] = useState<boolean>(false);
  const [showOnlineList, setShowOnlineList] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // References for keyboard navigation across note inputs
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const coinsInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner = user?.role === 'OWNER';
  const isManager = user?.role === 'MANAGER';

  const addExpenseItem = () => {
    setExpenseItems((prev) => [
      ...prev,
      { id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, amountRupees: '', note: '' },
    ]);
  };

  const removeExpenseItem = (id: string) => {
    setExpenseItems((prev) => {
      const remaining = prev.filter((it) => it.id !== id);
      return remaining.length > 0 ? remaining : [{ id: '1', amountRupees: '', note: '' }];
    });
  };

  const updateExpenseItem = (id: string, field: 'amountRupees' | 'note', val: string) => {
    setExpenseItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
  };

  const handleDeleteSettlement = async (dateToDelete?: string, idToDelete?: string) => {
    const targetDate = dateToDelete || selectedDate;
    if (!window.confirm(`Are you sure you want to delete the settlement for ${targetDate} and re-open the cash register?`)) {
      return;
    }
    try {
      setLoading(true);
      const query = idToDelete ? `id=${idToDelete}` : `date=${targetDate}`;
      const res = await fetch(`/api/v1/reports/settlement?${query}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`Settlement for ${targetDate} deleted. Register re-opened.`);
        await fetchSettlementData(selectedDate);
      } else {
        alert(json.error || 'Failed to delete settlement');
      }
    } catch (err: any) {
      console.error('Delete settlement error:', err);
      alert('Failed to delete settlement');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlementData = async (dateStr: string) => {
    try {
      setLoading(true);
      setSuccessMsg(null);
      const res = await fetch(`/api/v1/reports/settlement?date=${dateStr}`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary || null);
        setOnlineTxs(json.onlineTransactions || []);
        setSavedSettlement(json.savedSettlement || null);
        setRecentSettlements(json.recentSettlements || []);

        if (json.savedSettlement) {
          // Populate from existing saved record
          const ss: SavedSettlement = json.savedSettlement;
          setOpeningFloatRupees((Number(ss.openingFloatPaise || '0') / 100).toFixed(2));
          setRetainedFloatRupees((Number(ss.retainedFloatPaise || '0') / 100).toFixed(2));
          
          if (ss.notes) {
            if (ss.notes.includes(' | Cash Exp: ')) {
              const parts = ss.notes.split(' | Cash Exp: ');
              setRemarks(parts[0] || '');
              const expStr = parts[1] || '';
              if (expStr.includes(', ')) {
                const subItems = expStr.split(', ').map((str, idx) => {
                  const m = str.match(/^(.*?):\s*₹?(.*)$/);
                  return {
                    id: String(idx + 1),
                    note: m ? m[1].trim() : str.trim(),
                    amountRupees: m ? m[2].trim() : '',
                  };
                });
                setExpenseItems(subItems.length > 0 ? subItems : [{ id: '1', amountRupees: (Number(ss.cashExpensesPaise || '0') / 100).toFixed(2), note: expStr }]);
              } else {
                const m = expStr.match(/^(.*?):\s*₹?(.*)$/);
                setExpenseItems([{
                  id: '1',
                  note: m ? m[1].trim() : expStr.trim(),
                  amountRupees: m ? m[2].trim() : (Number(ss.cashExpensesPaise || '0') / 100).toFixed(2),
                }]);
              }
            } else {
              setRemarks(ss.notes);
              const expVal = (Number(ss.cashExpensesPaise || '0') / 100).toFixed(2);
              setExpenseItems([{ id: '1', amountRupees: Number(expVal) > 0 ? expVal : '', note: '' }]);
            }
          } else {
            setRemarks('');
            const expVal = (Number(ss.cashExpensesPaise || '0') / 100).toFixed(2);
            setExpenseItems([{ id: '1', amountRupees: Number(expVal) > 0 ? expVal : '', note: '' }]);
          }
          
          setUpiVerified(Boolean(ss.upiVerified));

          let notesTotalPaise = 0n;
          if (ss.denominations) {
            const counts: Record<number, number> = { 2000: 0, 500: 0, 200: 0, 100: 0 };
            for (const d of [2000, 500, 200, 100]) {
              const countVal = Number(ss.denominations[d] || 0);
              counts[d] = isNaN(countVal) ? 0 : countVal;
              notesTotalPaise += BigInt(d) * 100n * BigInt(counts[d]);
            }
            setNoteCounts(counts);
          } else {
            setNoteCounts({ 2000: 0, 500: 0, 200: 0, 100: 0 });
          }

          // Restore loose change/coins from countedCashPaise minus note sum
          const countedTotal = safeBigInt(ss.countedCashPaise);
          const remainingCoins = countedTotal > notesTotalPaise ? countedTotal - notesTotalPaise : 0n;
          setCoinsTotalRupees(remainingCoins > 0n ? (Number(remainingCoins) / 100).toFixed(2) : '');
        } else {
          // Initialize defaults
          const initOpening = json.summary?.openingFloatPaise 
            ? (Number(json.summary.openingFloatPaise) / 100).toFixed(2) 
            : '0.00';
          setOpeningFloatRupees(initOpening);
          setExpenseItems([{ id: '1', amountRupees: '', note: '' }]);
          setRetainedFloatRupees('2000.00');
          setRemarks('');
          setUpiVerified(false);
          setNoteCounts({
            2000: 0, 500: 0, 200: 0, 100: 0,
          });
          setCoinsTotalRupees('');
        }
      }
    } catch (err) {
      console.error('Error fetching settlement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlementData(selectedDate);
  }, [selectedDate]);

  // Real-time Calculations
  const openingFloatPaise = parseRupeesToPaise(openingFloatRupees);
  const cashCollectedPaise = savedSettlement 
    ? safeBigInt(savedSettlement.cashSalesPaise) 
    : safeBigInt(summary?.cashCollectedPaise);
  const upiCollectedPaise = savedSettlement 
    ? safeBigInt(savedSettlement.upiTotalPaise) 
    : safeBigInt(summary?.upiCollectedPaise);
  const bankCollectedPaise = savedSettlement 
    ? safeBigInt(savedSettlement.bankTotalPaise) 
    : safeBigInt(summary?.bankCollectedPaise);
  
  // Aggregate all itemized expenses
  let cashExpensesPaise = 0n;
  for (const it of expenseItems) {
    cashExpensesPaise += parseRupeesToPaise(it.amountRupees);
  }
  const cashExpensesRupees = (Number(cashExpensesPaise) / 100).toFixed(2);
  const cashExpenseSummary = expenseItems
    .filter((it) => parseRupeesToPaise(it.amountRupees) > 0n || it.note.trim())
    .map((it) => `${it.note || 'Expense'}: ₹${it.amountRupees || '0'}`)
    .join(', ');

  // System Expected Cash = Opening Float + Cash In - Cash Out
  const systemExpectedCashPaise = openingFloatPaise + cashCollectedPaise - cashExpensesPaise;

  // Actual Physical Cash = Sum(Note Value * Note Count) + Coins
  let countedFromNotesPaise = 0n;
  for (const d of DENOMINATIONS) {
    const count = noteCounts[d.value] || 0;
    if (count > 0) {
      countedFromNotesPaise += BigInt(d.value) * 100n * BigInt(count);
    }
  }
  const coinsPaise = parseRupeesToPaise(coinsTotalRupees);
  const totalPhysicalCashPaise = countedFromNotesPaise + coinsPaise;

  // Discrepancy / Variance
  const differencePaise = totalPhysicalCashPaise - systemExpectedCashPaise;
  let tallyStatus: 'BALANCED' | 'SHORT' | 'EXCESS' = 'BALANCED';
  if (differencePaise < 0n) {
    tallyStatus = 'SHORT';
  } else if (differencePaise > 0n) {
    tallyStatus = 'EXCESS';
  }

  // Handover amounts
  const retainedFloatPaise = parseRupeesToPaise(retainedFloatRupees);
  const withdrawnPaise = totalPhysicalCashPaise >= retainedFloatPaise 
    ? totalPhysicalCashPaise - retainedFloatPaise 
    : 0n;

  // Handle Note input changes
  const handleNoteCountChange = (val: number, countStr: string) => {
    const count = parseInt(countStr.replace(/[^0-9]/g, '') || '0', 10);
    setNoteCounts((prev) => ({
      ...prev,
      [val]: isNaN(count) ? 0 : count,
    }));
  };

  const incrementNote = (val: number, delta: number) => {
    setNoteCounts((prev) => ({
      ...prev,
      [val]: Math.max(0, (prev[val] || 0) + delta),
    }));
  };

  const setToday = () => {
    setSelectedDate(getTodayDateStr());
  };

  // Keyboard navigation: Enter jumps to next denomination, and from last note to loose change
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextDenom = DENOMINATIONS[index + 1];
      if (nextDenom && inputRefs.current[nextDenom.value]) {
        inputRefs.current[nextDenom.value]?.focus();
        inputRefs.current[nextDenom.value]?.select();
      } else if (coinsInputRef.current) {
        coinsInputRef.current.focus();
        coinsInputRef.current.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevDenom = DENOMINATIONS[index - 1];
      if (prevDenom && inputRefs.current[prevDenom.value]) {
        inputRefs.current[prevDenom.value]?.focus();
        inputRefs.current[prevDenom.value]?.select();
      }
    }
  };

  // Quick action: Autofill note breakdown matching expected cash (convenience shortcut)
  const autofillExpected = () => {
    let remaining = Number(systemExpectedCashPaise) / 100;
    if (remaining <= 0) return;
    const newCounts: Record<number, number> = {
      2000: 0, 500: 0, 200: 0, 100: 0,
    };
    for (const d of [2000, 500, 200, 100]) {
      if (remaining >= d) {
        const count = Math.floor(remaining / d);
        newCounts[d] = count;
        remaining -= count * d;
      }
    }
    setNoteCounts(newCounts);
    setCoinsTotalRupees(remaining > 0 ? remaining.toFixed(2) : '');
  };

  const handleSaveSettlement = async () => {
    try {
      setSubmitting(true);
      setSuccessMsg(null);

      const payload = {
        date: selectedDate,
        openingFloatPaise: openingFloatPaise.toString(),
        cashSalesPaise: cashCollectedPaise.toString(),
        cashReceiptsPaise: '0',
        cashExpensesPaise: cashExpensesPaise.toString(),
        expectedCashPaise: systemExpectedCashPaise.toString(),
        denominations: noteCounts,
        countedCashPaise: totalPhysicalCashPaise.toString(),
        differencePaise: differencePaise.toString(),
        retainedFloatPaise: retainedFloatPaise.toString(),
        withdrawnPaise: withdrawnPaise.toString(),
        upiTotalPaise: upiCollectedPaise.toString(),
        bankTotalPaise: bankCollectedPaise.toString(),
        upiVerified,
        notes: remarks + (cashExpenseSummary ? ` | Cash Exp: ${cashExpenseSummary}` : ''),
        status: tallyStatus,
      };

      const res = await fetch('/api/v1/reports/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setSavedSettlement(json.settlement);
        setSuccessMsg('✅ Day-End Cash Settlement recorded and locked successfully!');
        // Refresh recent settlements
        fetchSettlementData(selectedDate);
      } else {
        const errJson = await res.json();
        alert(`Error: ${errJson.error || 'Failed to save settlement'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOwner && !isManager) {
    return (
      <div className="py-20 text-center space-y-3 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-md bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto border border-[#FECACA]">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h2 className="text-sm font-semibold text-[#0F172A]">Manager & Owner Authorization Required</h2>
        <p className="text-xs text-[#64748B]">
          Day-end cash drawer settlement and till reconciliation are restricted to authorized administrators.
        </p>
        <Link
          href="/pos"
          className="inline-block px-3.5 py-2 bg-[#0F172A] text-white rounded-md text-xs font-semibold"
        >
          Return to Counter POS
        </Link>
      </div>
    );
  }

  const isToday = selectedDate === getTodayDateStr();

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-16">
      {/* Print Styles for Clean Thermal & Slip Output */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-slip, #printable-slip * {
            visibility: visible;
          }
          #printable-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
        }
      `}</style>

      {/* Top Header Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] font-mono">
              DAILY CASH REGISTER
            </span>
            {savedSettlement ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1 font-mono">
                <Check className="w-3 h-3" />
                CLOSED & RECONCILED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                PENDING CLOSE
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2 mt-1">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-[#C81E1E] flex items-center justify-center border border-red-100 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <span>Day-End Register & Till Reconciliation</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 pl-9">
            Tally notes in drawer, verify UPI/QR Soundbox payments, and securely close the day's cash register.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Date Picker + Today Shortcut */}
          <div className="flex items-center gap-1.5 bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg p-1 text-xs font-medium text-[#334155]">
            <Calendar className="w-3.5 h-3.5 text-[#64748B] ml-1.5" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-[#0F172A] focus:outline-hidden px-1"
            />
            {!isToday && (
              <button
                type="button"
                onClick={setToday}
                className="px-2 py-0.5 text-[10px] font-bold bg-white text-[#2563EB] hover:bg-blue-50 border border-blue-200 rounded transition"
                title="Jump to Today"
              >
                Today
              </button>
            )}
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="h-8 px-2.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] text-xs font-semibold rounded-lg border border-[#CBD5E1] transition inline-flex items-center gap-1.5 shadow-2xs"
            title="View Past Settlements"
          >
            <History className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Audit History</span>
          </button>

          <button
            onClick={() => window.print()}
            className="h-8 px-3 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-lg shadow-2xs transition inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Day Slip</span>
          </button>

          {savedSettlement && (
            <button
              onClick={() => handleDeleteSettlement()}
              className="h-8 px-2.5 bg-red-50 hover:bg-red-100 text-[#C81E1E] text-xs font-semibold rounded-lg border border-red-200 transition inline-flex items-center gap-1.5 shadow-2xs"
              title="Delete this settlement record and re-open the cash register"
            >
              <Unlock className="w-3.5 h-3.5 text-[#C81E1E]" />
              <span>Re-Open / Delete Till</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-700 font-bold hover:underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* History Drawer (if opened) */}
      {showHistory && (
        <div className="bg-white border border-[#CBD5E1] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
              <History className="w-4 h-4 text-[#C81E1E]" />
              <span>Past Day-End Settlements Audit Trail</span>
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-[#64748B] hover:text-[#0F172A] font-semibold"
            >
              Close
            </button>
          </div>

          {recentSettlements.length === 0 ? (
            <p className="text-xs text-[#64748B] py-3 text-center">No previous settlements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FA] text-[#64748B] uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Counted Cash</th>
                    <th className="p-2">Expected Cash</th>
                    <th className="p-2">Variance</th>
                    <th className="p-2">Float Retained</th>
                    <th className="p-2">UPI Verified</th>
                    <th className="p-2">Closed By</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {recentSettlements.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-[#0F172A]">{s.date}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'BALANCED' 
                            ? 'bg-green-100 text-green-700' 
                            : s.status === 'SHORT'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-2 font-mono font-semibold">{formatPaiseToRupees(safeBigInt(s.countedCashPaise))}</td>
                      <td className="p-2 font-mono text-[#64748B]">{formatPaiseToRupees(safeBigInt(s.expectedCashPaise))}</td>
                      <td className="p-2 font-mono font-bold">
                        {safeBigInt(s.differencePaise) === 0n ? (
                          <span className="text-green-600">₹0.00</span>
                        ) : (
                          <span className={safeBigInt(s.differencePaise) < 0n ? 'text-red-600' : 'text-amber-600'}>
                            {formatPaiseToRupees(safeBigInt(s.differencePaise))}
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-[#64748B]">{formatPaiseToRupees(safeBigInt(s.retainedFloatPaise))}</td>
                      <td className="p-2">
                        {s.upiVerified ? (
                          <span className="text-green-600 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Yes
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">No</span>
                        )}
                      </td>
                      <td className="p-2 text-[#475569]">{s.closedByName || 'Owner'}</td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedDate(s.date);
                              setShowHistory(false);
                            }}
                            className="text-[#2563EB] hover:underline font-semibold"
                          >
                            View / Load
                          </button>
                          <button
                            onClick={() => handleDeleteSettlement(s.date, s.id)}
                            className="p-1 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 rounded transition"
                            title={`Delete settlement for ${s.date}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4-CARD EXECUTIVE SUMMARY BAR                                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Billed Today */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              1. Total Sales Billed
            </span>
            <div className="mt-1 text-lg font-bold text-[#0F172A] font-mono tabular-nums">
              {formatPaiseToRupees(safeBigInt(summary?.totalBilledPaise))}
            </div>
            <div className="mt-0.5 text-[11px] text-[#64748B]">{summary?.invoicesCount || 0} bills issued today</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        {/* Expected Cash in Drawer */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider block">
              2. Expected in Drawer
            </span>
            <div className="mt-1 text-lg font-bold text-[#0F172A] font-mono tabular-nums">
              {formatPaiseToRupees(systemExpectedCashPaise)}
            </div>
            <div className="mt-0.5 text-[11px] text-[#64748B]">Opening + Cash In - Expenses</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4" />
          </div>
        </div>

        {/* Digital Money Collected */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              3. Digital (UPI / Bank)
            </span>
            <div className="mt-1 text-lg font-bold text-blue-700 font-mono tabular-nums">
              {formatPaiseToRupees(upiCollectedPaise + bankCollectedPaise)}
            </div>
            <div className="mt-0.5 text-[11px] flex items-center gap-1.5">
              <span className="text-[#64748B]">{onlineTxs.length} online transfers</span>
              <span>•</span>
              <span className={upiVerified ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {upiVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
        </div>

        {/* Live Discrepancy / Till Verdict */}
        <div className={`p-3.5 rounded-xl border flex items-center justify-between shadow-2xs transition ${
          tallyStatus === 'BALANCED'
            ? 'bg-green-50/70 border-green-200 text-green-950'
            : tallyStatus === 'SHORT'
            ? 'bg-red-50/70 border-red-200 text-red-950'
            : 'bg-amber-50/70 border-amber-200 text-amber-950'
        }`}>
          <div>
            <div className="flex items-center gap-1.5">
              {tallyStatus === 'BALANCED' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
              {tallyStatus === 'SHORT' && <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
              {tallyStatus === 'EXCESS' && <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {tallyStatus === 'BALANCED' ? 'TILL BALANCED' : tallyStatus === 'SHORT' ? 'CASH SHORTAGE' : 'CASH EXCESS'}
              </span>
            </div>
            <div className={`mt-1 text-lg font-bold font-mono tabular-nums ${
              tallyStatus === 'BALANCED' ? 'text-green-700' : tallyStatus === 'SHORT' ? 'text-red-700' : 'text-amber-700'
            }`}>
              {differencePaise === 0n ? '₹0.00' : formatPaiseToRupees(differencePaise)}
            </div>
            <div className="mt-0.5 text-[11px] opacity-80">
              Counted: {formatPaiseToRupees(totalPhysicalCashPaise)}
            </div>
          </div>
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
            tallyStatus === 'BALANCED'
              ? 'bg-green-100 text-green-700 border-green-300'
              : tallyStatus === 'SHORT'
              ? 'bg-red-100 text-red-700 border-red-300'
              : 'bg-amber-100 text-amber-700 border-amber-300'
          }`}>
            <Calculator className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN 2-COLUMN SPLIT: REGISTER TALLY (7) vs DIGITAL & SAFE HANDOVER (5)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ========================================================================= */}
        {/* COLUMN 1: PHYSICAL CASH DRAWER & NOTE COUNTER (7 Cols on desktop)        */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
            
            {/* Header: Cash Drawer Tally */}
            <div className="border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Physical Cash Register Tally
                  </h2>
                  <p className="text-[10px] text-[#64748B]">Count physical ₹2000, ₹500, ₹200, ₹100 notes & loose change</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={autofillExpected}
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-blue-50 rounded-lg border border-blue-200 transition"
                  title="Autofill note breakdown to match expected cash"
                >
                  Quick Match
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoteCounts({ 2000: 0, 500: 0, 200: 0, 100: 0 });
                    setCoinsTotalRupees('');
                  }}
                  className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200"
                  title="Reset note counts"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Arithmetic Formula Row: Opening + Cash Sales - Cash Out */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                Register Cash Equation
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569] uppercase block">
                    1. Opening Float (₹)
                  </label>
                  <input
                    type="text"
                    value={openingFloatRupees}
                    onChange={(e) => setOpeningFloatRupees(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold font-mono text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden"
                  />
                  <span className="text-[9px] text-[#94A3B8] block mt-0.5">Kept from yesterday</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#475569] uppercase block">
                    2. Cash Sales In (₹)
                  </label>
                  <div className="mt-1 h-8 px-2.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold font-mono text-emerald-700 flex items-center">
                    + {formatPaiseToRupees(cashCollectedPaise)}
                  </div>
                  <span className="text-[9px] text-[#94A3B8] block mt-0.5">Billed cash at counter</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#475569] uppercase block">
                    3. Cash Out / Expenses (₹)
                  </label>
                  <div className="mt-1 h-8 px-2.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold font-mono text-red-600 flex items-center justify-between">
                    <span>- {formatPaiseToRupees(cashExpensesPaise)}</span>
                    <span className="text-[10px] font-normal text-[#64748B]">{expenseItems.length} item{expenseItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-[9px] text-[#94A3B8] block mt-0.5">Petty cash paid out today</span>
                </div>
              </div>

              {/* Itemized Cash Expenses List */}
              <div className="bg-[#FFF5F5] border border-[#FED7D7] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#991B1B]">
                    <span>Petty Cash Expenses / Payouts</span>
                    <span className="text-[10px] font-mono font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                      - {formatPaiseToRupees(cashExpensesPaise)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addExpenseItem}
                    className="px-2 py-1 text-[11px] font-bold bg-white text-[#C81E1E] hover:bg-red-50 border border-red-200 rounded-lg shadow-2xs transition inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Expense</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {expenseItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="relative w-28 sm:w-32 shrink-0">
                        <span className="absolute left-2 top-1.5 text-xs font-bold text-[#94A3B8]">₹</span>
                        <input
                          type="text"
                          value={item.amountRupees}
                          onChange={(e) => updateExpenseItem(item.id, 'amountRupees', e.target.value)}
                          placeholder="0.00"
                          className="w-full h-7 pl-5 pr-2 bg-white border border-[#CBD5E1] rounded-md text-xs font-bold font-mono text-red-600 focus:border-[#C81E1E] focus:outline-hidden"
                        />
                      </div>
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => updateExpenseItem(item.id, 'note', e.target.value)}
                        placeholder="Reason (e.g. Chai, Courier, Petrol, Cleaning)"
                        className="flex-1 h-7 px-2.5 bg-white border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#C81E1E] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => removeExpenseItem(item.id)}
                        className="w-7 h-7 flex items-center justify-center text-[#94A3B8] hover:text-red-600 hover:bg-white rounded-md transition border border-transparent hover:border-red-200"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Expected Target Banner */}
              <div className="p-2.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-between text-xs">
                <span className="font-bold text-[#1E3A8A] flex items-center gap-1.5">
                  <span>🎯 System Target Cash in Register:</span>
                </span>
                <span className="text-sm font-bold font-mono text-[#1E3A8A] tabular-nums">
                  {formatPaiseToRupees(systemExpectedCashPaise)}
                </span>
              </div>
            </div>

            {/* POS-Grade Denomination Note Counter */}
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-[#F8FAFC] px-3.5 py-2 border-b border-[#E2E8F0] flex items-center justify-between text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                <span>Note Denomination</span>
                <span className="text-center pr-12">Note Count</span>
                <span>Subtotal (₹)</span>
              </div>

              <div className="divide-y divide-[#E2E8F0]">
                {DENOMINATIONS.map((d, idx) => {
                  const count = noteCounts[d.value] || 0;
                  const subtotalPaise = BigInt(d.value) * 100n * BigInt(count);
                  return (
                    <div key={d.value} className="p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between hover:bg-slate-50/70 transition">
                      
                      {/* Left: Note badge & label */}
                      <div className="flex items-center gap-2.5 min-w-[120px]">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${d.badgeColor}`}>
                          ₹{d.value}
                        </span>
                        <span className="text-xs font-semibold text-[#0F172A] hidden sm:inline">Note</span>
                      </div>

                      {/* Center: Steppers & Input */}
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                          type="button"
                          onClick={() => incrementNote(d.value, -1)}
                          disabled={count <= 0}
                          className="w-7 h-8 flex items-center justify-center bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-[#475569] border border-[#CBD5E1] rounded-lg transition"
                          title="Subtract 1 note"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          ref={(el) => { inputRefs.current[d.value] = el; }}
                          type="text"
                          inputMode="numeric"
                          value={noteCounts[d.value] === 0 ? '' : noteCounts[d.value]}
                          placeholder="0"
                          onChange={(e) => handleNoteCountChange(d.value, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx)}
                          className="w-16 sm:w-20 h-8 text-center font-mono font-bold text-xs bg-white border border-[#CBD5E1] rounded-lg focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] shadow-2xs transition"
                        />

                        <button
                          type="button"
                          onClick={() => incrementNote(d.value, 1)}
                          className="w-7 h-8 flex items-center justify-center bg-white hover:bg-slate-100 text-[#475569] border border-[#CBD5E1] rounded-lg transition"
                          title="Add 1 note"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <div className="hidden sm:flex items-center gap-1">
                          {[5, 10].map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => incrementNote(d.value, step)}
                              className="px-1.5 py-1 text-[10px] font-semibold bg-white text-[#475569] hover:bg-slate-100 border border-[#CBD5E1] rounded transition"
                              title={`Add ${step} notes`}
                            >
                              +{step}
                            </button>
                          ))}
                        </div>

                        {count > 0 && (
                          <button
                            type="button"
                            onClick={() => handleNoteCountChange(d.value, '0')}
                            className="p-1 text-[#94A3B8] hover:text-red-500 rounded transition"
                            title="Clear this denomination to 0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Right: Subtotal */}
                      <div className="font-mono font-bold text-xs sm:text-sm text-[#0F172A] tabular-nums text-right min-w-[90px]">
                        {formatPaiseToRupees(subtotalPaise)}
                      </div>
                    </div>
                  );
                })}

                {/* Loose Change & Small Currency (< ₹100) */}
                <div className="p-2.5 sm:px-3.5 sm:py-2.5 bg-[#F8FAFC]/80 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-xs text-[#0F172A] block">Loose Change & Coins</span>
                      <span className="text-[10px] text-[#64748B] block">Smaller notes (&lt; ₹100) &amp; coins (₹)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      ref={coinsInputRef}
                      type="text"
                      value={coinsTotalRupees}
                      placeholder="0.00"
                      onChange={(e) => setCoinsTotalRupees(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const lastDenom = DENOMINATIONS[DENOMINATIONS.length - 1];
                          if (lastDenom && inputRefs.current[lastDenom.value]) {
                            inputRefs.current[lastDenom.value]?.focus();
                            inputRefs.current[lastDenom.value]?.select();
                          }
                        }
                      }}
                      className="w-20 sm:w-24 h-8 text-center font-mono font-bold text-xs bg-white border border-[#CBD5E1] rounded-lg focus:border-[#C81E1E] focus:outline-hidden shadow-2xs transition"
                    />
                    {coinsTotalRupees && coinsTotalRupees !== '0' && coinsTotalRupees !== '0.00' && (
                      <button
                        type="button"
                        onClick={() => setCoinsTotalRupees('')}
                        className="p-1 text-[#94A3B8] hover:text-red-500 rounded transition"
                        title="Clear loose change"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="font-mono font-bold text-xs sm:text-sm text-[#0F172A] tabular-nums text-right min-w-[90px]">
                    {formatPaiseToRupees(coinsPaise)}
                  </div>
                </div>
              </div>

              {/* Total Physical Cash Counted Bar */}
              <div className="bg-[#0F172A] text-white px-3.5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">Total Physical Cash Counted</span>
                  <span className="text-[10px] text-slate-300">Sum of notes + loose change</span>
                </div>
                <span className="font-mono text-base font-bold tabular-nums text-emerald-300">
                  {formatPaiseToRupees(totalPhysicalCashPaise)}
                </span>
              </div>
            </div>

            {/* Detailed Discrepancy Insight Banner */}
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
              tallyStatus === 'BALANCED'
                ? 'bg-green-50 border-green-200 text-green-900'
                : tallyStatus === 'SHORT'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {tallyStatus === 'BALANCED' && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
              {tallyStatus === 'SHORT' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
              {tallyStatus === 'EXCESS' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
              <div>
                <div className="font-bold text-xs">
                  {tallyStatus === 'BALANCED' && '✅ All Cash Accounted For — Zero Variance'}
                  {tallyStatus === 'SHORT' && `⚠️ Cash Shortage of ${formatPaiseToRupees(differencePaise * -1n)}`}
                  {tallyStatus === 'EXCESS' && `⚠️ Cash Excess of ${formatPaiseToRupees(differencePaise)}`}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {tallyStatus === 'BALANCED' && 'Physical cash matches the expected drawer balance exactly.'}
                  {tallyStatus === 'SHORT' && 'Physical drawer has less cash than expected. Please check if any cash expenses (chai/petrol/courier) or customer change was unentered.'}
                  {tallyStatus === 'EXCESS' && 'Physical cash is higher than expected. Check if an unrecorded cash sale or extra deposit occurred.'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: DIGITAL RECONCILIATION & SAFE DEPOSIT (5 Cols on desktop)      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Card 1: Online & Digital Money Verification */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3.5">
            <div className="border-b border-[#E2E8F0] pb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Digital & Online Collections
                  </h2>
                  <p className="text-[10px] text-[#64748B]">Verify against Soundbox & Bank App</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {onlineTxs.length} TXNS
              </span>
            </div>

            {/* UPI & Bank Breakdown Box */}
            <div className="p-3 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF] rounded-xl border border-[#DBEAFE] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-xs font-semibold text-[#1E3A8A]">UPI / QR Collections:</span>
                </div>
                <span className="text-base font-bold font-mono text-blue-700 tabular-nums">
                  {formatPaiseToRupees(upiCollectedPaise)}
                </span>
              </div>

              {Number(bankCollectedPaise) > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-blue-200/50 text-xs">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-semibold text-indigo-900">Bank Transfer / NEFT:</span>
                  </div>
                  <span className="font-bold font-mono text-indigo-700 tabular-nums">
                    {formatPaiseToRupees(bankCollectedPaise)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-blue-200 flex items-center justify-between text-xs">
                <span className="font-bold text-[#1E293B]">Total Digital Money:</span>
                <span className="font-bold font-mono text-[#0F172A]">
                  {formatPaiseToRupees(upiCollectedPaise + bankCollectedPaise)}
                </span>
              </div>
            </div>

            {/* Owner Verification Checkbox */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
              upiVerified 
                ? 'bg-green-50 border-green-300 text-green-900' 
                : 'bg-slate-50 border-[#CBD5E1] text-[#334155] hover:bg-slate-100'
            }`}>
              <input
                type="checkbox"
                checked={upiVerified}
                onChange={(e) => setUpiVerified(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
              />
              <div className="text-xs">
                <span className="font-bold block">
                  {upiVerified ? '✅ UPI & Bank Statement Verified' : 'Check PhonePe / Soundbox App'}
                </span>
                <span className="text-[11px] text-[#64748B] block mt-0.5">
                  I confirm the ₹{((Number(summary?.upiCollectedPaise || 0) + Number(summary?.bankCollectedPaise || 0)) / 100).toLocaleString('en-IN')} matches my Soundbox announcement & bank credits.
                </span>
              </div>
            </label>

            {/* Expandable Online Transactions Drawer */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowOnlineList(!showOnlineList)}
                className="w-full py-1.5 px-2.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 rounded-lg flex items-center justify-between transition border border-dashed border-blue-200"
              >
                <span>{showOnlineList ? 'Hide Transactions List' : `View All ${onlineTxs.length} Online Payments`}</span>
                {showOnlineList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showOnlineList && (
                <div className="mt-2 max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 text-xs">
                  {onlineTxs.length === 0 ? (
                    <div className="text-center py-4 text-[#94A3B8] text-xs">No online payments received for this date.</div>
                  ) : (
                    onlineTxs.map((tx) => (
                      <div key={tx.id} className="pt-1.5 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-[#0F172A] truncate">{tx.customerName}</div>
                          <div className="text-[10px] text-[#64748B] flex items-center gap-1.5">
                            <span className="font-mono">{tx.time}</span>
                            <span>•</span>
                            <span className="font-mono uppercase text-blue-600">{tx.referenceNumber}</span>
                          </div>
                        </div>
                        <div className="font-mono font-bold text-[#0F172A] shrink-0">
                          {formatPaiseToRupees(safeBigInt(tx.amountPaise))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* New Khata Extended Notice */}
          {Number(summary?.newCreditGivenPaise || 0) > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 text-xs text-[#92400E] flex items-start gap-2.5">
              <Split className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">New Khata (Credit) Extended Today: </span>
                <span className="font-mono font-bold">{formatPaiseToRupees(safeBigInt(summary?.newCreditGivenPaise))}</span>
                <p className="text-[11px] text-[#B45309] mt-0.5">
                  Recorded in customer Khata ledgers. Not expected in today's cash drawer.
                </p>
              </div>
            </div>
          )}

          {/* Card 2: Cash Handover, Float Allocation & Register Lock */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3.5">
            <div className="border-b border-[#E2E8F0] pb-2.5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Safe Deposit & Day Closing
                </h2>
                <p className="text-[10px] text-[#64748B]">Set tomorrow's float and record bank withdrawal</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-[#475569] font-medium block">
                  Keep for Tomorrow's Float (₹)
                </label>
                <input
                  type="text"
                  value={retainedFloatRupees}
                  onChange={(e) => setRetainedFloatRupees(e.target.value)}
                  placeholder="2000.00"
                  className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold font-mono text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden"
                />
                <span className="text-[9px] text-[#94A3B8] block mt-0.5">Change left in register</span>
              </div>

              <div>
                <label className="text-[11px] text-[#475569] font-medium block">
                  Cash to Safe / Bank (₹)
                </label>
                <div className="mt-1 h-8 px-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-bold font-mono text-[#0F172A] flex items-center">
                  {formatPaiseToRupees(withdrawnPaise)}
                </div>
                <span className="text-[9px] text-[#94A3B8] block mt-0.5">Withdrawn for safe/home</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#475569] font-medium block">
                Closing Remarks / Staff Handover Notes
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. ₹35,000 kept in safe by Rajesh, all notes verified."
                className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden"
              />
            </div>

            {/* Action Button: Confirm & Lock Day-End Settlement */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSaveSettlement}
                disabled={submitting}
                className="w-full h-10 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold rounded-lg text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Recording Settlement...</span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-red-400" />
                    <span>
                      {savedSettlement 
                        ? 'Update & Re-Lock Day-End Settlement' 
                        : 'Confirm & Lock Day-End Settlement'}
                    </span>
                  </>
                )}
              </button>
              {savedSettlement && (
                <p className="text-[11px] text-center text-[#64748B] mt-1.5">
                  Last settled on {new Date(savedSettlement.createdAt).toLocaleTimeString('en-IN')} by {savedSettlement.closedByName || 'Owner'}.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* HIDDEN PRINTABLE THERMAL SLIP (VISIBLE ONLY DURING WINDOW.PRINT())        */}
      {/* ========================================================================= */}
      <div id="printable-slip" className="hidden print:block font-mono text-xs max-w-sm mx-auto text-black">
        <div className="text-center border-b border-black pb-2 mb-2">
          <div className="font-bold text-sm uppercase">{tenant?.name || 'TradeLedger AutoLedger'}</div>
          <div className="text-[10px]">{tenant?.address || 'Daily Cash Register Closing Slip'}</div>
          <div className="font-bold mt-1 text-[11px]">DAY-END SETTLEMENT SLIP</div>
          <div className="text-[10px]">Date: {selectedDate} | Time: {new Date().toLocaleTimeString('en-IN')}</div>
        </div>

        <div className="space-y-1 border-b border-black pb-2 mb-2">
          <div className="flex justify-between">
            <span>Invoices Billed:</span>
            <span>{summary?.invoicesCount || 0} bills</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total Sales Billed:</span>
            <span>{formatPaiseToRupees(safeBigInt(summary?.totalBilledPaise))}</span>
          </div>
          <div className="flex justify-between">
            <span>UPI / QR Collected:</span>
            <span>{formatPaiseToRupees(upiCollectedPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bank Transfers:</span>
            <span>{formatPaiseToRupees(bankCollectedPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span>New Credit (Udhaar):</span>
            <span>{formatPaiseToRupees(safeBigInt(summary?.newCreditGivenPaise))}</span>
          </div>
        </div>

        <div className="space-y-1 border-b border-black pb-2 mb-2">
          <div className="font-bold underline">CASH DRAWER RECONCILIATION:</div>
          <div className="flex justify-between">
            <span>Opening Float:</span>
            <span>{formatPaiseToRupees(openingFloatPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cash Sales In:</span>
            <span>+ {formatPaiseToRupees(cashCollectedPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cash Expenses Out:</span>
            <span>- {formatPaiseToRupees(cashExpensesPaise)}</span>
          </div>
          {cashExpenseSummary && (
            <div className="text-[9px] text-gray-700 italic pl-2">
              Expenses: {cashExpenseSummary}
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Expected Cash:</span>
            <span>{formatPaiseToRupees(systemExpectedCashPaise)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Counted Physical Cash:</span>
            <span>{formatPaiseToRupees(totalPhysicalCashPaise)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Variance / Difference:</span>
            <span>{formatPaiseToRupees(differencePaise)} ({tallyStatus})</span>
          </div>
        </div>

        <div className="space-y-1 border-b border-black pb-2 mb-2 text-[10px]">
          <div className="font-bold underline text-xs">DENOMINATION BREAKDOWN:</div>
          {DENOMINATIONS.map((d) => {
            const count = noteCounts[d.value] || 0;
            if (count === 0) return null;
            return (
              <div key={d.value} className="flex justify-between">
                <span>₹{d.value} x {count}:</span>
                <span>₹{(d.value * count).toLocaleString('en-IN')}</span>
              </div>
            );
          })}
          {coinsPaise > 0n && (
            <div className="flex justify-between">
              <span>Loose Change / Coins:</span>
              <span>{formatPaiseToRupees(coinsPaise)}</span>
            </div>
          )}
        </div>

        <div className="space-y-1 border-b border-black pb-2 mb-2">
          <div className="flex justify-between font-bold">
            <span>Tomorrow's Float Kept:</span>
            <span>{formatPaiseToRupees(retainedFloatPaise)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Cash Withdrawn (Safe/Bank):</span>
            <span>{formatPaiseToRupees(withdrawnPaise)}</span>
          </div>
        </div>

        <div className="text-[10px] text-center pt-2 space-y-1">
          <div>Verified & Closed by: {user?.name || user?.phone || 'Store Owner'}</div>
          {remarks && <div>Remarks: {remarks}</div>}
          <div className="font-bold mt-2">--- End of Report ---</div>
        </div>
      </div>
    </div>
  );
}
