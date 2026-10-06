'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Calculator, 
  TrendingUp, 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Printer, 
  DollarSign, 
  Split, 
  AlertCircle,
  Crown,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';

interface SettlementData {
  date: string;
  invoiceCount: number;
  totalBilledPaise: string;
  totalTaxCollectedPaise: string;
  totalCogsPaise: string;
  grossProfitPaise: string;
  marginPercent: string;
  cashCollectedPaise: string;
  upiCollectedPaise: string;
  bankCollectedPaise: string;
  totalCollectedPaise: string;
  newUdhaarGivenPaise: string;
  paymentsCount: number;
}

export default function DayEndSettlementPage() {
  const { user } = useAuth();
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [physicalCashInput, setPhysicalCashInput] = useState<string>('400.00');
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    async function fetchSettlement() {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/reports/settlement');
        if (res.ok) {
          const json = await res.json();
          if (json.settlement) {
            setData(json.settlement);
            setPhysicalCashInput((Number(json.settlement.cashCollectedPaise) / 100).toFixed(2));
          }
        }
      } catch (err) {
        console.error('Error loading settlement report:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettlement();
  }, []);

  const isOwner = user?.role === 'OWNER';
  const isManager = user?.role === 'MANAGER';

  if (!isOwner && !isManager) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Manager & Owner Access Only</h2>
        <p className="text-xs text-slate-500">
          Day-end cash counter settlement and gross profit analytics are restricted to Shop Managers and Owners.
        </p>
        <Link
          href="/pos"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
        >
          Return to Counter POS
        </Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-500 font-medium">
        Calculating day-end drawer totals and margins...
      </div>
    );
  }

  const cashExpected = BigInt(data?.cashCollectedPaise || 0);
  const physicalCashPaise = BigInt(Math.round(parseFloat(physicalCashInput || '0') * 100));
  const cashDiscrepancyPaise = physicalCashPaise - cashExpected;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
              EOD RECONCILIATION
            </span>
            <span className="text-xs text-slate-400 font-mono">Date: {data?.date}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" />
            Day-End Cash & Margin Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit today's cash drawer, UPI settlements, new credit issued, and wholesale gross profit margins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print EOD Summary</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Billed */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales / Invoiced</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-numeric">
            {formatPaiseToRupees(BigInt(data?.totalBilledPaise || 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">{data?.invoiceCount} bills issued today</div>
        </div>

        {/* Total Collected */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Collected Today</span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono-numeric">
            {formatPaiseToRupees(BigInt(data?.totalCollectedPaise || 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">Cash + UPI payments received</div>
        </div>

        {/* Gross Profit & Margin (Owner / Manager Insight) */}
        <div className="bg-white border border-blue-200 border-t-2 border-t-blue-600 p-5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Wholesale Gross Profit</span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
              {data?.marginPercent}% Margin
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700 font-mono-numeric">
            {formatPaiseToRupees(BigInt(data?.grossProfitPaise || 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">COGS: {formatPaiseToRupees(BigInt(data?.totalCogsPaise || 0))}</div>
        </div>
      </div>

      {/* Main Reconciliation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Collections Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Split className="w-4 h-4 text-indigo-600" />
              Counter Collection Modes Breakdown
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-700">Cash Received at Register:</span>
              </div>
              <span className="font-mono-numeric font-bold text-slate-900 text-sm">
                {formatPaiseToRupees(BigInt(data?.cashCollectedPaise || 0))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-semibold text-slate-700">UPI / QR Bank Credits:</span>
              </div>
              <span className="font-mono-numeric font-bold text-slate-900 text-sm">
                {formatPaiseToRupees(BigInt(data?.upiCollectedPaise || 0))}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50/60 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="font-semibold text-amber-900">New Udhaar (Credit) Extended Today:</span>
              </div>
              <span className="font-mono-numeric font-bold text-amber-800 text-sm">
                {formatPaiseToRupees(BigInt(data?.newUdhaarGivenPaise || 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cash Drawer Physical Audit */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Physical Cash Drawer Verification
            </h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Enter Counted Physical Cash in Drawer (₹)
              </label>
              <input
                type="text"
                value={physicalCashInput}
                onChange={(e) => setPhysicalCashInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-base font-bold text-slate-900 font-mono-numeric focus:bg-white focus:border-blue-600"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Expected Drawer Cash:</span>
              <span className="font-mono-numeric font-bold text-slate-900">
                {formatPaiseToRupees(cashExpected)}
              </span>
            </div>

            {/* Discrepancy Notice */}
            <div className={`p-3 rounded-lg border flex items-center justify-between font-bold ${
              cashDiscrepancyPaise === 0n 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : cashDiscrepancyPaise > 0n 
                ? 'bg-blue-50 border-blue-200 text-blue-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span>Drawer Variance / Discrepancy:</span>
              <span className="font-mono-numeric">
                {cashDiscrepancyPaise === 0n ? '₹0.00 (Balanced)' : formatPaiseToRupees(cashDiscrepancyPaise)}
              </span>
            </div>

            <button
              onClick={() => setIsSettled(true)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSettled ? 'Register Reconciled & Closed' : 'Confirm & Close Register for Today'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
