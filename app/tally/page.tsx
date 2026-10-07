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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                Tally Prime & ERP XML Sync
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                v9.0 XML
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Export ledger vouchers, sales journals, and inventory ledgers into Tally Prime
            </p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="h-8 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-semibold rounded-md shadow-2xs transition inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing with Tally...' : 'Sync Now'}</span>
        </button>
      </div>

      {synced && (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-xs text-[#15803D] flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>Sync completed successfully! 14 vouchers validated and ready for Tally import.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Last Sync Timestamp</div>
          <div className="text-sm font-bold text-[#0F172A] mt-1 font-mono">
            {new Date().toLocaleTimeString()} (Today)
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Pending Vouchers</div>
          <div className="text-xl font-bold text-[#16A34A] font-mono mt-1">
            0 Pending
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Tally Company</div>
          <div className="text-sm font-semibold text-[#0F172A] mt-1">
            Rishi Showroom (2026-27)
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs space-y-3.5">
        <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
          Export XML Files for Offline Import
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button className="p-3.5 border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-md flex items-center justify-between text-left group bg-[#F8F9FA] transition">
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-[#2563EB]" />
              <div>
                <div className="text-xs font-semibold text-[#0F172A]">Sales Daybook XML</div>
                <div className="text-[11px] text-[#64748B]">Daily invoices & tax breakdown</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-[#64748B] group-hover:text-[#2563EB]" />
          </button>

          <button className="p-3.5 border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-md flex items-center justify-between text-left group bg-[#F8F9FA] transition">
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-[#16A34A]" />
              <div>
                <div className="text-xs font-semibold text-[#0F172A]">Khata Payment Receipts XML</div>
                <div className="text-[11px] text-[#64748B]">Bank & Cash voucher entries</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-[#64748B] group-hover:text-[#16A34A]" />
          </button>
        </div>
      </div>
    </div>
  );
}
