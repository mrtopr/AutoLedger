'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  DollarSign, 
  Users, 
  HelpCircle,
  Save,
  Search,
  Sparkles
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import ModernLoader from './ModernLoader';
import ClientPortal from './ClientPortal';

interface CustomerItem {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  balancePaise: string;
}

interface BulkRow {
  key: string;
  customerId: string;
  shopName: string;
  name: string;
  phone: string;
  amountRupees: string;
  type: 'DUE' | 'ADVANCE';
  date: string;
  narration: string;
  isExisting: boolean;
}

interface BulkOpeningBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingCustomers: CustomerItem[];
}

export default function BulkOpeningBalanceModal({
  isOpen,
  onClose,
  onSuccess,
  existingCustomers,
}: BulkOpeningBalanceModalProps) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Initialize rows when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      
      // Prepopulate with existing customers
      const initialRows: BulkRow[] = existingCustomers.map((c) => ({
        key: `exist-${c.id}`,
        customerId: c.id,
        shopName: c.shopName || c.name,
        name: c.name || c.shopName,
        phone: c.phone || '',
        amountRupees: '',
        type: 'DUE',
        date: todayStr,
        narration: 'Previous register ledger migration',
        isExisting: true,
      }));

      // If no customers, add 2 blank rows
      if (initialRows.length === 0) {
        initialRows.push(
          {
            key: `new-${Date.now()}-1`,
            customerId: '',
            shopName: '',
            name: '',
            phone: '',
            amountRupees: '',
            type: 'DUE',
            date: todayStr,
            narration: 'Opening balance migration',
            isExisting: false,
          },
          {
            key: `new-${Date.now()}-2`,
            customerId: '',
            shopName: '',
            name: '',
            phone: '',
            amountRupees: '',
            type: 'DUE',
            date: todayStr,
            narration: 'Opening balance migration',
            isExisting: false,
          }
        );
      }

      setRows(initialRows);
    }
  }, [isOpen, existingCustomers]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        customerId: '',
        shopName: '',
        name: '',
        phone: '',
        amountRupees: '',
        type: 'DUE',
        date: todayStr,
        narration: 'Opening balance migration',
        isExisting: false,
      },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    setRows(rows.filter((r) => r.key !== key));
  };

  const handleRowChange = (key: string, field: keyof BulkRow, value: any) => {
    setRows(
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  // Calculate live summary
  const activeEntries = rows.filter((r) => {
    const amt = parseFloat(r.amountRupees || '0');
    return amt > 0 && (r.customerId || (r.shopName && r.phone));
  });

  const totalDuePaise = activeEntries
    .filter((r) => r.type === 'DUE')
    .reduce((sum, r) => sum + parseRupeesToPaise(r.amountRupees), 0n);

  const totalAdvancePaise = activeEntries
    .filter((r) => r.type === 'ADVANCE')
    .reduce((sum, r) => sum + parseRupeesToPaise(r.amountRupees), 0n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (activeEntries.length === 0) {
      setErrorMsg('Please enter an amount (> ₹0) for at least one customer account.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        entries: activeEntries.map((r) => ({
          customerId: r.customerId || undefined,
          shopName: r.shopName.trim(),
          name: r.name.trim() || r.shopName.trim(),
          phone: r.phone.trim(),
          amountPaise: parseRupeesToPaise(r.amountRupees).toString(),
          type: r.type,
          date: r.date,
          narration: r.narration.trim() || undefined,
        })),
      };

      const res = await fetch('/api/v1/customers/bulk-opening-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save opening balances.');
        return;
      }

      setSuccessMsg(`Successfully applied balances for ${activeEntries.length} accounts!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      r.shopName.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q)
    );
  });

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Batch Opening Balances & Previous Udhar Onboarding
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-400/30">
                    Quick Setup
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Input previous register book debts (Udhar) or advance deposits for multiple customers at once.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action & Filter Toolbar */}
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search customers in table..."
                className="w-full h-8 pl-8 pr-3 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#C81E1E]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="h-8 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#C81E1E]" />
                <span>+ Add New Customer Row</span>
              </button>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-2.5 px-3 min-w-[180px]">Customer / Business Name</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Mobile Phone</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Balance Type</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Amount (₹)</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Date</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Narration / Reason</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No matching rows found. Click &quot;+ Add New Customer Row&quot; above to enter records.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                      {/* Shop / Customer Name */}
                      <td className="py-2 px-3">
                        {row.isExisting ? (
                          <div className="font-semibold text-slate-900">
                            {row.shopName}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Registered Account
                            </span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.shopName}
                            onChange={(e) => handleRowChange(row.key, 'shopName', e.target.value)}
                            placeholder="e.g. Metro Spares"
                            className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:border-[#C81E1E] focus:outline-none"
                          />
                        )}
                      </td>

                      {/* Phone Number */}
                      <td className="py-2 px-3">
                        {row.isExisting ? (
                          <span className="font-mono text-slate-600">{row.phone || '—'}</span>
                        ) : (
                          <input
                            type="tel"
                            maxLength={10}
                            value={row.phone}
                            onChange={(e) =>
                              handleRowChange(
                                row.key,
                                'phone',
                                e.target.value.replace(/[^0-9]/g, '')
                              )
                            }
                            placeholder="9822012345"
                            className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 focus:border-[#C81E1E] focus:outline-none"
                          />
                        )}
                      </td>

                      {/* Type Toggle: DUE vs ADVANCE */}
                      <td className="py-2 px-3">
                        <select
                          value={row.type}
                          onChange={(e) =>
                            handleRowChange(row.key, 'type', e.target.value as 'DUE' | 'ADVANCE')
                          }
                          className={`w-full h-8 px-2 rounded-md text-xs font-bold border transition ${
                            row.type === 'DUE'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="DUE">🔴 Customer Owes (Udhar)</option>
                          <option value="ADVANCE">🟢 Advance Deposit (Credit)</option>
                        </select>
                      </td>

                      {/* Amount Input */}
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amountRupees}
                            onChange={(e) => handleRowChange(row.key, 'amountRupees', e.target.value)}
                            placeholder="0.00"
                            className="w-full h-8 pl-6 pr-2 bg-white border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-900 focus:border-[#C81E1E] focus:outline-none text-right"
                          />
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => handleRowChange(row.key, 'date', e.target.value)}
                          className="w-full h-8 px-2 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-700 focus:border-[#C81E1E] focus:outline-none"
                        />
                      </td>

                      {/* Narration */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.narration}
                          onChange={(e) => handleRowChange(row.key, 'narration', e.target.value)}
                          placeholder="e.g. Old paper register page 42"
                          className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:border-[#C81E1E] focus:outline-none"
                        />
                      </td>

                      {/* Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.key)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Summary & Action */}
          <div className="p-4 bg-slate-900 text-white border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Live Metrics */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Total Accounts to Update:</span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                  {activeEntries.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-red-400">Total Previous Udhar (Receivable):</span>
                <span className="font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                  {formatPaiseToRupees(totalDuePaise)}
                </span>
              </div>

              {totalAdvancePaise > 0n && (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400">Total Advances (Credit):</span>
                  <span className="font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    {formatPaiseToRupees(totalAdvancePaise)}
                  </span>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || activeEntries.length === 0}
                className="h-9 px-6 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <ModernLoader size="xs" />
                    <span>Applying Balances...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save All {activeEntries.length} Balances</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      </div>
    </ClientPortal>
  );
}
