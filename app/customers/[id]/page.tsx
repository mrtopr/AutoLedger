'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Receipt, 
  CreditCard, 
  Phone, 
  MapPin, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';

interface LedgerItem {
  id: string;
  date: string;
  type: string;
  refNo: string;
  narration: string;
  debitPaise: string;
  creditPaise: string;
  runningBalancePaise: string;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'INVOICES' | 'REMINDERS'>('LEDGER');

  // Payment modal state
  const [isPaymentModal, setIsPaymentModal] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('5000.00');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [paymentRef, setPaymentRef] = useState<string>('UPI/392019481023');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/customers/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          setCustomer(data.customer);
        }
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
  }, [params.id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount) return;

    try {
      setSubmittingPayment(true);
      const amtPaise = parseRupeesToPaise(paymentAmount);

      const res = await fetch(`/api/v1/customers/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: amtPaise.toString(),
          mode: paymentMode,
          referenceNumber: paymentRef,
        }),
      });

      if (res.ok) {
        setIsPaymentModal(false);
        fetchCustomerDetail();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading && !customer) {
    return (
      <div className="py-20 text-center text-slate-500 font-medium">
        Loading customer khata ledger...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-20 text-center text-rose-500 font-medium">
        Customer account not found.
      </div>
    );
  }

  const ledger: LedgerItem[] = customer.ledger || [];
  const aging = customer.aging || {
    current: customer.balancePaise,
    days31to60: '0',
    days61to90: '0',
    days90Plus: '0',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back link & Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Customers</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaymentModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment (Jama)</span>
          </button>
          <Link
            href="/pos"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>New Bill (F2)</span>
          </Link>
        </div>
      </div>

      {/* Profile & Khata Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{customer.shopName}</h1>
              <div className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold">
                {customer.status} HEALTH
              </div>
            </div>
            <div className="text-sm text-slate-600 mt-1">Proprietor: <span className="font-semibold text-slate-800">{customer.name}</span></div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3 font-mono">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {customer.phone}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-sans">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {customer.address}
              </span>
              <span>•</span>
              <span>GSTIN: {customer.gstin || 'Unregistered'}</span>
            </div>
          </div>

          {/* Balance & Limit Box */}
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="text-right">
              <div className="text-xs text-slate-600 font-semibold">Current Khata Balance (Baaki)</div>
              <div className="text-2xl font-black text-slate-900 font-mono-numeric mt-0.5">
                {formatPaiseToRupees(BigInt(customer.balancePaise || 0))}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                Credit Limit: {formatPaiseToRupees(BigInt(customer.creditLimitPaise || 5000000))} ({customer.termsDays}d terms)
              </div>
            </div>
          </div>
        </div>

        {/* Aging Buckets Strip */}
        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono-numeric">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase text-slate-500 font-bold font-sans">0-30 Days (Current)</div>
            <div className="text-sm font-bold text-slate-900 mt-1">{formatPaiseToRupees(BigInt(aging.current || 0))}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase text-slate-500 font-bold font-sans">31-60 Days</div>
            <div className="text-sm font-bold text-slate-900 mt-1">{formatPaiseToRupees(BigInt(aging.days31to60 || 0))}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase text-slate-500 font-bold font-sans">61-90 Days</div>
            <div className="text-sm font-bold text-slate-900 mt-1">{formatPaiseToRupees(BigInt(aging.days61to90 || 0))}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase text-slate-500 font-bold font-sans">90+ Days</div>
            <div className="text-sm font-bold text-slate-900 mt-1">{formatPaiseToRupees(BigInt(aging.days90Plus || 0))}</div>
          </div>
        </div>
      </div>

      {/* Tabs (Ledger / Invoices / Reminders) */}
      <div className="border-b border-slate-200 flex items-center space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-3 font-semibold border-b-2 transition ${
            activeTab === 'LEDGER' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Append-Only Khata Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-3 font-semibold border-b-2 transition ${
            activeTab === 'INVOICES' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Invoices & Bills
        </button>
        <button
          onClick={() => setActiveTab('REMINDERS')}
          className={`pb-3 font-semibold border-b-2 transition ${
            activeTab === 'REMINDERS' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          WhatsApp Messages & Reminders
        </button>
      </div>

      {/* Live Ledger Table */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Chronological Debit / Credit Running Ledger
            </h3>
            <span className="text-xs text-slate-500 font-mono">Immutable Double-Entry Entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-3 w-28">Type</th>
                  <th className="py-3 px-3 w-40">Reference No.</th>
                  <th className="py-3 px-4">Narration / Description</th>
                  <th className="py-3 px-4 w-32 text-right">Debit / Billed (₹)</th>
                  <th className="py-3 px-4 w-32 text-right">Credit / Paid (₹)</th>
                  <th className="py-3 px-4 w-36 text-right">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-mono-numeric">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No ledger entries yet.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-slate-600">{entry.date}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          entry.type === 'INVOICE' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-800 font-bold">{entry.refNo}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-sans">{entry.narration}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                        {BigInt(entry.debitPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.debitPaise)) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                        {BigInt(entry.creditPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.creditPaise)) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                        {formatPaiseToRupees(BigInt(entry.runningBalancePaise || 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Record Payment (Jama Entry)
              </h3>
              <button
                onClick={() => setIsPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Customer Account</label>
                <div className="font-semibold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {customer.shopName} ({customer.name})
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Payment Amount (₹)</label>
                <input
                  type="text"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-base font-bold text-slate-900 font-mono-numeric focus:bg-white focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium"
                  >
                    <option value="UPI">UPI / PhonePe / GPay</option>
                    <option value="CASH">Cash at Counter</option>
                    <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Reference / UTR</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. 40291048291"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition disabled:opacity-50"
                >
                  {submittingPayment ? 'Saving Entry...' : 'Confirm & Add to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
