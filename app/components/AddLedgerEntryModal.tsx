'use client';

import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileText, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft,
  Save
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import ModernLoader from './ModernLoader';
import ClientPortal from './ClientPortal';

interface AddLedgerEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: {
    id: string;
    name: string;
    shopName: string;
    phone: string;
    balancePaise: string;
  };
}

export default function AddLedgerEntryModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
}: AddLedgerEntryModalProps) {
  const [entryType, setEntryType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [amountRupees, setAmountRupees] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState('');
  const [narration, setNarration] = useState('Previous register ledger balance');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBal = BigInt(customer.balancePaise || 0);
  const enteredPaise = parseRupeesToPaise(amountRupees || '0');
  const previewBal = entryType === 'DEBIT' ? currentBal + enteredPaise : currentBal - enteredPaise;

  const commonPresets = [
    'Previous register ledger balance',
    'Manual Udhar slip from counter',
    'Opening balance adjustment',
    'Advance cash deposit',
    'Direct UPI settlement transfer',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = parseRupeesToPaise(amountRupees);
    if (parsed <= 0n) {
      setErrorMsg('Please enter a valid amount greater than ₹0.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/customers/${customer.id}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: entryType,
          amountPaise: parsed.toString(),
          date,
          refNo: refNo.trim() || undefined,
          narration: narration.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to record ledger entry.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Add Manual Udhar / Ledger Entry
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {customer.shopName || customer.name} · {customer.phone}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            
            {/* Type Switcher */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Transaction Entry Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEntryType('DEBIT');
                    setNarration('Previous register ledger balance');
                  }}
                  className={`h-10 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    entryType === 'DEBIT'
                      ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-red-600" />
                  <span>🔴 Add Udhar / Debit (You will Receive)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEntryType('CREDIT');
                    setNarration('Advance cash deposit');
                  }}
                  className={`h-10 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    entryType === 'CREDIT'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  <span>🟢 Add Advance / Credit (You Received)</span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="e.g. 4500.00"
                  className="w-full h-10 pl-8 pr-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-none"
                />
              </div>
            </div>

            {/* Date & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Slip / Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="e.g. REG-BOOK-42"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-none"
                />
              </div>
            </div>

            {/* Narration / Reason */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Narration / Notes *
              </label>
              <input
                type="text"
                required
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="e.g. Previous register balance before software setup"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-none"
              />

              {/* Quick Preset Badges */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {commonPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNarration(p)}
                    className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Balance Preview Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Current Balance:</span>
                <div className="font-mono font-bold text-slate-700">
                  {formatPaiseToRupees(currentBal)} {currentBal > 0n ? 'Dr (Due)' : currentBal < 0n ? 'Cr (Advance)' : 'NIL'}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500">New Resulting Balance:</span>
                <div className={`font-mono font-bold text-sm ${
                  previewBal > 0n ? 'text-red-600' : previewBal < 0n ? 'text-emerald-600' : 'text-slate-900'
                }`}>
                  {formatPaiseToRupees(previewBal)} {previewBal > 0n ? 'Dr (Due)' : previewBal < 0n ? 'Cr (Advance)' : 'NIL'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-9 bg-[#C81E1E] hover:bg-[#A81818] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <ModernLoader size="xs" />
                    <span>Saving Entry...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Confirm & Post Entry</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>
      </div>
    </ClientPortal>
  );
}
