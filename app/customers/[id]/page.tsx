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
  AlertCircle,
  Zap,
  Clock,
  Printer,
  FileText,
  Edit3
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import RazorpayModal from '@/app/components/RazorpayModal';
import ClientPortal from '@/app/components/ClientPortal';
import EditCustomerModal from '@/app/components/EditCustomerModal';

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

  // Edit customer modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Payment modal state
  const [isPaymentModal, setIsPaymentModal] = useState<boolean>(false);
  const [isRazorpayModal, setIsRazorpayModal] = useState<boolean>(false);
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
      <div className="py-20 text-center text-[#64748B] text-xs font-mono">
        Loading customer double-entry ledger...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-20 text-center text-[#DC2626] text-xs">
        Customer account not found in registry.
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

  const rawBalance = BigInt(customer.balancePaise || 0);
  const isAdvance = rawBalance < 0n;
  const isDue = rawBalance > 0n;
  const absBalance = isAdvance ? -rawBalance : rawBalance;
  const creditLimit = BigInt(customer.creditLimitPaise || 5000000);
  const utilizationPct = creditLimit > 0n && isDue ? Math.min(100, Math.round(Number((rawBalance * 100n) / creditLimit))) : 0;

  const currentAging = isDue ? BigInt(aging.current || 0) : 0n;
  const days31to60 = isDue ? BigInt(aging.days31to60 || 0) : 0n;
  const days61to90 = isDue ? BigInt(aging.days61to90 || 0) : 0n;
  const days90Plus = isDue ? BigInt(aging.days90Plus || 0) : 0n;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-lg px-4 py-2.5 shadow-2xs">
        <Link
          href="/customers"
          className="text-xs text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1.5 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Khata Directory</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-md border border-slate-300 transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Customer</span>
          </button>
          <button
            onClick={() => setIsRazorpayModal(true)}
            className="h-8 px-3 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#15803D] font-semibold text-xs rounded-md border border-[#86EFAC] transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Send Payment Link / QR</span>
          </button>
          <button
            onClick={() => setIsPaymentModal(true)}
            className="h-8 px-3 bg-[#0F172A] hover:bg-[#1E293B] text-white font-medium text-xs rounded-md transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment (Jama)</span>
          </button>
          <Link
            href={`/pos?customerId=${customer.id}`}
            className="h-8 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-md transition inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>New Bill (F2)</span>
          </Link>
        </div>
      </div>

      {/* Account Master Summary Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">{customer.shopName}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                customer.status === 'GREEN' 
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' 
                  : customer.status === 'YELLOW' 
                  ? 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]' 
                  : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  customer.status === 'GREEN' ? 'bg-[#16A34A]' : customer.status === 'YELLOW' ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                }`} />
                {customer.status} HEALTH
              </span>
            </div>
            <div className="text-xs text-[#475569] mt-0.5">
              Proprietor: <span className="font-semibold text-[#0F172A]">{customer.name}</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] mt-2 font-mono">
              <span className="flex items-center gap-1 text-[#0F172A]">
                <Phone className="w-3 h-3 text-[#94A3B8]" />
                {customer.phone}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-sans text-[#475569]">
                <MapPin className="w-3 h-3 text-[#94A3B8]" />
                {customer.address}
              </span>
              <span>•</span>
              <span>GSTIN: {customer.gstin || 'URP (Unregistered)'}</span>
            </div>
          </div>

          {/* Balance & Limit Box */}
          <div className="flex items-center gap-4 bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isAdvance 
                    ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]' 
                    : isDue 
                    ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]' 
                    : 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]'
                }`}>
                  {isAdvance ? 'ADVANCE (JAMA)' : isDue ? 'OUTSTANDING (BAAKI)' : 'SETTLED (CHUKTA)'}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
                  {isAdvance ? 'Advance Credit' : 'Khata Balance'}
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono tabular-nums ${
                isAdvance ? 'text-[#15803D]' : isDue ? 'text-[#DC2626]' : 'text-[#0F172A]'
              }`}>
                {formatPaiseToRupees(absBalance)} {isAdvance && <span className="text-xs font-bold text-[#16A34A] font-sans">(Cr)</span>}
              </div>
              <div className="text-[11px] text-[#64748B] font-mono mt-1">
                Limit: {formatPaiseToRupees(creditLimit)} ({customer.termsDays}d terms) • {isAdvance ? <span className="text-[#15803D] font-semibold">0% used (Advance Credit)</span> : <span>{utilizationPct}% limit used</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Aging Buckets Strip */}
        <div className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
          <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
            <div className="text-[10px] uppercase text-[#64748B] font-semibold">0-30 Days (Current)</div>
            <div className="text-xs font-bold font-mono text-[#0F172A] mt-1 tabular-nums">
              {formatPaiseToRupees(currentAging)}
            </div>
          </div>
          <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
            <div className="text-[10px] uppercase text-[#64748B] font-semibold">31-60 Days</div>
            <div className="text-xs font-bold font-mono text-[#0F172A] mt-1 tabular-nums">
              {formatPaiseToRupees(days31to60)}
            </div>
          </div>
          <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
            <div className="text-[10px] uppercase text-[#64748B] font-semibold">61-90 Days</div>
            <div className="text-xs font-bold font-mono text-[#D97706] mt-1 tabular-nums">
              {formatPaiseToRupees(days61to90)}
            </div>
          </div>
          <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
            <div className="text-[10px] uppercase text-[#64748B] font-semibold">90+ Days (Critical)</div>
            <div className="text-xs font-bold font-mono text-[#DC2626] mt-1 tabular-nums">
              {formatPaiseToRupees(days90Plus)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E2E8F0] flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-2.5 font-medium border-b-2 transition ${
            activeTab === 'LEDGER' ? 'border-[#C81E1E] text-[#C81E1E] font-semibold' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          Append-Only Khata Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-2.5 font-medium border-b-2 transition ${
            activeTab === 'INVOICES' ? 'border-[#C81E1E] text-[#C81E1E] font-semibold' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          Billed Invoices History
        </button>
        <button
          onClick={() => setActiveTab('REMINDERS')}
          className={`pb-2.5 font-medium border-b-2 transition ${
            activeTab === 'REMINDERS' ? 'border-[#C81E1E] text-[#C81E1E] font-semibold' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          WhatsApp Payment Reminders
        </button>
      </div>

      {/* Live Ledger Table */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Chronological Debit / Credit Double-Entry Ledger
            </h3>
            <span className="text-[11px] text-[#64748B] font-mono">Immutable Double-Entry Entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F9FA] text-[10px] font-semibold uppercase text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 w-24">Type</th>
                  <th className="py-3 px-4 w-36">Reference No.</th>
                  <th className="py-3 px-4">Narration / Description</th>
                  <th className="py-3 px-4 w-32 text-right">Debit / Billed (₹)</th>
                  <th className="py-3 px-4 w-32 text-right">Credit / Paid (₹)</th>
                  <th className="py-3 px-4 w-36 text-right">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#94A3B8] font-sans">
                      No ledger transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry) => {
                    const runBal = BigInt(entry.runningBalancePaise || 0);
                    const isEntryAdvance = runBal < 0n;
                    const absRunBal = isEntryAdvance ? -runBal : runBal;

                    return (
                      <tr key={entry.id} className="hover:bg-[#F8F9FA] transition">
                        <td className="py-3 px-4 text-[#64748B]">{entry.date}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            entry.type === 'INVOICE' 
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' 
                              : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#0F172A] font-semibold">{entry.refNo}</td>
                        <td className="py-3 px-4 text-[#475569] font-sans">{entry.narration}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#DC2626] tabular-nums">
                          {BigInt(entry.debitPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.debitPaise)) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#16A34A] tabular-nums">
                          {BigInt(entry.creditPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.creditPaise)) : '-'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold tabular-nums ${
                          isEntryAdvance ? 'text-[#15803D]' : runBal > 0n ? 'text-[#DC2626]' : 'text-[#0F172A]'
                        }`}>
                          {formatPaiseToRupees(absRunBal)}
                          {isEntryAdvance ? (
                            <span className="ml-1 text-[9px] font-bold text-[#16A34A] bg-[#F0FDF4] px-1 py-0.2 rounded border border-[#BBF7D0]">Cr</span>
                          ) : runBal > 0n ? (
                            <span className="ml-1 text-[9px] font-bold text-[#DC2626] bg-[#FEF2F2] px-1 py-0.2 rounded border border-[#FECACA]">Dr</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModal && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#16A34A]" />
                  Record Payment (Jama Entry)
                </h3>
                <button
                  onClick={() => setIsPaymentModal(false)}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[#475569] block mb-1 font-medium">Customer Account</label>
                  <div className="font-semibold text-[#0F172A] bg-[#F8F9FA] p-2.5 rounded-xl border border-[#E2E8F0]">
                    {customer.shopName} ({customer.name})
                  </div>
                </div>

                <div>
                  <label className="text-[#475569] block mb-1 font-medium">Payment Amount (₹)</label>
                  <input
                    type="text"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-sm font-bold font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#475569] block mb-1 font-medium">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                    >
                      <option value="UPI">UPI / PhonePe / GPay</option>
                      <option value="CASH">Cash at Counter</option>
                      <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#475569] block mb-1 font-medium">Reference / UTR</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. 40291048291"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModal(false)}
                    className="flex-1 h-8.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#475569] font-medium rounded-xl border border-[#CBD5E1] text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="flex-1 h-8.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50"
                  >
                    {submittingPayment ? 'Saving Entry...' : 'Confirm & Add to Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Razorpay Instant Link & QR Modal */}
      {isRazorpayModal && customer && (
        <RazorpayModal
          isOpen={isRazorpayModal}
          onClose={() => setIsRazorpayModal(false)}
          customerId={customer.id}
          customerName={customer.shopName || customer.name}
          customerPhone={customer.phone}
          defaultAmountRupees={(Number(BigInt(customer.balancePaise || 0)) / 100).toFixed(2)}
          onPaymentSuccess={() => {
            setIsRazorpayModal(false);
            fetchCustomerDetail();
          }}
        />
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && customer && (
        <EditCustomerModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          customer={customer}
          onSuccess={(updatedCustomer) => {
            setCustomer((prev: any) => ({ ...prev, ...updatedCustomer }));
            fetchCustomerDetail();
          }}
        />
      )}
    </div>
  );
}
