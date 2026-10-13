'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Calendar,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Banknote,
  QrCode,
  CreditCard,
  BookOpen,
  ArrowRight,
  Printer,
  Download,
  Share2,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  ShieldCheck,
  Check,
  FileText,
  Building2,
  DollarSign,
  Info
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import ModernLoader from '@/app/components/ModernLoader';
import ZReportModal from '@/app/components/ZReportModal';

interface DenominationRow {
  value: number;
  label: string;
  count: number;
}

const DEFAULT_DENOMINATIONS: DenominationRow[] = [
  { value: 500, label: '₹500 Note', count: 0 },
  { value: 200, label: '₹200 Note', count: 0 },
  { value: 100, label: '₹100 Note', count: 0 },
];

export default function DayEndSettlementPage() {
  const { tenant, user } = useAuth();
  const { t } = useLanguage();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isZReportOpen, setIsZReportOpen] = useState<boolean>(false);

  // Report Data
  const [savedSettlement, setSavedSettlement] = useState<any | null>(null);
  const [summary, setSummary] = useState<any>({
    openingFloatPaise: '200000',
    cashCollectedPaise: '0',
    upiCollectedPaise: '0',
    bankCollectedPaise: '0',
    totalInvoicesCount: 0,
    grossSalesPaise: '0',
    khataGivenPaise: '0',
    cashExpensesPaise: '0',
  });
  const [invoices, setInvoices] = useState<any[]>([]);

  // Cashier Inputs
  const [denominations, setDenominations] = useState<DenominationRow[]>(DEFAULT_DENOMINATIONS);
  const [looseChangeRupees, setLooseChangeRupees] = useState<string>('0');
  const [openingFloatRupees, setOpeningFloatRupees] = useState<string>('2000');
  const [cashExpensesRupees, setCashExpensesRupees] = useState<string>('0');
  const [retainedFloatRupees, setRetainedFloatRupees] = useState<string>('2000');
  const [upiVerified, setUpiVerified] = useState<boolean>(false);
  const [settlementNotes, setSettlementNotes] = useState<string>('');

  // Fetch report data for chosen date
  const loadSettlementData = async (dateStr: string) => {
    try {
      setLoading(true);
      setSaveSuccess(false);
      const res = await fetch(`/api/v1/reports/settlement?date=${dateStr}`);
      if (res.ok) {
        const json = await res.json();
        setSavedSettlement(json.savedSettlement || null);
        setSummary(json.summary || {});
        setInvoices(json.invoices || []);

        if (json.savedSettlement) {
          const s = json.savedSettlement;
          setOpeningFloatRupees((Number(s.openingFloatPaise || 0) / 100).toFixed(0));
          setCashExpensesRupees((Number(s.cashExpensesPaise || 0) / 100).toFixed(0));
          setRetainedFloatRupees((Number(s.retainedFloatPaise || 0) / 100).toFixed(0));
          setUpiVerified(Boolean(s.upiVerified));
          setSettlementNotes(s.notes || '');

          if (s.denominations) {
            setDenominations(
              DEFAULT_DENOMINATIONS.map(d => ({
                ...d,
                count: Number(s.denominations[d.value.toString()] || 0),
              }))
            );
            if (s.denominations['coins'] !== undefined) {
              setLooseChangeRupees(s.denominations['coins'].toString());
            } else {
              setLooseChangeRupees('0');
            }
          }
        } else {
          // Fresh calculation for open day
          const opening = (Number(json.summary?.openingFloatPaise || 200000) / 100).toFixed(0);
          setOpeningFloatRupees(opening);
          setRetainedFloatRupees(opening);
          setCashExpensesRupees('0');
          setLooseChangeRupees('0');
          setDenominations(DEFAULT_DENOMINATIONS);
          setUpiVerified(false);
          setSettlementNotes('');
        }
      }
    } catch (err) {
      console.error('Error loading settlement data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlementData(selectedDate);
  }, [selectedDate]);

  // Handle Denomination count changes
  const handleCountChange = (val: number, countStr: string) => {
    const count = Math.max(0, parseInt(countStr.replace(/\D/g, '')) || 0);
    setDenominations(prev =>
      prev.map(d => (d.value === val ? { ...d, count } : d))
    );
  };

  // Computations
  const totalNotesRupees = useMemo(() => {
    return denominations.reduce((acc, curr) => acc + curr.value * curr.count, 0);
  }, [denominations]);

  const looseChangeValue = useMemo(() => {
    return Number(looseChangeRupees) || 0;
  }, [looseChangeRupees]);

  const totalCountedRupees = useMemo(() => {
    return totalNotesRupees + looseChangeValue;
  }, [totalNotesRupees, looseChangeValue]);

  const totalCountedPaise = useMemo(() => {
    return BigInt(Math.round(totalCountedRupees * 100));
  }, [totalCountedRupees]);

  const openingFloatPaise = useMemo(() => {
    return parseRupeesToPaise(openingFloatRupees || '0');
  }, [openingFloatRupees]);

  const cashSalesPaise = useMemo(() => {
    return BigInt(summary.cashCollectedPaise || '0');
  }, [summary.cashCollectedPaise]);

  const cashExpensesPaise = useMemo(() => {
    return parseRupeesToPaise(cashExpensesRupees || '0');
  }, [cashExpensesRupees]);

  const expectedCashPaise = useMemo(() => {
    const exp = openingFloatPaise + cashSalesPaise - cashExpensesPaise;
    return exp > 0n ? exp : 0n;
  }, [openingFloatPaise, cashSalesPaise, cashExpensesPaise]);

  const differencePaise = useMemo(() => {
    return totalCountedPaise - expectedCashPaise;
  }, [totalCountedPaise, expectedCashPaise]);

  const retainedFloatPaise = useMemo(() => {
    return parseRupeesToPaise(retainedFloatRupees || '0');
  }, [retainedFloatRupees]);

  const withdrawnPaise = useMemo(() => {
    const withdraw = totalCountedPaise - retainedFloatPaise;
    return withdraw > 0n ? withdraw : 0n;
  }, [totalCountedPaise, retainedFloatPaise]);

  const varianceStatus = useMemo<'BALANCED' | 'SHORT' | 'EXCESS'>(() => {
    if (differencePaise === 0n) return 'BALANCED';
    if (differencePaise < 0n) return 'SHORT';
    return 'EXCESS';
  }, [differencePaise]);

  // Save Day-End Settlement
  const handleSaveSettlement = async () => {
    try {
      setSaving(true);
      const denomMap: Record<string, number> = {};
      denominations.forEach(d => {
        if (d.count > 0) denomMap[d.value.toString()] = d.count;
      });
      if (looseChangeValue > 0) {
        denomMap['coins'] = looseChangeValue;
      }

      const payload = {
        date: selectedDate,
        openingFloatPaise: openingFloatPaise.toString(),
        cashSalesPaise: cashSalesPaise.toString(),
        cashReceiptsPaise: '0',
        cashExpensesPaise: cashExpensesPaise.toString(),
        expectedCashPaise: expectedCashPaise.toString(),
        denominations: denomMap,
        countedCashPaise: totalCountedPaise.toString(),
        differencePaise: differencePaise.toString(),
        retainedFloatPaise: retainedFloatPaise.toString(),
        withdrawnPaise: withdrawnPaise.toString(),
        upiTotalPaise: (summary.upiCollectedPaise || '0').toString(),
        bankTotalPaise: (summary.bankCollectedPaise || '0').toString(),
        upiVerified,
        notes: settlementNotes,
        status: varianceStatus,
      };

      const res = await fetch('/api/v1/reports/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setSavedSettlement(json.settlement);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert('Failed to save settlement. Please review values and try again.');
      }
    } catch (e) {
      console.error('Error saving settlement:', e);
      alert('Network error while saving settlement.');
    } finally {
      setSaving(false);
    }
  };

  // High-Resolution Print / Z-Report
  const handlePrintZReport = () => {
    setIsZReportOpen(true);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16 print:p-0 print:space-y-2">
      {/* 1. TOP COMMAND BAR: TITLE, DATE SELECTOR & STATUS */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 print:border-none print:shadow-none">
        {/* Left: Terminal Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#C81E1E] flex items-center justify-center font-bold border border-red-100 shrink-0 shadow-2xs">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#0F172A] tracking-tight">
                Day-End Settlement & Cash Reconciliation
              </h1>
              {savedSettlement ? (
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>CLOSED & SETTLED</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>TILL ACTIVE · OPEN</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#64748B]">
              Physical Cash Tally · Digital UPI Verification · Float Rollover & Daily Z-Report
            </div>
          </div>
        </div>

        {/* Right: Date Picker & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-[#F8F9FA] hover:bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1 shadow-2xs transition focus-within:border-[#C81E1E] focus-within:bg-white h-9">
            <Calendar className="w-3.5 h-3.5 text-[#C81E1E] shrink-0" />
            <div className="flex flex-col justify-center">
              <label htmlFor="settlement-date" className="text-[8px] uppercase font-bold text-[#64748B] leading-none select-none">
                Settlement Date
              </label>
              <input
                id="settlement-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold text-[#0F172A] bg-transparent border-0 outline-hidden p-0 cursor-pointer h-4 font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadSettlementData(selectedDate)}
            className="h-9 px-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Refresh Ledger Figures"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handlePrintZReport}
            className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Download Official Day-End Z-Report PDF"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Download Z-Report</span>
          </button>

          <Link
            href="/pos"
            className="h-9 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-white" />
            <span>Counter POS</span>
          </Link>
        </div>
      </div>

      {/* Save Success Alert Banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center justify-between text-emerald-950 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Day-End Settlement & Cash Reconciliation closed and saved successfully!</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-800 font-semibold">
            {savedSettlement?.id}
          </span>
        </div>
      )}

      {/* 2. FOUR KPI SUMMARY CARDS (TILL HERO) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Opening Cash Float */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#64748B] font-semibold">
            <span>Morning Opening Float</span>
            <Coins className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">
            {formatPaiseToRupees(openingFloatPaise)}
          </div>
          <div className="text-[10px] text-[#64748B]">Cash kept in drawer at open</div>
        </div>

        {/* 2. Counter Cash Collected */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
            <span>Cash Sales Received</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
            +{formatPaiseToRupees(cashSalesPaise)}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium">From counter bills & receipts</div>
        </div>

        {/* 3. Cash Expenses / Payouts */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-rose-800 font-semibold">
            <span>Petty Expenses / Out</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-rose-700">
            -{formatPaiseToRupees(cashExpensesPaise)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium">Tea, courier, local shop expenses</div>
        </div>

        {/* 4. Expected Physical Cash in Till */}
        <div className="bg-slate-900 border border-slate-900 rounded-xl p-3.5 shadow-xs space-y-1 text-white">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold uppercase tracking-wider">
            <span>Expected Till Cash</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono tabular-nums text-white">
            {formatPaiseToRupees(expectedCashPaise)}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Float + In - Out
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSTATION: 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

        {/* LEFT COLUMN (7 COLS): PHYSICAL CASH DENOMINATION CALCULATOR */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-[#C81E1E]" />
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Cash Denomination Count (₹500 · ₹200 · ₹100)
                </h2>
              </div>
              <span className="text-[10px] text-[#64748B] font-mono font-medium">
                Big Currency Notes Only
              </span>
            </div>

            {/* Denomination Table - Big Notes Only */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold text-[10px] uppercase">
                    <th className="py-2.5 px-3">Note Denomination</th>
                    <th className="py-2.5 px-3 w-32 text-center">Piece Count</th>
                    <th className="py-2.5 px-3 w-36 text-right">Subtotal (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {denominations.map((denom) => {
                    const rowSubtotal = denom.value * denom.count;
                    return (
                      <tr key={denom.value} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            denom.value === 500 ? 'bg-amber-600' : denom.value === 200 ? 'bg-orange-500' : 'bg-indigo-500'
                          }`} />
                          <span className="text-sm font-mono">{denom.label}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="text"
                            value={denom.count === 0 ? '' : denom.count.toString()}
                            onChange={(e) => handleCountChange(denom.value, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            className="w-24 text-center font-mono font-bold text-sm bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1.5 px-2 text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden shadow-2xs"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-sm tabular-nums text-slate-900">
                          ₹{rowSubtotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                    <td className="py-2.5 px-3 text-slate-900 uppercase text-[11px]">
                      Total Big Notes Counted
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700 text-xs">
                      {denominations.reduce((sum, d) => sum + d.count, 0)} pcs
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-[#0F172A] tabular-nums">
                      ₹{totalNotesRupees.toLocaleString('en-IN')}.00
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Reconciliation Variance Audit Alert Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              varianceStatus === 'BALANCED'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : varianceStatus === 'SHORT'
                ? 'bg-red-50 border-red-300 text-red-950'
                : 'bg-blue-50 border-blue-300 text-blue-950'
            }`}>
              <div className="flex items-center gap-2">
                {varianceStatus === 'BALANCED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : varianceStatus === 'SHORT' ? (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                ) : (
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {varianceStatus === 'BALANCED' && 'Till Reconciled & Balanced'}
                    {varianceStatus === 'SHORT' && 'Cash Shortage Detected'}
                    {varianceStatus === 'EXCESS' && 'Cash Excess Detected'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {varianceStatus === 'BALANCED' && 'Physical cash counted matches expected sales ledger exactly.'}
                    {varianceStatus === 'SHORT' && 'Physical cash is lower than expected ledger. Please verify cash drawer or unrecorded expenses.'}
                    {varianceStatus === 'EXCESS' && 'Physical cash is higher than expected ledger. Unrecorded sale receipts present.'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                  Difference
                </span>
                <span className={`font-mono font-black text-sm tabular-nums ${
                  varianceStatus === 'BALANCED' ? 'text-emerald-800' : varianceStatus === 'SHORT' ? 'text-red-700' : 'text-blue-800'
                }`}>
                  {differencePaise === 0n ? '₹0.00' : formatPaiseToRupees(differencePaise)}
                </span>
              </div>
            </div>

            {/* Cash Drawer Adjustments: Opening Float, Petty Expenses & Loose Change */}
            <div className="pt-2 border-t border-[#F1F5F9] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Opening Float (₹)
                </label>
                <input
                  type="text"
                  value={openingFloatRupees}
                  onChange={(e) => setOpeningFloatRupees(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="2000"
                  className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1.5 px-3 font-mono font-bold text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Cash in drawer before first sale</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Petty Expenses Today (₹)
                </label>
                <input
                  type="text"
                  value={cashExpensesRupees}
                  onChange={(e) => setCashExpensesRupees(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1.5 px-3 font-mono font-bold text-xs text-rose-700 focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Paid in cash from drawer</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Coins & Loose Change (₹)
                </label>
                <input
                  type="text"
                  value={looseChangeRupees}
                  onChange={(e) => setLooseChangeRupees(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1.5 px-3 font-mono font-bold text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Small change or coins in till</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 COLS): DIGITAL COLLECTIONS, ALLOCATION & SETTLEMENT ACTION */}
        <div className="lg:col-span-5 space-y-3.5">

          {/* Digital Payments & UPI Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Digital Collections (UPI & Bank)
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                Direct to Bank
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">UPI / QR Counter Sales</div>
                  <div className="text-[10px] text-slate-500">Collected via PhonePe, GPay, Paytm QR</div>
                </div>
                <div className="font-mono font-bold text-sm text-blue-700 tabular-nums">
                  {formatPaiseToRupees(BigInt(summary.upiCollectedPaise || '0'))}
                </div>
              </div>

              {/* UPI Verification Checkbox */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition select-none">
                <input
                  type="checkbox"
                  checked={upiVerified}
                  onChange={(e) => setUpiVerified(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#C81E1E] focus:ring-[#C81E1E]"
                />
                <div className="text-[11px] leading-tight">
                  <span className="font-bold text-slate-900 block">Verified against Bank App / Soundbox</span>
                  <span className="text-slate-500 text-[10px]">
                    Confirmed that all UPI settlements have arrived in the bank account.
                  </span>
                </div>
              </label>

              {/* Khata / Credit Given Today */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold text-amber-950">Credit Given Today (Khata)</div>
                  <div className="text-[10px] text-amber-800">Added to customer ledger balances</div>
                </div>
                <div className="font-mono font-bold text-sm text-amber-900 tabular-nums">
                  {formatPaiseToRupees(BigInt(summary.khataGivenPaise || '0'))}
                </div>
              </div>
            </div>
          </div>

          {/* EOD Cash Allocation: Take Home vs Float Rollover */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#C81E1E]" />
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Cash Take-Home & Float Allocation
                </h2>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Retain for Tomorrow's Opening Float (₹)
                </label>
                <input
                  type="text"
                  value={retainedFloatRupees}
                  onChange={(e) => setRetainedFloatRupees(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="2000"
                  className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1.5 px-3 font-mono font-bold text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Cash left in drawer for morning counter change</span>
              </div>

              {/* Net Cash Take-Home / Bank Deposit */}
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-800">
                    Cash Withdrawn / Bank Deposit
                  </div>
                  <div className="text-[10px] text-emerald-700">Counted Cash minus Retained Float</div>
                </div>
                <div className="font-mono font-black text-base text-emerald-950 tabular-nums">
                  {formatPaiseToRupees(withdrawnPaise)}
                </div>
              </div>

              {/* Settlement Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reconciliation Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="e.g. ₹50 difference due to loose change rounding; verified by manager."
                  className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs resize-none"
                />
              </div>

              {/* Final Submit Button */}
              <button
                type="button"
                onClick={handleSaveSettlement}
                disabled={saving}
                className="w-full h-11 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {saving ? (
                  <>
                    <ModernLoader size="xs" />
                    <span>Saving Day-End Tally...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Close Till & Save Day-End Settlement</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 4. DAILY BILLS & INVOICES AUDIT TRAIL */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C81E1E]" />
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Bills Issued on {selectedDate} ({invoices.length} Bills)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-600 font-semibold">
            Total Sales: {formatPaiseToRupees(BigInt(summary.grossSalesPaise || '0'))}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[#64748B] font-semibold text-[10px] uppercase">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Bill Number</th>
                <th className="py-2.5 px-3">Customer / Client</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3 text-right">Bill Total</th>
                <th className="py-2.5 px-3 text-right">Paid Now</th>
                <th className="py-2.5 px-3 text-right">Khata Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-slate-800">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No counter bills issued on {selectedDate}.
                  </td>
                </tr>
              ) : (
                invoices.map((inv, idx) => {
                  const billTotal = BigInt(inv.grandTotalPaise || '0');
                  const paidNow = BigInt(inv.paidNowPaise || '0');
                  const balanceDue = BigInt(inv.creditBalancePaise || '0');
                  const timeStr = inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';

                  return (
                    <tr key={inv.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{inv.customerShop || inv.customerName}</div>
                        {inv.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                        {timeStr}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                        {formatPaiseToRupees(billTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-emerald-700">
                        {formatPaiseToRupees(paidNow)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-amber-800">
                        {balanceDue > 0n ? formatPaiseToRupees(balanceDue) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. OFFICIAL DAY-END Z-REPORT PRINT PREVIEW & EXPORT MODAL */}
      <ZReportModal
        isOpen={isZReportOpen}
        onClose={() => setIsZReportOpen(false)}
        date={selectedDate}
        tenant={tenant}
        user={user}
        summary={summary}
        savedSettlement={savedSettlement}
        denominations={denominations}
        looseChangeRupees={looseChangeRupees}
        openingFloatRupees={openingFloatRupees}
        cashExpensesRupees={cashExpensesRupees}
        retainedFloatRupees={retainedFloatRupees}
        totalNotesRupees={totalNotesRupees}
        totalCountedRupees={totalCountedRupees}
        expectedCashPaise={expectedCashPaise}
        totalCountedPaise={totalCountedPaise}
        differencePaise={differencePaise}
        varianceStatus={varianceStatus}
        withdrawnPaise={withdrawnPaise}
        upiVerified={upiVerified}
        settlementNotes={settlementNotes}
        invoices={invoices}
      />
    </div>
  );
}
