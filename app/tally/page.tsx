'use client';

import React, { useState } from 'react';
import { RefreshCw, Download, CheckCircle2, FileCode, Clock } from 'lucide-react';

export default function TallySyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSynced(true);
    }, 1200);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#172033]">
            Tally Prime & ERP XML Sync
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] mt-0.5">
            Export ledger vouchers, sales journals, and inventory ledgers into Tally Prime
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1570EF] hover:bg-[#175CD3] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing with Tally...' : 'Sync Now'}</span>
        </button>
      </div>

      {synced && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Sync completed successfully! 14 vouchers validated and ready for Tally import.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">Last Sync Timestamp</div>
          <div className="text-sm font-bold text-[#172033] mt-1.5 font-mono">
            {new Date().toLocaleTimeString()} (Today)
          </div>
        </div>
        <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">Pending Vouchers</div>
          <div className="text-xl font-bold text-emerald-600 font-mono mt-1">
            0 Pending
          </div>
        </div>
        <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">Tally Company</div>
          <div className="text-sm font-bold text-[#172033] mt-1.5">
            Rishi Showroom (2026-27)
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
          Export XML Files for Offline Import
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button className="p-3.5 border border-[#E4E7EC] hover:border-blue-300 rounded-xl flex items-center justify-between text-left group bg-slate-50/50">
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-xs font-bold text-[#172033]">Sales Daybook XML</div>
                <div className="text-[11px] text-[#667085]">Daily invoices & tax breakdown</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </button>

          <button className="p-3.5 border border-[#E4E7EC] hover:border-blue-300 rounded-xl flex items-center justify-between text-left group bg-slate-50/50">
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-xs font-bold text-[#172033]">Khata Payment Receipts XML</div>
                <div className="text-[11px] text-[#667085]">Bank & Cash voucher entries</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
