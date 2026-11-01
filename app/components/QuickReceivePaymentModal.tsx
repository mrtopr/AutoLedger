'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  QrCode as QrIcon,
  Building2,
  Phone,
  ArrowRight,
  DollarSign,
  UserCheck,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import ClientPortal from './ClientPortal';

interface CustomerSummary {
  id: string;
  name: string;
  shopName?: string;
  phone?: string;
  balancePaise: string;
}

interface QuickReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shopName?: string;
  defaultUpiId?: string;
}

export default function QuickReceivePaymentModal({
  isOpen,
  onClose,
  onSuccess,
  shopName = 'Apex Trade & Wholesale',
  defaultUpiId = 'tradeledger@okhdfcbank'
}: QuickReceivePaymentModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK' | 'CHEQUE'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // UPI Dynamic QR
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Search input focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setCustomers([]);
      setSelectedCustomer(null);
      setPaymentAmountRupees('');
      setPaymentMode('CASH');
      setReferenceNumber('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setQrDataUrl('');
      return;
    }
    // Auto-focus search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  // Fetch customers matching query
  useEffect(() => {
    if (!isOpen || selectedCustomer) return;

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/v1/customers?q=${encodeURIComponent(searchTerm.trim())}`);
        if (res.ok) {
          const data = await res.json();
          const list = data.customers || (Array.isArray(data) ? data : []);
          setCustomers(
            list.map((c: any) => ({
              id: c.id,
              name: c.name,
              shopName: c.shopName,
              phone: c.phone,
              balancePaise: c.balancePaise || '0'
            }))
          );
        }
      } catch (err) {
        console.error('Failed to search customers:', err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, selectedCustomer]);

  // Auto-generate UPI QR code when UPI is selected
  useEffect(() => {
    if (paymentMode !== 'UPI' || !paymentAmountRupees || parseFloat(paymentAmountRupees) <= 0) {
      setQrDataUrl('');
      return;
    }

    const amt = parseFloat(paymentAmountRupees).toFixed(2);
    const custLabel = selectedCustomer?.shopName || selectedCustomer?.name || 'Customer';
    const upiUri = `upi://pay?pa=${defaultUpiId}&pn=${encodeURIComponent(shopName)}&am=${amt}&cu=INR&tn=${encodeURIComponent(`Khata Settlement - ${custLabel}`)}`;

    QRCode.toDataURL(upiUri, { width: 200, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate UPI QR:', err));
  }, [paymentMode, paymentAmountRupees, selectedCustomer, defaultUpiId, shopName]);

  const handleSelectCustomer = (c: CustomerSummary) => {
    setSelectedCustomer(c);
    const bal = BigInt(c.balancePaise || '0');
    // If due, pre-fill with the due amount
    if (bal > 0n) {
      setPaymentAmountRupees((Number(bal) / 100).toFixed(2));
    } else {
      setPaymentAmountRupees('');
    }
    setReferenceNumber(`PAY/${Date.now().toString().slice(-6)}`);
    setErrorMsg(null);
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(defaultUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setErrorMsg('Please select a customer account first.');
      return;
    }

    const amtFloat = parseFloat(paymentAmountRupees);
    if (isNaN(amtFloat) || amtFloat <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const amtPaise = parseRupeesToPaise(paymentAmountRupees);

      const res = await fetch(`/api/v1/customers/${selectedCustomer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: amtPaise.toString(),
          mode: paymentMode,
          referenceNumber: referenceNumber || `${paymentMode}/${Date.now().toString().slice(-6)}`
        })
      });

      if (res.ok) {
        setSuccessMsg(`Payment of ₹${amtFloat.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded successfully!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1100);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to record customer payment.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while recording payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const rawBal = selectedCustomer ? BigInt(selectedCustomer.balancePaise || '0') : 0n;
  const isAdvance = rawBal < 0n;
  const absBal = isAdvance ? -rawBal : rawBal;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Receive Customer Payment</h3>
                <p className="text-[11px] text-slate-500 font-mono">Counter Settlement & Khata Jama Entry</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success State */}
          {successMsg ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">{successMsg}</h4>
              <p className="text-xs text-slate-500 font-mono">Updated Khata balance & dashboard collections.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Step 1: Select Customer */}
              {!selectedCustomer ? (
                <div className="space-y-2">
                  <label className="text-slate-700 font-semibold block">Select Customer Account *</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by customer name, shop, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>

                  {/* Customer Search Results */}
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {searching ? (
                      <div className="p-4 text-center text-slate-400 font-mono text-[11px]">
                        Searching customer directory...
                      </div>
                    ) : customers.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        {searchTerm.trim() ? 'No customer accounts found matching your query.' : 'Type to search customers by name or phone.'}
                      </div>
                    ) : (
                      customers.map((c) => {
                        const bal = BigInt(c.balancePaise || '0');
                        const isCr = bal < 0n;
                        const abs = isCr ? -bal : bal;

                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full p-2.5 text-left hover:bg-slate-50 transition flex items-center justify-between gap-3 cursor-pointer group"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate group-hover:text-[#C81E1E] transition">
                                {c.shopName || c.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                                {c.phone && <span>{c.phone}</span>}
                                {c.shopName && c.name && c.shopName !== c.name && <span>• {c.name}</span>}
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono">
                              <div className={`text-xs font-bold ${bal > 0n ? 'text-rose-600' : isCr ? 'text-emerald-700' : 'text-slate-600'}`}>
                                {formatPaiseToRupees(abs)} {isCr ? '(Cr)' : bal > 0n ? '(Dr)' : ''}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {bal > 0n ? 'Pending Due' : isCr ? 'Advance' : 'Settled'}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Selected Customer Chip */
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">{selectedCustomer.shopName || selectedCustomer.name}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                        Selected
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3 mt-0.5">
                      {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                      <span>
                        Current Khata:{' '}
                        <strong className={rawBal > 0n ? 'text-rose-600' : 'text-emerald-700'}>
                          {formatPaiseToRupees(absBal)} {isAdvance ? '(Cr)' : rawBal > 0n ? '(Dr)' : ''}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Step 2: Payment Amount & Mode */}
              {selectedCustomer && (
                <div className="space-y-3.5 pt-1">
                  {/* Amount Input */}
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Payment Amount (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono text-sm">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={paymentAmountRupees}
                        onChange={(e) => setPaymentAmountRupees(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-9 pl-7 pr-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                    </div>

                    {/* Quick Amount Suggestion Pills */}
                    {rawBal > 0n && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setPaymentAmountRupees((Number(rawBal) / 100).toFixed(2))}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-mono font-semibold transition cursor-pointer"
                        >
                          Full Due: {formatPaiseToRupees(rawBal)}
                        </button>
                        {[500, 1000, 2000, 5000].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setPaymentAmountRupees(v.toFixed(2))}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[11px] font-mono transition cursor-pointer"
                          >
                            ₹{v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Mode Selector */}
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1.5">Payment Method</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'CASH', label: 'Cash' },
                        { id: 'UPI', label: 'UPI / QR' },
                        { id: 'BANK', label: 'Bank (NEFT)' },
                        { id: 'CHEQUE', label: 'Cheque' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMode(m.id as any)}
                          className={`py-2 px-1 rounded-xl text-xs font-semibold text-center border transition cursor-pointer ${
                            paymentMode === m.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic UPI QR Section */}
                  {paymentMode === 'UPI' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 text-xs">Scan & Pay via any UPI App</span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-mono"
                        >
                          {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{defaultUpiId}</span>
                        </button>
                      </div>

                      {qrDataUrl ? (
                        <div className="text-center space-y-1.5">
                          <img
                            src={qrDataUrl}
                            alt="UPI QR Code"
                            className="w-36 h-36 mx-auto rounded-lg border border-slate-200 p-1 bg-white shadow-2xs"
                          />
                          <p className="text-[10px] text-slate-400 font-mono">
                            BHIM / PhonePe / GPay / Paytm / Cred
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-slate-400 text-xs font-mono">
                          Enter payment amount above to render dynamic QR code.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reference / UTR Number */}
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      {paymentMode === 'CASH' ? 'Receipt Note' : 'Reference / UTR Number'}
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder={paymentMode === 'CASH' ? 'Counter cash settlement' : 'e.g. 40291048291'}
                      className="w-full h-8.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
                    />
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-300 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || !selectedCustomer || !paymentAmountRupees || parseFloat(paymentAmountRupees) <= 0}
                  className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm & Settle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ClientPortal>
  );
}
