'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Store, 
  Receipt, 
  CreditCard, 
  Phone, 
  MapPin, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Clock, 
  FileText, 
  LogOut, 
  ChevronRight, 
  Download, 
  QrCode, 
  Landmark, 
  Copy, 
  Check, 
  Search, 
  ShieldCheck, 
  ExternalLink,
  Sparkles,
  RefreshCw,
  Eye,
  Package
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import ClientPortal from '@/app/components/ClientPortal';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';

export default function CustomerPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'INVOICES' | 'DEALER'>('LEDGER');

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [customPayAmount, setCustomPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payMode, setPayMode] = useState<'UPI' | 'ONLINE' | 'BANK'>('UPI');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [paySuccessToast, setPaySuccessToast] = useState<string | null>(null);

  // Invoice Preview Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Copy UPI state
  const [copiedUpi, setCopiedUpi] = useState(false);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check stored token in localStorage as well
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('autoledger_customer_token') : null;
      const headers: Record<string, string> = {};
      if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`;
      }

      const res = await fetch('/api/v1/portal/me', { headers });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || 'Please log in to access your customer Khata portal.');
        router.push('/login?tab=customer');
      }
    } catch (err: any) {
      console.error('Error loading portal data:', err);
      setError(err.message || 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('autoledger_customer_token');
      localStorage.removeItem('autoledger_customer_phone');
    }
    // Delete cookie by setting expiration
    document.cookie = 'autoledger_customer_token=; path=/; max-age=0';
    router.push('/login?tab=customer');
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.customer?.id || !customPayAmount) return;

    try {
      setIsSubmittingPay(true);
      const amtPaise = parseRupeesToPaise(customPayAmount);

      const res = await fetch('/api/v1/portal/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: data.customer.id,
          amountPaise: amtPaise.toString(),
          mode: payMode,
          referenceNumber: payReference || `UPI/${Date.now().toString().slice(-8)}`,
        }),
      });

      if (res.ok) {
        setIsPayModalOpen(false);
        setPaySuccessToast(`Payment of ₹${customPayAmount} recorded successfully!`);
        setTimeout(() => setPaySuccessToast(null), 5000);
        fetchPortalData();
      } else {
        const json = await res.json();
        alert(json.error || 'Payment failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing payment.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#0F172A] flex items-center justify-center p-2 mb-4 shadow-xl animate-pulse">
          <img src="/logo.png" alt="AutoLedger" className="w-full h-full object-contain" />
        </div>
        <p className="text-xs font-mono text-slate-500 font-medium">Loading your real-time garage Khata...</p>
      </div>
    );
  }

  if (error || !data?.customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-bold text-slate-900 mb-1">Customer Portal Access Required</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-4">{error || 'Please log in with your registered phone number.'}</p>
        <Link
          href="/login?tab=customer"
          className="h-9 px-5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-md"
        >
          <span>Sign In to Customer Portal</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const { customer, dealership, invoices = [], ledger = [] } = data;
  const rawBalance = BigInt(customer.balancePaise || 0);
  const isAdvance = rawBalance < 0n;
  const isDue = rawBalance > 0n;
  const absBalance = isAdvance ? -rawBalance : rawBalance;
  const creditLimit = BigInt(customer.creditLimitPaise || 5000000);
  const utilizationPct = creditLimit > 0n && isDue ? Math.min(100, Math.round(Number((rawBalance * 100n) / creditLimit))) : 0;

  // Generate dynamic UPI intent link
  const upiId = dealership?.upiId || 'royalauto@okhdfcbank';
  const payAmtRupees = (Number(absBalance) / 100).toFixed(2);
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(dealership?.name || 'Dealership')}&am=${payAmtRupees}&cu=INR&tn=${encodeURIComponent(`Khata Settlement - ${customer.shopName}`)}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      
      {/* 1. TOP PORTAL HEADER */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-auto flex items-center gap-2">
              <img src="/logo.png" alt="AutoLedger" className="h-7 w-auto object-contain" />
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-red-50 text-[#C81E1E] text-[10px] font-bold tracking-wider font-mono border border-red-100 uppercase">
                Customer Khata
              </span>
            </div>
            <div className="hidden md:block h-4 w-px bg-slate-200" />
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{dealership?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">{customer.shopName}</div>
              <div className="text-[10px] text-slate-500 font-mono">{customer.phone}</div>
            </div>
            <button
              onClick={handleLogout}
              className="h-8 px-2.5 sm:px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* SUCCESS TOAST */}
      {paySuccessToast && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-4">
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{paySuccessToast}</span>
          </div>
        </div>
      )}

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-5 space-y-4">
        
        {/* HERO KHATA SUMMARY CARD */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            
            {/* Garage Profile Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {customer.shopName}
                </h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  customer.status === 'GREEN' 
                    ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' 
                    : customer.status === 'YELLOW' 
                    ? 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]' 
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    customer.status === 'GREEN' ? 'bg-[#16A34A]' : customer.status === 'YELLOW' ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                  }`} />
                  {customer.status} ACCOUNT
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Proprietor: <span className="font-semibold text-slate-900">{customer.name}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
                <span className="flex items-center gap-1 text-slate-700">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {customer.phone}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-sans text-slate-600">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {customer.address || 'Workshop'}
                </span>
                {customer.gstin && (
                  <>
                    <span>•</span>
                    <span>GSTIN: {customer.gstin}</span>
                  </>
                )}
              </div>
            </div>

            {/* Balance & Instant Action Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 sm:p-5 rounded-xl shadow-md min-w-[280px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-300 text-[11px] uppercase tracking-wider font-semibold mb-1">
                  <span>{isAdvance ? 'Advance Credit (जमा)' : isDue ? 'Khata Outstanding (बाकी)' : 'Settled Balance'}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono ${
                    isAdvance ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {isAdvance ? 'CR ADVANCE' : isDue ? 'DR DUE' : 'NIL'}
                  </span>
                </div>
                <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight tabular-nums ${
                  isAdvance ? 'text-emerald-400' : isDue ? 'text-white' : 'text-slate-300'
                }`}>
                  {formatPaiseToRupees(absBalance)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Credit Limit: {formatPaiseToRupees(creditLimit)} • {customer.termsDays || 15}d terms
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center gap-2">
                <button
                  onClick={() => {
                    setCustomPayAmount(isDue ? (Number(absBalance) / 100).toFixed(2) : '1000.00');
                    setIsPayModalOpen(true);
                  }}
                  className="flex-1 h-8.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-slate-950 fill-current" />
                  <span>{isDue ? 'Pay Due (जमा करें)' : 'Add Advance (जमा)'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('DEALER')}
                  className="h-8.5 px-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-lg transition inline-flex items-center justify-center gap-1 cursor-pointer"
                  title="Showroom Bank & UPI Info"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">UPI QR</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 3. TABS NAVIGATION */}
        <div className="border-b border-[#E2E8F0] flex items-center gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'LEDGER' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Khata Ledger Passbook ({ledger.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'INVOICES' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Spares & Invoices History ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('DEALER')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'DEALER' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Dealership & Bank Info</span>
          </button>
        </div>

        {/* 4. TAB CONTENT 1: KHATA LEDGER PASSBOOK */}
        {activeTab === 'LEDGER' && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Chronological Double-Entry Ledger
                </h3>
                <p className="text-[11px] text-slate-500">Every purchase (Debit) and payment (Credit) recorded in real time.</p>
              </div>
              <button 
                onClick={fetchPortalData}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                title="Refresh Ledger"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase text-slate-500 border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4 w-28">Date</th>
                    <th className="py-3 px-4 w-24">Type</th>
                    <th className="py-3 px-4 w-36">Reference No.</th>
                    <th className="py-3 px-4">Narration / Items</th>
                    <th className="py-3 px-4 w-28 text-right">Debit / Billed</th>
                    <th className="py-3 px-4 w-28 text-right">Credit / Paid</th>
                    <th className="py-3 px-4 w-32 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                        No transactions recorded on your Khata yet.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((entry: any) => {
                      const runBal = BigInt(entry.runningBalancePaise || 0);
                      const isEntryAdvance = runBal < 0n;
                      const absRunBal = isEntryAdvance ? -runBal : runBal;

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 text-slate-500">{entry.date}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              entry.type === 'INVOICE' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-900 font-semibold">{entry.refNo}</td>
                          <td className="py-3 px-4 text-slate-700 font-sans">{entry.narration}</td>
                          <td className="py-3 px-4 text-right font-semibold text-[#DC2626] tabular-nums">
                            {BigInt(entry.debitPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.debitPaise)) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#15803D] tabular-nums">
                            {BigInt(entry.creditPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.creditPaise)) : '-'}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold tabular-nums ${
                            isEntryAdvance ? 'text-[#15803D]' : runBal > 0n ? 'text-[#DC2626]' : 'text-slate-900'
                          }`}>
                            {formatPaiseToRupees(absRunBal)}
                            {isEntryAdvance ? (
                              <span className="ml-1 text-[9px] font-bold text-[#15803D] bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">Cr</span>
                            ) : runBal > 0n ? (
                              <span className="ml-1 text-[9px] font-bold text-[#DC2626] bg-red-50 px-1 py-0.2 rounded border border-red-200">Dr</span>
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

        {/* 5. TAB CONTENT 2: INVOICES & SPARES HISTORY */}
        {activeTab === 'INVOICES' && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-slate-400">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Billed Invoices Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">When you purchase parts from the dealership, bills will show up here.</p>
              </div>
            ) : (
              invoices.map((inv: any) => (
                <div key={inv.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          BILLED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Date: {inv.date} • {inv.itemCount || inv.items?.length || 0} Spares Lines
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-500 font-medium">Grand Total</div>
                      <div className="text-base font-black font-mono text-slate-900 tabular-nums">
                        {formatPaiseToRupees(BigInt(inv.grandTotalPaise || 0))}
                      </div>
                    </div>
                  </div>

                  {/* Line Items List */}
                  {inv.items && inv.items.length > 0 && (
                    <div className="mt-3 divide-y divide-slate-100 text-xs">
                      {inv.items.map((item: any, idx: number) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-slate-700">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <span className="font-semibold text-slate-900">{item.name}</span>
                              {item.partNumber && item.partNumber !== '-' && (
                                <span className="ml-1.5 text-[10px] text-slate-400 font-mono">({item.partNumber})</span>
                              )}
                            </div>
                          </div>
                          <div className="font-mono text-right tabular-nums text-slate-600">
                            <span>{item.qty} × {formatPaiseToRupees(BigInt(item.ratePaise || 0))} = </span>
                            <span className="font-bold text-slate-900">{formatPaiseToRupees(BigInt(item.totalPaise || (BigInt(item.ratePaise || 0) * BigInt(item.qty || 1))))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. TAB CONTENT 3: DEALERSHIP & BANK INFO */}
        {activeTab === 'DEALER' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Showroom Contact Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="w-4 h-4 text-[#C81E1E]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Dealership Contact Desk
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">Showroom / Trade Name</div>
                  <div className="font-bold text-slate-900 text-sm">{dealership?.name}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Address & Service Bay</div>
                  <div className="font-medium text-slate-700">{dealership?.address}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Dealership Phone / WhatsApp</div>
                  <div className="font-bold text-slate-900 font-mono flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{dealership?.phone}</span>
                  </div>
                </div>
                {dealership?.gstin && (
                  <div>
                    <div className="text-[11px] text-slate-500">GSTIN</div>
                    <div className="font-bold text-slate-900 font-mono">{dealership.gstin}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Bank Settlement & QR Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-[#2563EB]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Bank Settlement Details
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">NEFT / RTGS / IMPS</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Bank Name</div>
                    <div className="font-bold text-slate-900">{dealership?.bankName || 'HDFC Bank'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">IFSC Code</div>
                    <div className="font-bold text-slate-900 font-mono">{dealership?.ifscCode || 'HDFC0001234'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-slate-500 uppercase">Account Number</div>
                    <div className="font-bold text-slate-900 font-mono text-sm tracking-wider">
                      {dealership?.accountNumber || '50200012345678'}
                    </div>
                  </div>
                </div>
              </div>

              {/* UPI ID Box */}
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Counter UPI VPA</div>
                  <div className="text-xs font-mono font-bold text-blue-700">{upiId}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(upiId);
                    setCopiedUpi(true);
                    setTimeout(() => setCopiedUpi(false), 3000);
                  }}
                  className="h-7 px-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 transition inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUpi ? 'Copied' : 'Copy UPI'}</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* 7. INSTANT PAYMENT SETTLEMENT MODAL */}
      {isPayModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Settle Khata Balance</h3>
                    <p className="text-[11px] text-slate-500">Pay directly to {dealership?.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPayModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* UPI QR Code Container */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center text-center space-y-2">
                <div className="w-36 h-36 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center shadow-2xs">
                  {/* Dynamic QR API rendering standard UPI payload */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      `upi://pay?pa=${upiId}&pn=${encodeURIComponent(dealership?.name || 'Dealership')}&am=${customPayAmount}&cu=INR&tn=Khata Settlement`
                    )}`}
                    alt="UPI QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-[11px] font-semibold text-slate-700 font-mono">Scan via GPay / PhonePe / Paytm / BHIM</p>
                <div className="text-[10px] text-slate-500 font-mono">UPI ID: {upiId}</div>
              </div>

              {/* Deep Link Quick App Button */}
              <a
                href={upiPayUrl}
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in UPI App (Mobile Only)</span>
              </a>

              {/* Payment Confirmation Form */}
              <form onSubmit={handleSettlePayment} className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount to Pay (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customPayAmount}
                      onChange={(e) => setCustomPayAmount(e.target.value)}
                      placeholder="e.g. 600.00"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                    <select
                      value={payMode}
                      onChange={(e: any) => setPayMode(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="BANK">Bank Transfer (IMPS/NEFT)</option>
                      <option value="ONLINE">Razorpay / Net Banking</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">UPI UTR / Reference No. (Optional)</label>
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="e.g. UPI/392019481023 or UTR 481023"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className="h-8.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPay}
                    className="h-8.5 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-md transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmittingPay ? 'Recording...' : 'Confirm & Credit Khata'}</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        </ClientPortal>
      )}

    </div>
  );
}
