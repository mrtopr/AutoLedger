'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Share2, 
  Zap, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Printer,
  QrCode as QrIcon,
  Radio
} from 'lucide-react';
import { parseRupeesToPaise, formatPaiseToRupees } from '@/server/lib/tax';
import ClientPortal from './ClientPortal';

interface RazorpayModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  invoiceId?: string;
  invoiceNumber?: string;
  defaultAmountRupees?: string;
  onPaymentSuccess?: () => void;
}

export default function RazorpayModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerPhone,
  invoiceId,
  invoiceNumber,
  defaultAmountRupees = '0.00',
  onPaymentSuccess
}: RazorpayModalProps) {
  const [amountRupees, setAmountRupees] = useState<string>(defaultAmountRupees);
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [paymentLinkData, setPaymentLinkData] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Status state: 'pending' | 'paid' | 'failed'
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [paymentDetails, setPaymentDetails] = useState<{
    paymentId?: string;
    method?: string;
    amountPaise?: number | string;
    paidAt?: string;
    failureReason?: string;
  }>({});

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmountRupees(defaultAmountRupees);
      setDescription(
        invoiceNumber 
          ? `Settlement for Invoice #${invoiceNumber}` 
          : `Khata Ledger Payment - ${customerName}`
      );
      setPaymentLinkData(null);
      setQrDataUrl('');
      setError(null);
      setCopied(false);
      setPaymentStatus('pending');
      setPaymentDetails({});
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isOpen, defaultAmountRupees, invoiceNumber, customerName]);

  // Automatic real-time status polling when QR / Payment link is ready
  useEffect(() => {
    if (!paymentLinkData?.id || paymentStatus === 'paid' || paymentStatus === 'failed') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkLiveStatus = async () => {
      try {
        const query = new URLSearchParams({
          linkId: paymentLinkData.id,
          customerId: customerId || '',
          invoiceId: invoiceId || '',
          amountPaise: (parseRupeesToPaise(amountRupees)).toString(),
        });

        const res = await fetch(`/api/v1/payments/razorpay/status?${query.toString()}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === 'paid') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPaymentStatus('paid');
          setPaymentDetails({
            paymentId: data.paymentId || `pay_${paymentLinkData.id}`,
            method: data.method || 'UPI',
            amountPaise: data.amountPaise || parseRupeesToPaise(amountRupees).toString(),
            paidAt: data.paidAt || new Date().toISOString(),
          });
          onPaymentSuccess?.();
        } else if (data.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPaymentStatus('failed');
          setPaymentDetails({
            failureReason: data.reason || 'Payment could not be completed by customer.',
          });
        }
      } catch (err) {
        console.warn('Status poll warning:', err);
      }
    };

    // Poll every 2.5 seconds
    pollingRef.current = setInterval(checkLiveStatus, 2500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [paymentLinkData, paymentStatus, customerId, invoiceId, amountRupees, onPaymentSuccess]);

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      setError(null);
      setPaymentStatus('pending');

      const parsedPaise = parseRupeesToPaise(amountRupees);
      if (parsedPaise <= 0n) {
        setError('Please enter a valid payment amount greater than ₹0');
        return;
      }

      const res = await fetch('/api/v1/payments/razorpay/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountRupees,
          description,
          customerId,
          customerName,
          customerPhone,
          invoiceId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create Razorpay payment link');
      }

      setPaymentLinkData(data);

      // Generate QR Code image for the shortUrl
      if (data.shortUrl) {
        try {
          const qrCodeUrl = await QRCode.toDataURL(data.shortUrl, {
            width: 280,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          setQrDataUrl(qrCodeUrl);
        } catch (qrErr) {
          console.error('Error generating QR code:', qrErr);
        }
      }
    } catch (err: any) {
      console.error('Generate payment link error:', err);
      setError(err.message || 'Error creating payment link');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckStatus = async () => {
    if (!paymentLinkData?.id) return;
    try {
      setCheckingStatus(true);
      const query = new URLSearchParams({
        linkId: paymentLinkData.id,
        customerId: customerId || '',
        invoiceId: invoiceId || '',
        amountPaise: (parseRupeesToPaise(amountRupees)).toString(),
      });

      const res = await fetch(`/api/v1/payments/razorpay/status?${query.toString()}`);
      const data = await res.json();

      if (data.status === 'paid') {
        setPaymentStatus('paid');
        setPaymentDetails({
          paymentId: data.paymentId || `pay_${paymentLinkData.id}`,
          method: data.method || 'UPI',
          amountPaise: data.amountPaise || parseRupeesToPaise(amountRupees).toString(),
          paidAt: data.paidAt || new Date().toISOString(),
        });
        onPaymentSuccess?.();
      } else if (data.status === 'failed') {
        setPaymentStatus('failed');
        setPaymentDetails({
          failureReason: data.reason || 'Payment was declined or cancelled.',
        });
      }
    } catch (err: any) {
      console.error('Manual status check error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Test Simulation Handler (Instant Success / Failure Testing)
  const handleSimulatePayment = async (action: 'SUCCESS' | 'FAILED') => {
    if (!paymentLinkData?.id) return;
    try {
      setCheckingStatus(true);
      const res = await fetch('/api/v1/payments/razorpay/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: paymentLinkData.id,
          customerId,
          invoiceId,
          amountPaise: (parseRupeesToPaise(amountRupees)).toString(),
          action,
          reason: action === 'FAILED' ? 'Customer cancelled transaction in UPI App' : undefined,
        }),
      });

      const data = await res.json();
      if (data.status === 'paid') {
        setPaymentStatus('paid');
        setPaymentDetails({
          paymentId: data.paymentId,
          method: data.method || 'UPI (Simulated)',
          amountPaise: data.amountPaise,
          paidAt: data.paidAt,
        });
        onPaymentSuccess?.();
      } else if (data.status === 'failed') {
        setPaymentStatus('failed');
        setPaymentDetails({
          failureReason: data.reason || 'Payment failed or was declined by user.',
        });
      }
    } catch (err: any) {
      console.error('Simulate error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCopyLink = () => {
    if (!paymentLinkData?.shortUrl) return;
    navigator.clipboard.writeText(paymentLinkData.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenWhatsApp = () => {
    if (!paymentLinkData?.whatsAppUrl) return;
    window.open(paymentLinkData.whatsAppUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
          
          {/* Top Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">Razorpay Instant Payment Gateway</h2>
                <p className="text-[11px] text-slate-400">Dynamic UPI QR & WhatsApp Link Generator</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 1: INITIAL AMOUNT INPUT */}
            {/* ========================================================= */}
            {!paymentLinkData && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="text-slate-500">Customer & Destination:</div>
                  <div className="font-bold text-slate-900 text-sm">{customerName}</div>
                  <div className="text-slate-600 font-mono">{customerPhone}</div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Amount (₹ INR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-base font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-lg font-bold text-slate-900 focus:outline-hidden focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Narration / Notes
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Khata clearance payment"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Secure Link & QR...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Create Dynamic Payment Link & QR</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: QR CODE ACTIVE & WAITING FOR PAYMENT */}
            {/* ========================================================= */}
            {paymentLinkData && paymentStatus === 'pending' && (
              <div className="space-y-4 animate-in fade-in">
                {/* Real-time Listening Banner */}
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span>Listening for UPI Scan & Payment...</span>
                  </div>
                  <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">
                    LIVE RADAR
                  </span>
                </div>

                {/* QR Code Canvas */}
                {qrDataUrl && (
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="text-center mb-2">
                      <div className="text-[11px] text-slate-500 font-medium">Scan to Pay via any UPI App</div>
                      <div className="text-xl font-mono font-black text-slate-900">
                        ₹{parseFloat(amountRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <img
                      src={qrDataUrl}
                      alt="Razorpay Payment QR"
                      className="w-48 h-48 rounded-xl shadow-xs border border-slate-200 bg-white p-2"
                    />

                    <div className="text-[10px] text-slate-500 mt-2 font-medium flex items-center gap-1">
                      <QrIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>Google Pay · PhonePe · Paytm · BHIM · Any UPI</span>
                    </div>
                  </div>
                )}

                {/* Short URL Box */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Payment Web URL:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={paymentLinkData.shortUrl}
                      className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Buttons: WhatsApp & Direct Pay */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send on WhatsApp</span>
                  </button>

                  <a
                    href={paymentLinkData.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <span>Open Checkout</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Status Check & Simulation Controls */}
                <div className="pt-2 border-t border-slate-200 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualCheckStatus}
                    disabled={checkingStatus}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                    <span>{checkingStatus ? 'Checking Bank Gateway...' : 'Check Payment Status Now'}</span>
                  </button>

                  {/* Dev Sandbox Quick Simulator */}
                  <div className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-xl text-[11px]">
                    <span className="text-slate-500 font-medium">Test Simulation:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSimulatePayment('SUCCESS')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition"
                      >
                        ✓ Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulatePayment('FAILED')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-2xs transition"
                      >
                        ✕ Mark Failed
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentLinkData(null);
                      setPaymentStatus('pending');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-700 underline mt-1"
                  >
                    ← Change Amount / Create Another Link
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 3: PAYMENT SUCCESS / RECEIVED (PAID STATE) */}
            {/* ========================================================= */}
            {paymentStatus === 'paid' && (
              <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-10 h-10 animate-in zoom-in" />
                </div>

                <div className="space-y-1">
                  <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 tracking-wider uppercase">
                    Payment Verified & Received
                  </span>
                  <h3 className="text-xl font-bold text-slate-900">
                    ₹{parseFloat(amountRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Received from <span className="font-semibold text-slate-800">{customerName}</span>
                  </p>
                </div>

                {/* Payment Receipt Pill */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Payment ID / Ref:</span>
                    <span className="font-mono font-bold text-slate-800">{paymentDetails.paymentId || 'pay_confirmed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Payment Method:</span>
                    <span className="font-semibold text-emerald-700">{paymentDetails.method || 'UPI / Instant Pay'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Ledger Entry:</span>
                    <span className="font-semibold text-slate-800">Khata Credited (Jama) ✓</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    Done / Close Window
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 4: PAYMENT FAILED / DECLINED (FAILURE STATE) */}
            {/* ========================================================= */}
            {paymentStatus === 'failed' && (
              <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center shadow-inner">
                  <XCircle className="w-10 h-10 animate-in zoom-in" />
                </div>

                <div className="space-y-1">
                  <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 tracking-wider uppercase">
                    Payment Failed / Declined
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    Transaction Incomplete
                  </h3>
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    Reason: {paymentDetails.failureReason || 'Customer cancelled transaction or bank gateway timed out.'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800">Ledger Integrity:</div>
                  <p className="text-[11px] text-slate-500">
                    No money was debited from customer khata. You can regenerate a new QR or accept cash at counter.
                  </p>
                </div>

                <div className="pt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatus('pending');
                      handleGenerateLink();
                    }}
                    className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again (New QR)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </ClientPortal>
  );
}
