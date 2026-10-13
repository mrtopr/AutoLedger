'use client';

import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  MessageCircle,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Banknote,
  Receipt,
  Building2,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Share2
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';

interface DenominationItem {
  value: number;
  label: string;
  count: number;
}

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  tenant: any;
  user: any;
  summary: any;
  savedSettlement: any;
  denominations: DenominationItem[];
  looseChangeRupees: string;
  openingFloatRupees: string;
  cashExpensesRupees: string;
  retainedFloatRupees: string;
  totalNotesRupees: number;
  totalCountedRupees: number;
  expectedCashPaise: bigint;
  totalCountedPaise: bigint;
  differencePaise: bigint;
  varianceStatus: 'BALANCED' | 'SHORT' | 'EXCESS';
  withdrawnPaise: bigint;
  upiVerified: boolean;
  settlementNotes: string;
  invoices: any[];
}

export default function ZReportModal({
  isOpen,
  onClose,
  date,
  tenant,
  user,
  summary,
  savedSettlement,
  denominations,
  looseChangeRupees,
  openingFloatRupees,
  cashExpensesRupees,
  retainedFloatRupees,
  totalNotesRupees,
  totalCountedRupees,
  expectedCashPaise,
  totalCountedPaise,
  differencePaise,
  varianceStatus,
  withdrawnPaise,
  upiVerified,
  settlementNotes,
  invoices,
}: ZReportModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const showroomName = tenant?.name || 'Apex Trade & Wholesale';
  const showroomLegal = tenant?.legalName || showroomName;
  const showroomAddress = tenant?.address || 'Main Commercial Market, Wholesale Trade Hub';
  const showroomGst = tenant?.gstin || '';
  const showroomPhone = tenant?.phone || '+91 9822100001';
  const showroomEmail = tenant?.email || '';

  const cashierName = user?.name || user?.phone || 'Counter Staff';
  const cashierRole = user?.role || 'OWNER';

  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const generatedTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const openingFloatPaise = BigInt(Math.round((Number(openingFloatRupees) || 0) * 100));
  const cashSalesPaise = BigInt(summary?.cashCollectedPaise || '0');
  const cashExpensesPaise = BigInt(Math.round((Number(cashExpensesRupees) || 0) * 100));
  const upiCollectedPaise = BigInt(summary?.upiCollectedPaise || '0');
  const bankCollectedPaise = BigInt(summary?.bankCollectedPaise || '0');
  const khataGivenPaise = BigInt(summary?.khataGivenPaise || '0');
  const grossSalesPaise = BigInt(summary?.grossSalesPaise || '0');
  const retainedFloatPaise = BigInt(Math.round((Number(retainedFloatRupees) || 0) * 100));

  // High-Resolution Vector Print Engine
  const handlePrint = () => {
    const element = document.getElementById('printable-z-report-document');
    if (!element) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=1050');
    if (!printWindow) {
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Z-Report - Day-End Till Settlement (${date})</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap" />
          <script src="https://cdn.tailwindcss.com"></script>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            html, body {
              background: #FFFFFF !important;
              color: #0F172A !important;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .font-mono-numeric {
              font-family: 'JetBrains Mono', monospace;
              font-variant-numeric: tabular-nums;
            }
            #printable-z-report-document {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body class="bg-white text-slate-900 p-4 sm:p-6">
          <div class="max-w-4xl mx-auto">
            ${element.innerHTML}
          </div>
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 400);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // WhatsApp Day-End Summary Sharing
  const handleWhatsApp = () => {
    const diffSign = varianceStatus === 'BALANCED' ? 'MATCHED' : varianceStatus === 'SHORT' ? 'SHORTAGE' : 'EXCESS';
    const text = `📊 *DAY-END CASH TILL SETTLEMENT (Z-REPORT)*
🏪 *${showroomName}*
📅 Date: ${formattedDate}
⏰ Closed: ${generatedTime} | By: ${cashierName} (${cashierRole})
───────────────────────
💵 *CASH TILL RECONCILIATION:*
• Opening Float: ${formatPaiseToRupees(openingFloatPaise)}
• Cash Sales In: +${formatPaiseToRupees(cashSalesPaise)}
• Petty Expenses Out: -${formatPaiseToRupees(cashExpensesPaise)}
• Expected Drawer Cash: ${formatPaiseToRupees(expectedCashPaise)}
• Physical Counted: ${formatPaiseToRupees(totalCountedPaise)}
• *Variance / Difference: ${diffSign} (${differencePaise === 0n ? '₹0.00' : formatPaiseToRupees(differencePaise)})*

🔢 *BIG NOTES DENOMINATION:*
${denominations.map(d => `• ${d.label}: ${d.count} pcs = ₹${(d.value * d.count).toLocaleString('en-IN')}`).join('\n')}
• Coins & Loose Change: ₹${Number(looseChangeRupees || 0).toLocaleString('en-IN')}

📱 *DIGITAL & BUSINESS SUMMARY:*
• UPI / QR Collections: ${formatPaiseToRupees(upiCollectedPaise)} ${upiVerified ? '(Verified)' : ''}
• Direct Bank Transfer: ${formatPaiseToRupees(bankCollectedPaise)}
• Khata (Udhaari) Given: ${formatPaiseToRupees(khataGivenPaise)}
• Gross Daily Sales: ${formatPaiseToRupees(grossSalesPaise)} (${invoices.length} Bills)

🏦 *CLOSING FLOAT & BANKING:*
• Tomorrow's Opening Float: ${formatPaiseToRupees(retainedFloatPaise)}
• Net Cash Withdrawn for Bank: ${formatPaiseToRupees(withdrawnPaise)}
${settlementNotes ? `\n📝 *Notes:* ${settlementNotes}` : ''}
───────────────────────
✅ *Status: ${savedSettlement ? 'CLOSED & SAVED' : 'TILL RECONCILED'}*
Generated via TradeLedger Dual-Engine ERP`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-100 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col max-h-[94vh]">
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-[#C81E1E] border border-red-500/30 flex items-center justify-center font-bold">
              <Landmark className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Day-End Z-Report Digital Summary</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {date}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Official Cash Till Reconciliation & Audit Document
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 text-emerald-400 text-[11px] font-semibold rounded-lg border border-emerald-800/60">
              🌱 Paperless Digital Report
            </span>

            <button
              onClick={handleWhatsApp}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Share formatted day-end summary on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Summary</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#C81E1E] hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download 1-Page A4 PDF directly"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/80">
          <div
            id="printable-z-report-document"
            className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 sm:p-8 max-w-3xl mx-auto space-y-5 text-slate-900"
          >
            {/* 1. DOCUMENT HEADER */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    {showroomName}
                  </h1>
                  {showroomLegal && showroomLegal !== showroomName && (
                    <div className="text-xs text-slate-600 font-medium">({showroomLegal})</div>
                  )}
                  <div className="text-xs text-slate-600 mt-1 max-w-md leading-relaxed">
                    {showroomAddress}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1 font-mono">
                    {showroomPhone && <span>Phone: {showroomPhone}</span>}
                    {showroomGst && <span>GSTIN: <strong>{showroomGst}</strong></span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-block px-3 py-1 rounded-md bg-slate-900 text-white text-xs font-mono font-black tracking-widest uppercase mb-1.5">
                    Z-REPORT · END OF DAY
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    ID: <strong className="text-slate-800">ZR-{date.replace(/-/g, '')}-01</strong>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Register: <strong className="text-slate-800">Counter #01</strong>
                  </div>
                </div>
              </div>

              {/* Meta details bar */}
              <div className="mt-3.5 pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Settlement Date</span>
                  <span className="font-semibold text-slate-900">{formattedDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Closure Time</span>
                  <span className="font-mono font-semibold text-slate-900">{generatedTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Closed By</span>
                  <span className="font-semibold text-slate-900">{cashierName} ({cashierRole})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Till Audit Status</span>
                  <span className={`inline-block font-mono font-bold text-xs ${
                    varianceStatus === 'BALANCED'
                      ? 'text-emerald-700'
                      : varianceStatus === 'SHORT'
                      ? 'text-red-700'
                      : 'text-blue-700'
                  }`}>
                    ● {varianceStatus === 'BALANCED' ? 'BALANCED' : varianceStatus === 'SHORT' ? 'CASH SHORTAGE' : 'CASH EXCESS'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. AT-A-GLANCE METRICS (4 BOXES) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Gross Business Done</span>
                <span className="text-base font-black font-mono text-slate-900">
                  {formatPaiseToRupees(grossSalesPaise)}
                </span>
                <span className="text-[10px] text-slate-500 block">{invoices.length} Counter Bills</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/50">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">Cash Collected In</span>
                <span className="text-base font-black font-mono text-emerald-900">
                  +{formatPaiseToRupees(cashSalesPaise)}
                </span>
                <span className="text-[10px] text-emerald-700 block">From counter sales</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-rose-50/50">
                <span className="text-[10px] text-rose-800 uppercase font-bold block">Petty Expenses Out</span>
                <span className="text-base font-black font-mono text-rose-900">
                  -{formatPaiseToRupees(cashExpensesPaise)}
                </span>
                <span className="text-[10px] text-rose-700 block">Tea, courier, supplies</span>
              </div>

              <div className="p-2.5 rounded-lg border-2 border-slate-900 bg-slate-900 text-white">
                <span className="text-[10px] text-slate-300 uppercase font-bold block">Counted Till Cash</span>
                <span className="text-base font-black font-mono text-white">
                  {formatPaiseToRupees(totalCountedPaise)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {varianceStatus === 'BALANCED' ? 'Matched 100%' : `Diff: ${differencePaise === 0n ? '₹0.00' : formatPaiseToRupees(differencePaise)}`}
                </span>
              </div>
            </div>

            {/* 3. CASH TILL RECONCILIATION AUDIT MATRIX */}
            <div className="space-y-1.5">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-slate-700" />
                <span>1. Cash Drawer Reconciliation Matrix</span>
              </h2>

              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase">
                  <tr>
                    <th className="py-2 px-3 text-left border-b border-slate-300">Reconciliation Item</th>
                    <th className="py-2 px-3 text-right border-b border-slate-300 w-44">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">Morning Starting Cash (Opening Float)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {formatPaiseToRupees(openingFloatPaise)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">(+) Counter Cash Sales Collected</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-700">
                      +{formatPaiseToRupees(cashSalesPaise)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">(-) Petty Cash Expenses Paid from Drawer</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold text-rose-700">
                      -{formatPaiseToRupees(cashExpensesPaise)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="py-2 px-3 text-slate-900">Expected Physical Cash in Drawer (Float + In - Out)</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-sm">
                      {formatPaiseToRupees(expectedCashPaise)}
                    </td>
                  </tr>
                  <tr className="bg-slate-100/70 font-bold">
                    <td className="py-2 px-3 text-slate-900">Actual Counted Physical Cash (Denominations + Coins)</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-sm">
                      {formatPaiseToRupees(totalCountedPaise)}
                    </td>
                  </tr>
                  <tr className={varianceStatus === 'BALANCED' ? 'bg-emerald-50/60 font-black' : 'bg-rose-50/60 font-black'}>
                    <td className="py-2 px-3 text-slate-900 flex items-center justify-between">
                      <span>Audit Variance (Counted vs Expected)</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                        {varianceStatus === 'BALANCED' ? 'Till Reconciled & Balanced' : varianceStatus === 'SHORT' ? 'Cash Shortage' : 'Cash Excess'}
                      </span>
                    </td>
                    <td className={`py-2 px-3 text-right font-mono text-sm ${
                      varianceStatus === 'BALANCED' ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {differencePaise === 0n ? '₹0.00' : formatPaiseToRupees(differencePaise)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. DENOMINATION TALLY (BIG NOTES ONLY) & DIGITAL SUMMARY (2 COLS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: Denominations */}
              <div className="space-y-1.5">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-700" />
                  <span>2. Big Notes Denomination Count</span>
                </h2>

                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-1.5 px-2.5 text-left border-b border-slate-300">Note</th>
                      <th className="py-1.5 px-2 text-center border-b border-slate-300 w-20">Pieces</th>
                      <th className="py-1.5 px-2.5 text-right border-b border-slate-300 w-24">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {denominations.map((denom) => (
                      <tr key={denom.value}>
                        <td className="py-1.5 px-2.5 font-bold font-mono text-slate-800">{denom.label}</td>
                        <td className="py-1.5 px-2 text-center font-mono font-semibold">{denom.count}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{(denom.value * denom.count).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} className="py-1.5 px-2.5 text-slate-600 font-medium">
                        Coins & Loose Change
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                        ₹{Number(looseChangeRupees || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t border-slate-300">
                      <td className="py-1.5 px-2.5 uppercase text-[10px]">Total Physical</td>
                      <td className="py-1.5 px-2 text-center font-mono">{denominations.reduce((sum, d) => sum + d.count, 0)} pcs</td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-slate-900">
                        ₹{totalCountedRupees.toLocaleString('en-IN')}.00
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Right: Digital Collections & Float Rollover */}
              <div className="space-y-3">
                {/* Digital Breakdown */}
                <div className="space-y-1.5">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                    <span>3. Digital Collections & Khata</span>
                  </h2>

                  <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">UPI / QR Counter Sales:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatPaiseToRupees(upiCollectedPaise)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>Soundbox / Bank Status:</span>
                      <span className={upiVerified ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                        {upiVerified ? '✓ Verified in Bank' : 'Unverified'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-1">
                      <span className="text-slate-600">Direct Bank Transfer:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatPaiseToRupees(bankCollectedPaise)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-1">
                      <span className="text-amber-800 font-medium">Khata Credit Extended:</span>
                      <span className="font-mono font-bold text-amber-900">
                        {formatPaiseToRupees(khataGivenPaise)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Closing Allocation */}
                <div className="space-y-1.5">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-slate-700" />
                    <span>4. Drawer Rollover & Banking</span>
                  </h2>

                  <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 space-y-1 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700 font-sans text-xs">Retain for Tomorrow Float:</span>
                      <span className="font-bold text-slate-900">
                        {formatPaiseToRupees(retainedFloatPaise)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-1">
                      <span className="text-slate-700 font-sans text-xs font-bold text-emerald-800">
                        Cash for Bank Deposit:
                      </span>
                      <span className="font-black text-emerald-900 text-sm">
                        {formatPaiseToRupees(withdrawnPaise)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. NOTES (IF ANY) */}
            {settlementNotes && (
              <div className="p-2.5 rounded-lg border border-slate-300 bg-amber-50/50 text-xs">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Cashier / Closing Notes:</span>
                <span className="text-slate-700">{settlementNotes}</span>
              </div>
            )}

            {/* 6. BILLS AUDIT TABLE (CONDENSED) */}
            {invoices.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    5. Counter Bills Issued Today ({invoices.length} Bills)
                  </h2>
                  <span className="text-[10px] font-mono font-bold text-slate-600">
                    Total: {formatPaiseToRupees(grossSalesPaise)}
                  </span>
                </div>

                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                      <tr>
                        <th className="py-1 px-2 w-8 text-center">#</th>
                        <th className="py-1 px-2">Bill No</th>
                        <th className="py-1 px-2">Customer / Client</th>
                        <th className="py-1 px-2 text-right">Bill Total</th>
                        <th className="py-1 px-2 text-right">Paid Now</th>
                        <th className="py-1 px-2 text-right">Khata Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {invoices.map((inv, idx) => (
                        <tr key={inv.id || idx}>
                          <td className="py-1 px-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-1 px-2 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                          <td className="py-1 px-2 text-slate-800 truncate max-w-[140px]">{inv.customerShop || inv.customerName}</td>
                          <td className="py-1 px-2 text-right font-mono font-semibold">
                            {formatPaiseToRupees(BigInt(inv.grandTotalPaise || '0'))}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-emerald-700 font-semibold">
                            {formatPaiseToRupees(BigInt(inv.paidNowPaise || '0'))}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-amber-800">
                            {BigInt(inv.creditBalancePaise || '0') > 0n ? formatPaiseToRupees(BigInt(inv.creditBalancePaise)) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. DUAL SIGNATURE SIGN-OFF & CERTIFICATION */}
            <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
              <div className="text-center space-y-6">
                <div className="h-8 border-b border-dashed border-slate-400"></div>
                <div>
                  <div className="font-bold text-slate-900">Cashier / Counter Staff Signature</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{cashierName} · {generatedTime}</div>
                </div>
              </div>

              <div className="text-center space-y-6">
                <div className="h-8 border-b border-dashed border-slate-400"></div>
                <div>
                  <div className="font-bold text-slate-900">Store Owner / Manager Approval</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Verified & Signed Off</div>
                </div>
              </div>
            </div>

            {/* Footer watermark */}
            <div className="text-center text-[9px] text-slate-400 font-mono pt-2 border-t border-slate-100">
              Generated via TradeLedger Dual-Engine ERP · 100% Digital Audit Trail · Tamper-evident Local & Cloud Ledger
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
