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
  Split, 
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Lock
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
      <div className="py-20 text-center space-y-3 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-md bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto border border-[#FECACA]">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h2 className="text-sm font-semibold text-[#0F172A]">Manager & Owner Authorization Required</h2>
        <p className="text-xs text-[#64748B]">
          Day-end cash counter settlement and gross profit analytics are restricted to authorized operators.
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

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-[#64748B] text-xs font-mono">
        Calculating day-end drawer totals and margin telemetry...
      </div>
    );
  }

  const cashExpected = BigInt(data?.cashCollectedPaise || 0);
  const physicalCashPaise = BigInt(Math.round(parseFloat(physicalCashInput || '0') * 100));
  const cashDiscrepancyPaise = physicalCashPaise - cashExpected;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] font-mono">
              EOD RECONCILIATION
            </span>
            <span className="text-xs text-[#64748B] font-mono">Date: {data?.date}</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A] flex items-center gap-2 mt-1">
            <div className="w-7 h-7 rounded-md bg-red-50 text-[#C81E1E] flex items-center justify-center border border-red-100 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <span>Day-End Cash & Margin Reconciliation</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-1 pl-9">
            Audit today's physical cash drawer, UPI settlements, new credit extended, and wholesale margins.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="h-8 px-3 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] text-xs font-semibold rounded-md border border-[#CBD5E1] transition inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Print EOD Summary</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Billed */}
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs">
          <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">Total Invoiced Sales</span>
          <div className="mt-1 text-xl font-bold text-[#0F172A] font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(data?.totalBilledPaise || 0))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">{data?.invoiceCount} bills issued today</div>
        </div>

        {/* Total Collected */}
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs">
          <span className="text-[11px] font-medium text-[#16A34A] uppercase tracking-wider block">Total Collections Received</span>
          <div className="mt-1 text-xl font-bold text-[#16A34A] font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(data?.totalCollectedPaise || 0))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">Cash + UPI payments recorded</div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#0F172A] uppercase tracking-wider">Gross Margin</span>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
              {data?.marginPercent}% Margin
            </span>
          </div>
          <div className="mt-1 text-xl font-bold text-[#0F172A] font-mono tabular-nums">
            {formatPaiseToRupees(BigInt(data?.grossProfitPaise || 0))}
          </div>
          <div className="mt-0.5 text-[11px] text-[#64748B]">COGS: {formatPaiseToRupees(BigInt(data?.totalCogsPaise || 0))}</div>
        </div>
      </div>

      {/* Main Reconciliation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Collections Breakdown */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-4.5 space-y-3.5 shadow-2xs">
          <div className="border-b border-[#E2E8F0] pb-2.5">
            <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <Split className="w-3.5 h-3.5 text-[#C81E1E]" />
              Counter Collection Channels Breakdown
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#F8F9FA] rounded-md border border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                <span className="font-medium text-[#334155]">Cash Received at Register:</span>
              </div>
              <span className="font-mono font-bold text-[#0F172A] tabular-nums">
                {formatPaiseToRupees(BigInt(data?.cashCollectedPaise || 0))}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#F8F9FA] rounded-md border border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <span className="font-medium text-[#334155]">UPI / QR Bank Credits:</span>
              </div>
              <span className="font-mono font-bold text-[#0F172A] tabular-nums">
                {formatPaiseToRupees(BigInt(data?.upiCollectedPaise || 0))}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#FEFCE8] rounded-md border border-[#FEF08A]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#D97706]" />
                <span className="font-medium text-[#92400E]">New Credit (Udhaar) Extended:</span>
              </div>
              <span className="font-mono font-bold text-[#92400E] tabular-nums">
                {formatPaiseToRupees(BigInt(data?.newUdhaarGivenPaise || 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cash Drawer Physical Audit */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-4.5 space-y-3.5 shadow-2xs">
          <div className="border-b border-[#E2E8F0] pb-2.5">
            <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
              Physical Cash Drawer Verification
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#475569] font-medium mb-1">
                Enter Counted Physical Cash in Drawer (₹)
              </label>
              <input
                type="text"
                value={physicalCashInput}
                onChange={(e) => setPhysicalCashInput(e.target.value)}
                className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg text-sm font-bold font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
              />
            </div>

            <div className="p-2.5 sm:p-3 bg-[#F8F9FA] rounded-lg border border-[#E2E8F0] flex items-center justify-between">
              <span className="text-[#64748B] font-medium">Expected Drawer Cash:</span>
              <span className="font-mono font-bold text-[#0F172A] tabular-nums">
                {formatPaiseToRupees(cashExpected)}
              </span>
            </div>

            {/* Discrepancy Notice */}
            <div className={`p-2.5 sm:p-3 rounded-lg border flex items-center justify-between text-xs font-semibold ${
              cashDiscrepancyPaise === 0n 
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]' 
                : cashDiscrepancyPaise > 0n 
                ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]' 
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
            }`}>
              <span>Drawer Variance / Discrepancy:</span>
              <span className="font-mono tabular-nums">
                {cashDiscrepancyPaise === 0n ? '₹0.00 (Balanced)' : formatPaiseToRupees(cashDiscrepancyPaise)}
              </span>
            </div>

            <button
              onClick={() => setIsSettled(true)}
              className="w-full h-9 bg-[#0F172A] hover:bg-[#1E293B] text-white font-medium rounded-lg text-xs shadow-2xs transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSettled ? 'Register Reconciled & Closed for Today' : 'Confirm & Close Register for Today'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
