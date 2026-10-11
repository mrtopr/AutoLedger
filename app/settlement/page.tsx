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
  Check
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
  { value: 500, label: '₹500 Note', isCoin: false },
  { value: 200, label: '₹200 Note', isCoin: false },
  { value: 100, label: '₹100 Note', isCoin: false },
  { value: 50, label: '₹50 Note', isCoin: false },
  { value: 20, label: '₹20 Note', isCoin: false },
  { value: 10, label: '₹10 Note', isCoin: false },
  { value: 5, label: '₹5 (Note / Coin)', isCoin: true },
  { value: 2, label: '₹2 Coin', isCoin: true },
  { value: 1, label: '₹1 Coin', isCoin: true },
];

export default function DayEndSettlementPage() {
  const { user, tenant } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [onlineTxs, setOnlineTxs] = useState<OnlineTransaction[]>([]);
  const [savedSettlement, setSavedSettlement] = useState<SavedSettlement | null>(null);
  const [recentSettlements, setRecentSettlements] = useState<SavedSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [openingFloatRupees, setOpeningFloatRupees] = useState<string>('0.00');
  const [cashExpensesRupees, setCashExpensesRupees] = useState<string>('0.00');
  const [cashExpenseNote, setCashExpenseNote] = useState<string>('');
  const [noteCounts, setNoteCounts] = useState<Record<number, number>>({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0,
  });
  const [coinsTotalRupees, setCoinsTotalRupees] = useState<string>('0.00');
  const [retainedFloatRupees, setRetainedFloatRupees] = useState<string>('2000.00');
  const [remarks, setRemarks] = useState<string>('');
  const [upiVerified, setUpiVerified] = useState<boolean>(false);
  const [showOnlineList, setShowOnlineList] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // References for keyboard navigation across note inputs
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const isOwner = user?.role === 'OWNER';
  const isManager = user?.role === 'MANAGER';

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
          setOpeningFloatRupees((Number(ss.openingFloatPaise) / 100).toFixed(2));
          setCashExpensesRupees((Number(ss.cashExpensesPaise) / 100).toFixed(2));
          setRetainedFloatRupees((Number(ss.retainedFloatPaise) / 100).toFixed(2));
          setRemarks(ss.notes || '');
          setUpiVerified(Boolean(ss.upiVerified));
          if (ss.denominations) {
            setNoteCounts(ss.denominations as Record<number, number>);
          }
        } else {
          // Initialize defaults
          const initOpening = json.summary?.openingFloatPaise 
            ? (Number(json.summary.openingFloatPaise) / 100).toFixed(2) 
            : '0.00';
          setOpeningFloatRupees(initOpening);
          setCashExpensesRupees('0.00');
          setCashExpenseNote('');
          setRetainedFloatRupees('2000.00');
          setRemarks('');
          setUpiVerified(false);
          setNoteCounts({
            500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0,
          });
          setCoinsTotalRupees('0.00');
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
  const cashCollectedPaise = BigInt(summary?.cashCollectedPaise || '0');
  const cashExpensesPaise = parseRupeesToPaise(cashExpensesRupees);

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

  // Keyboard navigation: Enter jumps to next denomination
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextDenom = DENOMINATIONS[index + 1];
      if (nextDenom && inputRefs.current[nextDenom.value]) {
        inputRefs.current[nextDenom.value]?.focus();
        inputRefs.current[nextDenom.value]?.select();
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
    const newCounts: Record<number, number> = {
      500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0,
    };
    for (const d of [500, 200, 100, 50, 20, 10, 5, 2, 1]) {
      if (remaining >= d) {
        const count = Math.floor(remaining / d);
        newCounts[d] = count;
        remaining -= count * d;
      }
    }
    setNoteCounts(newCounts);
    setCoinsTotalRupees(remaining > 0 ? remaining.toFixed(2) : '0.00');
  };

  const handleSaveSettlement = async () => {
    try {
      setSubmitting(true);
      setSuccessMsg(null);

      const payload = {
        date: selectedDate,
        openingFloatPaise: openingFloatPaise.toString(),
        cashSalesPaise: summary?.cashCollectedPaise || '0',
        cashReceiptsPaise: '0',
        cashExpensesPaise: cashExpensesPaise.toString(),
        expectedCashPaise: systemExpectedCashPaise.toString(),
        denominations: noteCounts,
        countedCashPaise: totalPhysicalCashPaise.toString(),
        differencePaise: differencePaise.toString(),
        retainedFloatPaise: retainedFloatPaise.toString(),
        withdrawnPaise: withdrawnPaise.toString(),
        upiTotalPaise: summary?.upiCollectedPaise || '0',
        bankTotalPaise: summary?.bankCollectedPaise || '0',
        upiVerified,
        notes: remarks + (cashExpenseNote ? ` | Cash Exp: ${cashExpenseNote}` : ''),
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

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

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
            <span>Day-End Cash & UPI Reconciliation</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 pl-9">
            Verify every note in the drawer down to the penny, and cross-check UPI/Bank collections with your phone.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs font-medium text-[#334155]">
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-[#0F172A] focus:outline-hidden"
            />
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
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-800 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 font-bold hover:underline">
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
                      <td className="p-2 font-mono font-semibold">{formatPaiseToRupees(BigInt(s.countedCashPaise))}</td>
                      <td className="p-2 font-mono text-[#64748B]">{formatPaiseToRupees(BigInt(s.expectedCashPaise))}</td>
                      <td className="p-2 font-mono font-bold">
                        {s.differencePaise === '0' ? (
                          <span className="text-green-600">₹0.00</span>
                        ) : (
                          <span className={BigInt(s.differencePaise) < 0n ? 'text-red-600' : 'text-amber-600'}>
                            {formatPaiseToRupees(BigInt(s.differencePaise))}
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-[#64748B]">{formatPaiseToRupees(BigInt(s.retainedFloatPaise))}</td>
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
                        <button
                          onClick={() => {
                            setSelectedDate(s.date);
                            setShowHistory(false);
                          }}
                          className="text-[#2563EB] hover:underline font-semibold"
                        >
                          View / Load
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Today's High-Level Financial Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Invoiced */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Billed Today</span>
          <div className="mt-1 text-lg font-bold text-[#0F172A] font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(summary?.totalBilledPaise || '0'))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">{summary?.invoicesCount || 0} bills issued</div>
        </div>

        {/* Total Collections Received */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Total Payments Received</span>
          <div className="mt-1 text-lg font-bold text-green-700 font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(summary?.totalCollectedPaise || '0'))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Cash + UPI + Bank credits</div>
        </div>

        {/* Cash Collected */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-[#334155] uppercase tracking-wider block">Cash Inflows Today</span>
          <div className="mt-1 text-lg font-bold text-[#0F172A] font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(summary?.cashCollectedPaise || '0'))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Cash collected at counter</div>
        </div>

        {/* Online (UPI + Bank) Collected */}
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Digital / Online Collections</span>
          <div className="mt-1 text-lg font-bold text-blue-700 font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(summary?.upiCollectedPaise || '0') + BigInt(summary?.bankCollectedPaise || '0'))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">{onlineTxs.length} online transfers</div>
        </div>
      </div>

      {/* Main 2-Column Split: SECTION 1 (Online/UPI) & SECTION 2 (Physical Cash Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ========================================================================= */}
        {/* SECTION 1: ONLINE / UPI / BANK CONFIRMATION CARD (4 Cols on desktop)    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3.5">
            <div className="border-b border-[#E2E8F0] pb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Online & UPI Collections
                  </h2>
                  <p className="text-[10px] text-[#64748B]">Verify on PhonePe / GPay / NetBanking</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {onlineTxs.length} TXNS
              </span>
            </div>

            {/* UPI Summary Box */}
            <div className="p-3 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF] rounded-lg border border-[#DBEAFE] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-xs font-semibold text-[#1E3A8A]">UPI / QR Collections:</span>
                </div>
                <span className="text-base font-bold font-mono text-blue-700 tabular-nums">
                  {formatPaiseToRupees(BigInt(summary?.upiCollectedPaise || '0'))}
                </span>
              </div>

              {Number(summary?.bankCollectedPaise || 0) > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-blue-200/50 text-xs">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-semibold text-indigo-900">Bank Transfer / NEFT:</span>
                  </div>
                  <span className="font-bold font-mono text-indigo-700 tabular-nums">
                    {formatPaiseToRupees(BigInt(summary?.bankCollectedPaise || '0'))}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-blue-200 flex items-center justify-between text-xs">
                <span className="font-bold text-[#1E293B]">Total Digital Money:</span>
                <span className="font-bold font-mono text-[#0F172A]">
                  {formatPaiseToRupees(BigInt(summary?.upiCollectedPaise || '0') + BigInt(summary?.bankCollectedPaise || '0'))}
                </span>
              </div>
            </div>

            {/* Owner Verification Checkbox */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition select-none ${
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
                  {upiVerified ? '✅ UPI & Bank Statement Verified' : 'Check against PhonePe / GPay App'}
                </span>
                <span className="text-[11px] text-[#64748B] block mt-0.5">
                  I confirm the ₹{((Number(summary?.upiCollectedPaise || 0) + Number(summary?.bankCollectedPaise || 0)) / 100).toLocaleString('en-IN')} matches my UPI Soundbox & bank account credits.
                </span>
              </div>
            </label>

            {/* Expandable Online Transactions List */}
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
                          {formatPaiseToRupees(BigInt(tx.amountPaise))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* New Udhaar / Credit Given Notice */}
          {Number(summary?.newCreditGivenPaise || 0) > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 text-xs text-[#92400E] flex items-start gap-2.5">
              <Split className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">New Khata (Credit) Extended Today: </span>
                <span className="font-mono font-bold">{formatPaiseToRupees(BigInt(summary?.newCreditGivenPaise || '0'))}</span>
                <p className="text-[11px] text-[#B45309] mt-0.5">
                  Customers bought items on credit. This amount is recorded in debtor ledgers and is not expected in the cash drawer.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: PHYSICAL CASH DRAWER & DENOMINATION GRID (7 Cols on desktop) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
            
            {/* Header with Title & Quick Autofill */}
            <div className="border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Physical Cash Drawer Tally
                  </h2>
                  <p className="text-[10px] text-[#64748B]">Enter note counts to track every penny</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={autofillExpected}
                  className="px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-blue-50 rounded border border-blue-200 transition"
                  title="Autofill note counts to match expected cash"
                >
                  Quick Match
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoteCounts({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
                    setCoinsTotalRupees('0.00');
                  }}
                  className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded"
                  title="Reset counts"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Formula Row: Opening Float + Cash In - Cash Out = Expected Cash */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs">
              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase block">
                  1. Opening Float (₹)
                </label>
                <input
                  type="text"
                  value={openingFloatRupees}
                  onChange={(e) => setOpeningFloatRupees(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded text-xs font-bold font-mono text-[#0F172A] focus:border-red-500 focus:outline-hidden"
                />
                <span className="text-[9px] text-[#94A3B8]">Kept from yesterday</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase block">
                  2. Cash Sales In (₹)
                </label>
                <div className="mt-1 h-8 px-2.5 bg-white border border-[#E2E8F0] rounded text-xs font-bold font-mono text-green-700 flex items-center">
                  + {formatPaiseToRupees(cashCollectedPaise)}
                </div>
                <span className="text-[9px] text-[#94A3B8]">Billed at counter</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase block">
                  3. Cash Expenses Out (₹)
                </label>
                <input
                  type="text"
                  value={cashExpensesRupees}
                  onChange={(e) => setCashExpensesRupees(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded text-xs font-bold font-mono text-red-600 focus:border-red-500 focus:outline-hidden"
                />
                <input
                  type="text"
                  value={cashExpenseNote}
                  onChange={(e) => setCashExpenseNote(e.target.value)}
                  placeholder="Chai / Courier / Petrol"
                  className="mt-1 w-full h-6 px-1.5 bg-transparent border-b border-dashed border-[#CBD5E1] text-[10px] text-[#475569] placeholder:text-[#94A3B8] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Total Expected Drawer Balance Banner */}
            <div className="p-3 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#334155] block">🎯 System Expected Cash in Register:</span>
                <span className="text-[10px] text-[#64748B]">Opening + Cash Sales - Cash Out</span>
              </div>
              <span className="text-base font-bold font-mono text-[#0F172A] tabular-nums">
                {formatPaiseToRupees(systemExpectedCashPaise)}
              </span>
            </div>

            {/* Denomination Input Table */}
            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-bold uppercase text-[10px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-2 px-3 text-left">Denomination</th>
                    <th className="py-2 px-3 text-center w-28">Note Count</th>
                    <th className="py-2 px-3 text-right">Subtotal (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {DENOMINATIONS.map((d, idx) => {
                    const count = noteCounts[d.value] || 0;
                    const subtotalPaise = BigInt(d.value) * 100n * BigInt(count);
                    return (
                      <tr key={d.value} className="hover:bg-[#F8FAFC]/60 transition">
                        <td className="py-1.5 px-3 font-semibold text-[#1E293B] flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${d.isCoin ? 'bg-amber-400' : 'bg-green-500'}`} />
                          <span>{d.label}</span>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            ref={(el) => { inputRefs.current[d.value] = el; }}
                            type="text"
                            inputMode="numeric"
                            value={noteCounts[d.value] === 0 ? '' : noteCounts[d.value]}
                            placeholder="0"
                            onChange={(e) => handleNoteCountChange(d.value, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            className="w-20 h-7 text-center font-mono font-bold text-xs bg-[#F8F9FA] hover:bg-white focus:bg-white border border-[#CBD5E1] rounded focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-[#0F172A] tabular-nums">
                          {formatPaiseToRupees(subtotalPaise)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Loose Coins Row */}
                  <tr className="bg-[#F8FAFC]/80">
                    <td className="py-1.5 px-3 font-semibold text-[#1E293B] flex items-center gap-2">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span>Loose Change / Coins (₹)</span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="text"
                        value={coinsTotalRupees === '0.00' ? '' : coinsTotalRupees}
                        placeholder="0.00"
                        onChange={(e) => setCoinsTotalRupees(e.target.value)}
                        className="w-20 h-7 text-center font-mono font-bold text-xs bg-white border border-[#CBD5E1] rounded focus:border-[#C81E1E] focus:outline-hidden transition"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-[#0F172A] tabular-nums">
                      {formatPaiseToRupees(coinsPaise)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-[#0F172A] text-white font-bold border-t-2 border-[#1E293B]">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-xs uppercase tracking-wider">
                      TOTAL PHYSICAL CASH COUNTED
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm tabular-nums text-green-300">
                      {formatPaiseToRupees(totalPhysicalCashPaise)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* LIVE DISCREPANCY / VARIANCE STATUS CARD */}
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold ${
              tallyStatus === 'BALANCED'
                ? 'bg-green-50 border-green-300 text-green-900'
                : tallyStatus === 'SHORT'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                {tallyStatus === 'BALANCED' && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                {tallyStatus === 'SHORT' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
                {tallyStatus === 'EXCESS' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
                <div>
                  <div className="font-bold text-sm">
                    {tallyStatus === 'BALANCED' && '✅ Cash Balanced. All money accounted for!'}
                    {tallyStatus === 'SHORT' && `⚠️ Cash Shortage by ${formatPaiseToRupees(differencePaise * -1n)}`}
                    {tallyStatus === 'EXCESS' && `⚠️ Cash Excess by ${formatPaiseToRupees(differencePaise)}`}
                  </div>
                  <div className="text-[11px] font-normal opacity-90">
                    {tallyStatus === 'BALANCED' && 'Physical drawer count exactly matches system sales.'}
                    {tallyStatus === 'SHORT' && 'Counted cash is less than expected. Please verify unentered expenses or missing change.'}
                    {tallyStatus === 'EXCESS' && 'Counted cash is greater than expected. Check if an invoice or payment was missed.'}
                  </div>
                </div>
              </div>

              <div className="font-mono text-base font-bold tabular-nums shrink-0">
                {differencePaise === 0n ? '₹0.00 Difference' : formatPaiseToRupees(differencePaise)}
              </div>
            </div>

            {/* Cash Handover & Float Allocation */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
              <span className="font-bold text-[#0F172A] block uppercase text-[10px] tracking-wider">
                💼 End-of-Day Cash Handover & Float Allocation
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#475569] font-medium block">
                    Keep for Tomorrow's Opening Float (₹)
                  </label>
                  <input
                    type="text"
                    value={retainedFloatRupees}
                    onChange={(e) => setRetainedFloatRupees(e.target.value)}
                    placeholder="2000.00"
                    className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded text-xs font-bold font-mono text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-[#94A3B8]">Small change left in register for tomorrow</span>
                </div>

                <div>
                  <label className="text-[11px] text-[#475569] font-medium block">
                    Cash Withdrawn (Bank Deposit / Safe) (₹)
                  </label>
                  <div className="mt-1 h-8 px-2.5 bg-white border border-[#CBD5E1] rounded text-xs font-bold font-mono text-[#0F172A] flex items-center">
                    {formatPaiseToRupees(withdrawnPaise)}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Taken home or deposited into bank</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#475569] font-medium block">
                  Owner Remarks / Handover Notes
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., All notes checked, ₹35,000 deposited in safe by Rajesh."
                  className="mt-1 w-full h-8 px-2.5 bg-white border border-[#CBD5E1] rounded text-xs text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Action Button: Close & Reconcile Day */}
            <div className="pt-2">
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
                        : 'Confirm & Close Cash Register for Today'}
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
            <span>{formatPaiseToRupees(BigInt(summary?.totalBilledPaise || '0'))}</span>
          </div>
          <div className="flex justify-between">
            <span>UPI / QR Collected:</span>
            <span>{formatPaiseToRupees(BigInt(summary?.upiCollectedPaise || '0'))}</span>
          </div>
          <div className="flex justify-between">
            <span>Bank Transfers:</span>
            <span>{formatPaiseToRupees(BigInt(summary?.bankCollectedPaise || '0'))}</span>
          </div>
          <div className="flex justify-between">
            <span>New Credit (Udhaar):</span>
            <span>{formatPaiseToRupees(BigInt(summary?.newCreditGivenPaise || '0'))}</span>
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
          {Number(coinsTotalRupees) > 0 && (
            <div className="flex justify-between">
              <span>Loose Coins:</span>
              <span>₹{coinsTotalRupees}</span>
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
