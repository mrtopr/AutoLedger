'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Store, 
  Receipt, 
  CreditCard, 
  Phone, 
  MapPin, 
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
  Package,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  Calendar,
  MessageCircle,
  Filter,
  CheckCircle,
  XCircle,
  Smartphone,
  Printer,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  Share2,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Layers,
  Send,
  SlidersHorizontal,
  PackagePlus,
  AlertTriangle
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import ClientPortal from '@/app/components/ClientPortal';

export default function CustomerPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'INVOICES' | 'CATALOG' | 'DEALER'>('LEDGER');

  // Catalog & Ordering state
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [catalogModels, setCatalogModels] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedModel, setSelectedModel] = useState('ALL');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState<any>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Ledger search & filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'ALL' | 'INVOICE' | 'PAYMENT'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30'>('ALL');

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [customPayAmount, setCustomPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payMode, setPayMode] = useState<'UPI' | 'ONLINE' | 'BANK'>('UPI');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [paySuccessToast, setPaySuccessToast] = useState<string | null>(null);

  // Copy states
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [copiedBankIfsc, setCopiedBankIfsc] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);
  const [copiedGstin, setCopiedGstin] = useState(false);

  // Invoices expansion state
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);

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
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setCatalogLoading(true);
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('autoledger_customer_token') : null;
      const headers: Record<string, string> = {};
      if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`;
      }
      const res = await fetch('/api/v1/portal/catalog', { headers });
      if (res.ok) {
        const json = await res.json();
        setCatalogProducts(json.products || []);
        setCatalogCategories(json.categories || []);
        setCatalogModels(json.models || []);
      }
    } catch (err) {
      console.error('Error loading catalog:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotalPaise = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + BigInt(item.product.salePricePaise || '0') * BigInt(item.quantity);
    }, 0n);
  }, [cart]);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    try {
      setIsSubmittingOrder(true);
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('autoledger_customer_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`;
      }

      const payload = {
        items: cart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          partNumber: item.product.partNumber,
          salePricePaise: item.product.salePricePaise,
          quantity: item.quantity,
          hsnCode: item.product.hsnCode,
        })),
        notes: orderNotes,
      };

      const res = await fetch('/api/v1/portal/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setOrderSuccessData(resJson.order);
        setCart([]);
        setOrderNotes('');
        fetchPortalData();
      } else {
        alert(resJson.error || 'Failed to place order. Please try again.');
      }
    } catch (err: any) {
      console.error('Error placing order:', err);
      alert(err.message || 'Error communicating with server.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('autoledger_customer_token');
      localStorage.removeItem('autoledger_customer_phone');
    }
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
        setPaySuccessToast(`Payment of ₹${customPayAmount} successfully recorded & credited to your Khata!`);
        setTimeout(() => setPaySuccessToast(null), 5000);
        fetchPortalData();
      } else {
        const json = await res.json();
        alert(json.error || 'Payment processing failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing payment.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleCopy = (text: string, type: 'UPI' | 'ACC' | 'IFSC' | 'GSTIN' | string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      if (type === 'UPI') {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      } else if (type === 'ACC') {
        setCopiedBankAcc(true);
        setTimeout(() => setCopiedBankAcc(false), 2500);
      } else if (type === 'IFSC') {
        setCopiedBankIfsc(true);
        setTimeout(() => setCopiedBankIfsc(false), 2500);
      } else if (type === 'GSTIN') {
        setCopiedGstin(true);
        setTimeout(() => setCopiedGstin(false), 2500);
      } else {
        setCopiedRefId(type);
        setTimeout(() => setCopiedRefId(null), 2500);
      }
    }
  };

  const handlePrintPassbook = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 text-white">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center p-3 shadow-2xl animate-pulse">
            <img src="/logo.png" alt="TradeLedger" className="w-full h-full object-contain" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
          </span>
        </div>
        <div className="text-center space-y-1.5">
          <div className="text-sm font-bold tracking-wide text-slate-200">TradeLedger Khata Portal</div>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C81E1E]" />
            <span>Synchronizing live double-entry khata...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.customer) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4 shadow-md">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Customer Portal Authentication Required</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6">{error || 'Please log in with your registered phone number.'}</p>
        <Link
          href="/login?tab=customer"
          className="h-10 px-6 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-2 shadow-md cursor-pointer"
        >
          <span>Sign In to Customer Portal</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const { customer, dealership, invoices = [], ledger = [] } = data;
  
  // Calculate live running balance from latest ledger or customer record
  const latestLedgerEntry = ledger && ledger.length > 0 ? ledger[0] : null;
  const rawBalance = latestLedgerEntry 
    ? BigInt(latestLedgerEntry.runningBalancePaise || 0)
    : BigInt(customer.balancePaise || 0);

  const isAdvance = rawBalance < 0n;
  const isDue = rawBalance > 0n;
  const isSettled = rawBalance === 0n;
  const absBalance = isAdvance ? -rawBalance : rawBalance;
  const creditLimit = BigInt(customer.creditLimitPaise || 5000000);
  
  // Available Credit: Credit Limit - Due, or Credit Limit + Advance
  const availableCreditPaise = isDue ? (creditLimit > rawBalance ? creditLimit - rawBalance : 0n) : (creditLimit + absBalance);
  const utilizationPct = creditLimit > 0n && isDue ? Math.min(100, Math.round(Number((rawBalance * 100n) / creditLimit))) : 0;

  // Aggregate totals
  const totalBilledPaise = ledger
    .filter((l: any) => l.type === 'INVOICE')
    .reduce((acc: bigint, l: any) => acc + BigInt(l.debitPaise || 0), 0n);

  const totalPaidPaise = ledger
    .filter((l: any) => l.type === 'PAYMENT')
    .reduce((acc: bigint, l: any) => acc + BigInt(l.creditPaise || 0), 0n);

  // Filtered Ledger
  const filteredLedger = ledger.filter((entry: any) => {
    const matchesSearch = 
      !ledgerSearch.trim() ||
      entry.refNo.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      entry.narration.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      entry.date.includes(ledgerSearch);

    const matchesType = 
      ledgerTypeFilter === 'ALL' || 
      entry.type === ledgerTypeFilter;

    let matchesDate = true;
    if (dateRangeFilter === 'THIS_MONTH') {
      const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
      matchesDate = entry.date.startsWith(currentMonthPrefix);
    } else if (dateRangeFilter === 'LAST_30') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      matchesDate = entry.date >= thirtyDaysAgo;
    }

    return matchesSearch && matchesType && matchesDate;
  });

  const upiId = dealership?.upiId || 'royalauto@okhdfcbank';
  const payAmtRupees = (Number(absBalance) / 100).toFixed(2);
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(dealership?.name || 'Dealership')}&am=${payAmtRupees}&cu=INR&tn=${encodeURIComponent(`Khata Settlement - ${customer.shopName}`)}`;

  // Quick WhatsApp share link
  const waShareText = encodeURIComponent(
    `*TradeLedger B2B Statement Update*\n` +
    `Client / Business: ${customer.shopName}\n` +
    `Contact: ${customer.name}\n` +
    `Current Status: ${isAdvance ? 'Advance Credit: ' + formatPaiseToRupees(absBalance) + ' Cr' : isDue ? 'Khata Due: ' + formatPaiseToRupees(absBalance) + ' Dr' : 'Settled Balance: NIL'}\n` +
    `Supplier: ${dealership?.name || 'Apex Trade & Wholesale'}\n` +
    `Date: ${new Date().toLocaleDateString('en-IN')}`
  );
  const waShareUrl = `https://wa.me/?text=${waShareText}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 font-sans antialiased selection:bg-red-500/20 selection:text-red-900">
      
      {/* ============================================================ */}
      {/* 1. TOP PORTAL NAVIGATION HEADER                              */}
      {/* ============================================================ */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Left: Brand & Portal Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/portal" className="flex items-center gap-2.5 group">
              <img src="/logo.png" alt="TradeLedger" className="h-7 w-auto object-contain transition-transform group-hover:scale-105" />
              <span className="inline-flex px-2 py-0.5 rounded-md bg-red-50 text-[#C81E1E] text-[11px] font-bold tracking-wide font-mono border border-red-100 uppercase">
                Khata Portal
              </span>
            </Link>

            {dealership?.name && (
              <>
                <div className="h-4 w-px bg-slate-200 hidden lg:block" />
                {/* Dealership Info */}
                <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium text-slate-800">{dealership.name}</span>
                  {dealership.phone && (
                    <>
                      <span className="text-slate-300">•</span>
                      <a 
                        href={`tel:${dealership.phone}`} 
                        className="text-slate-500 hover:text-[#C81E1E] font-mono text-[11px] flex items-center gap-1 transition"
                        title="Call Dealership"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{dealership.phone}</span>
                      </a>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Customer Profile, Print & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Customer Workshop Badge */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[160px]">
                  {customer.shopName || customer.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono leading-tight">
                  {customer.phone}
                </div>
              </div>
            </div>

            <button
              onClick={handlePrintPassbook}
              className="h-8.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Print Official Statement"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Print</span>
            </button>

            <button
              onClick={handleLogout}
              className="h-8.5 px-3 bg-rose-50/70 hover:bg-rose-100 hover:text-rose-800 border border-rose-200/70 text-rose-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Logout</span>
            </button>
          </div>

        </div>
      </header>

      {/* PRINT-ONLY OFFICIAL HEADER */}
      <div className="hidden print:block max-w-6xl mx-auto p-6 border-b-2 border-slate-900 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{dealership?.name || 'HONDA AUTHORIZED DEALERSHIP'}</h1>
            <p className="text-xs text-slate-600 font-medium">{dealership?.address} • Phone: {dealership?.phone}</p>
            <p className="text-xs text-slate-600 font-mono">GSTIN: {dealership?.gstin || 'N/A'}</p>
          </div>
          <div className="text-right">
            <div className="text-base font-black text-slate-900 uppercase">Khata Ledger Statement</div>
            <div className="text-xs text-slate-500 font-mono">Statement Date: {new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 text-xs">
          <div>
            <div className="font-bold text-slate-900 text-sm">{customer.shopName}</div>
            <div className="text-slate-600">Proprietor: {customer.name}</div>
            <div className="text-slate-600 font-mono">Mobile: +91 {customer.phone}</div>
            <div className="text-slate-600 font-mono">GSTIN: {customer.gstin || 'UNREGISTERED'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Current Net Balance</div>
            <div className="text-lg font-black font-mono">
              {formatPaiseToRupees(absBalance)} {isAdvance ? '(Advance / Cr)' : isDue ? '(Due / Dr)' : '(Settled)'}
            </div>
            <div className="text-xs text-slate-500 font-mono">Credit Limit: {formatPaiseToRupees(creditLimit)}</div>
          </div>
        </div>
      </div>

      {/* SUCCESS TOAST NOTIFICATION */}
      {paySuccessToast && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 animate-in fade-in slide-in-from-top-2 print:hidden">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{paySuccessToast}</span>
            </div>
            <button 
              onClick={() => setPaySuccessToast(null)} 
              className="text-emerald-700 hover:text-emerald-950 text-xs font-mono font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. MAIN BENTO GRID DASHBOARD                                 */}
      {/* ============================================================ */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-5 space-y-4">
        
        {/* TOP HERO BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
          
          {/* CARD 1: GARAGE PROFILE & CREDIT HEALTH (7 Cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0 border border-slate-700">
                    {customer.shopName?.charAt(0) || 'W'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-black text-slate-900 tracking-tight">
                        {customer.shopName}
                      </h1>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-2xs ${
                        customer.status === 'GREEN' 
                          ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' 
                          : customer.status === 'YELLOW' 
                          ? 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]' 
                          : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          customer.status === 'GREEN' ? 'bg-[#16A34A] animate-pulse' : customer.status === 'YELLOW' ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                        }`} />
                        {customer.status} ACCOUNT
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5 flex items-center gap-1.5">
                      <span>Proprietor:</span> 
                      <span className="font-bold text-slate-900">{customer.name}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={fetchPortalData}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Refresh Live Khata"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contact Meta Details Strip */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mt-3.5 pt-3 border-t border-slate-100 font-medium">
                <a 
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-800 font-mono text-[11px] font-semibold border border-slate-200/60 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>+91 {customer.phone}</span>
                </a>

                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-slate-600 text-[11px] border border-slate-200/60">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{customer.address || 'Workshop Bay'}</span>
                </span>

                {customer.gstin && (
                  <button
                    onClick={() => handleCopy(customer.gstin, 'GSTIN')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-700 font-mono text-[11px] border border-slate-200/60 transition cursor-pointer"
                    title="Click to copy GSTIN"
                  >
                    <span className="text-slate-400 font-sans">GST:</span>
                    <span className="font-bold">{customer.gstin}</span>
                    {copiedGstin ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                )}
              </div>
            </div>

            {/* Credit Limit & Terms Progress Container */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Approved Showroom Credit Limit</span>
                </span>
                <span className="font-mono text-slate-900 font-bold">{formatPaiseToRupees(creditLimit)}</span>
              </div>

              {/* High-Precision Progress Bar */}
              <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    isAdvance ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : utilizationPct > 80 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                  }`}
                  style={{ width: isAdvance ? '100%' : `${Math.max(5, utilizationPct)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{customer.termsDays || 15}-Day Payment Terms</span>
                </span>
                <span className={`font-bold ${isAdvance ? 'text-emerald-700' : isDue && utilizationPct > 80 ? 'text-red-700' : 'text-slate-700'}`}>
                  {isAdvance 
                    ? `Available Credit: ${formatPaiseToRupees(availableCreditPaise)} (100% Free)` 
                    : `${utilizationPct}% Utilized • ${formatPaiseToRupees(availableCreditPaise)} Left`}
                </span>
              </div>
            </div>

          </div>

          {/* CARD 2: DYNAMIC LIVE BALANCE & FAST SETTLEMENT (5 Cols) */}
          <div className={`lg:col-span-5 rounded-2xl p-5 shadow-lg flex flex-col justify-between text-white relative overflow-hidden transition-all duration-300 ${
            isAdvance 
              ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30'
              : isDue
              ? 'bg-gradient-to-br from-red-950 via-slate-900 to-slate-900 border border-red-500/30'
              : 'bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700'
          }`}>
            
            {/* Background Ambient Glow */}
            <div className={`absolute -right-10 -top-10 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-40 ${
              isAdvance ? 'bg-emerald-400' : isDue ? 'bg-red-500' : 'bg-blue-400'
            }`} />

            <div>
              {/* Header Pill */}
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-extrabold text-slate-300 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  <span>{isAdvance ? 'Advance Credit Balance' : isDue ? 'Khata Outstanding Balance' : 'Settled Balance'}</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black border tracking-wider shadow-xs ${
                  isAdvance 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : isDue 
                    ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                    : 'bg-slate-700/80 text-slate-300 border-slate-600'
                }`}>
                  {isAdvance ? 'CR ADVANCE' : isDue ? 'DR DUE' : 'ALL CLEAR'}
                </span>
              </div>

              {/* Big Monospace Currency Figure */}
              <div className="mt-3.5">
                <div className={`text-3xl sm:text-4xl font-black font-mono tracking-tight tabular-nums flex items-baseline gap-2 ${
                  isAdvance ? 'text-emerald-400' : isDue ? 'text-white' : 'text-slate-100'
                }`}>
                  <span>{formatPaiseToRupees(absBalance)}</span>
                  {isAdvance && <span className="text-sm font-black text-emerald-400 font-sans tracking-normal bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">Cr (Advance)</span>}
                  {isDue && <span className="text-sm font-black text-red-400 font-sans tracking-normal bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">Dr (Due)</span>}
                  {isSettled && <span className="text-xs font-bold text-slate-400 font-sans">NIL</span>}
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-1.5 leading-relaxed">
                  {isAdvance 
                    ? 'Your advance balance is safe and will automatically deduct from future orders.'
                    : isDue 
                    ? `Outstanding khata balance under ${customer.termsDays || 15}-day payment cycle.`
                    : 'All previous purchases and payments are 100% balanced.'}
                </p>
              </div>
            </div>

            {/* Quick Settlement Action Buttons */}
            <div className="mt-5 pt-3.5 border-t border-white/10 space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    setCustomPayAmount(isDue ? (Number(absBalance) / 100).toFixed(2) : '1000.00');
                    setIsPayModalOpen(true);
                  }}
                  className={`h-9.5 font-bold text-xs rounded-xl transition inline-flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer ${
                    isAdvance 
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' 
                      : 'bg-[#C81E1E] hover:bg-[#A81818] text-white'
                  }`}
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{isDue ? 'Pay Outstanding' : 'Add Advance Credit'}</span>
                </button>

                <button
                  onClick={() => {
                    setCustomPayAmount(isDue ? (Number(absBalance) / 100).toFixed(2) : '1000.00');
                    setIsPayModalOpen(true);
                  }}
                  className="h-9.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition inline-flex items-center justify-center gap-1.5 border border-white/15 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Show UPI QR</span>
                </button>
              </div>

              {/* Share WhatsApp Statement */}
              <a
                href={waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-7.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 border border-white/10"
              >
                <Share2 className="w-3 h-3 text-emerald-400" />
                <span>Share Khata Summary via WhatsApp</span>
              </a>
            </div>

          </div>

        </div>

        {/* STATS TELEMETRY STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 print:hidden">
          
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total Billed Purchases</div>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-black font-mono text-slate-900 mt-1 tabular-nums">
              {formatPaiseToRupees(totalBilledPaise)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
              <span>{invoices.length} Spares orders billed</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Total Payments (Jama)</div>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-700 mt-1 tabular-nums">
              {formatPaiseToRupees(totalPaidPaise)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              <span>100% recorded & verified</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Ledger Transactions</div>
              <CreditCard className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-black font-mono text-slate-900 mt-1 tabular-nums">
              {ledger.length}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              <span>Double-entry passbook lines</span>
            </div>
          </div>

        </div>

        {/* ============================================================ */}
        {/* 3. TABS NAVIGATION & CONTENT                                 */}
        {/* ============================================================ */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
          
          {/* TAB BUTTONS */}
          <div className="border-b border-[#E2E8F0] px-4 pt-2.5 flex items-center gap-3 sm:gap-6 text-xs overflow-x-auto print:hidden bg-slate-50/50">
            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`pb-3 font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'LEDGER' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Khata Ledger Passbook</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'LEDGER' ? 'bg-red-100 text-[#C81E1E]' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {ledger.length}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('INVOICES')}
              className={`pb-3 font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'INVOICES' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Spares & Invoices History</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'INVOICES' ? 'bg-red-100 text-[#C81E1E]' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {invoices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('CATALOG')}
              className={`pb-3 font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'CATALOG' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Order Genuine Spares</span>
              {cart.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C81E1E] text-white animate-pulse">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} in Cart
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Stock
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('DEALER')}
              className={`pb-3 font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'DEALER' ? 'border-[#C81E1E] text-[#C81E1E]' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Dealership & Bank Info</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: LEDGER PASSBOOK                                   */}
          {/* ======================================================== */}
          {activeTab === 'LEDGER' && (
            <div>
              {/* Ledger Search & Filter Bar */}
              <div className="p-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
                <div className="relative w-full md:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search by ref no, date, narration..."
                    className="w-full h-8.5 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-[#C81E1E] outline-hidden shadow-2xs"
                  />
                </div>

                {/* Filter Pills & Date Selector */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  
                  {/* Type Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setLedgerTypeFilter('ALL')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        ledgerTypeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({ledger.length})
                    </button>
                    <button
                      onClick={() => setLedgerTypeFilter('PAYMENT')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        ledgerTypeFilter === 'PAYMENT' ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Payments (Credit)
                    </button>
                    <button
                      onClick={() => setLedgerTypeFilter('INVOICE')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        ledgerTypeFilter === 'INVOICE' ? 'bg-blue-700 text-white' : 'text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      Bills (Debit)
                    </button>
                  </div>

                  {/* Date Filter */}
                  <select
                    value={dateRangeFilter}
                    onChange={(e: any) => setDateRangeFilter(e.target.value)}
                    className="h-8.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium outline-hidden cursor-pointer"
                  >
                    <option value="ALL">All Time</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="LAST_30">Last 30 Days</option>
                  </select>

                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-slate-500 border-b border-[#E2E8F0] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-28">Date</th>
                      <th className="py-3 px-4 w-28">Type</th>
                      <th className="py-3 px-4 w-44">Reference No.</th>
                      <th className="py-3 px-4">Narration / Description</th>
                      <th className="py-3 px-4 w-32 text-right">Debit / Billed</th>
                      <th className="py-3 px-4 w-32 text-right">Credit / Paid</th>
                      <th className="py-3 px-4 w-40 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                    {filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-sans">
                          <CreditCard className="w-9 h-9 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-700">No Transactions Found</p>
                          <p className="text-xs text-slate-400 mt-0.5">Purchases and payments made at the showroom will automatically reflect in this real-time ledger.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredLedger.map((entry: any) => {
                        const runBal = BigInt(entry.runningBalancePaise || 0);
                        const isEntryAdvance = runBal < 0n;
                        const isEntrySettled = runBal === 0n;
                        const absRunBal = isEntryAdvance ? -runBal : runBal;
                        const isPayment = entry.type === 'PAYMENT';

                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/90 transition group">
                            
                            {/* Date */}
                            <td className="py-3.5 px-4 text-slate-600 font-sans whitespace-nowrap">
                              <span className="font-medium text-slate-800">{entry.date}</span>
                            </td>

                            {/* Type Badge */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isPayment 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                  : 'bg-blue-50 text-blue-800 border-blue-300'
                              }`}>
                                {isPayment ? (
                                  <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Receipt className="w-3 h-3 text-blue-600" />
                                )}
                                <span>{entry.type}</span>
                              </span>
                            </td>

                            {/* Reference No with Copy Button */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-800 font-semibold truncate max-w-[140px]" title={entry.refNo}>
                                  {entry.refNo}
                                </span>
                                <button
                                  onClick={() => handleCopy(entry.refNo, entry.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition p-1 rounded hover:bg-slate-200 cursor-pointer print:hidden"
                                  title="Copy reference ID"
                                >
                                  {copiedRefId === entry.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Narration */}
                            <td className="py-3.5 px-4 text-slate-700 font-sans text-xs">
                              <div className="font-medium">{entry.narration}</div>
                            </td>

                            {/* Debit / Billed */}
                            <td className="py-3.5 px-4 text-right font-bold text-[#DC2626] tabular-nums whitespace-nowrap">
                              {BigInt(entry.debitPaise || 0) > 0n ? (
                                <span>- {formatPaiseToRupees(BigInt(entry.debitPaise))}</span>
                              ) : (
                                <span className="text-slate-300 font-normal">-</span>
                              )}
                            </td>

                            {/* Credit / Paid */}
                            <td className="py-3.5 px-4 text-right font-bold text-[#15803D] tabular-nums whitespace-nowrap">
                              {BigInt(entry.creditPaise || 0) > 0n ? (
                                <span>+ {formatPaiseToRupees(BigInt(entry.creditPaise))}</span>
                              ) : (
                                <span className="text-slate-300 font-normal">-</span>
                              )}
                            </td>

                            {/* Running Balance */}
                            <td className="py-3.5 px-4 text-right font-bold tabular-nums whitespace-nowrap">
                              <span className={isEntryAdvance ? 'text-[#15803D]' : runBal > 0n ? 'text-[#DC2626]' : 'text-slate-700'}>
                                {formatPaiseToRupees(absRunBal)}
                              </span>
                              {isEntryAdvance ? (
                                <span className="ml-1.5 text-[9px] font-black text-[#15803D] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  Cr
                                </span>
                              ) : runBal > 0n ? (
                                <span className="ml-1.5 text-[9px] font-black text-[#DC2626] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                  Dr
                                </span>
                              ) : (
                                <span className="ml-1.5 text-[9px] font-medium text-slate-400">NIL</span>
                              )}
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

          {/* ======================================================== */}
          {/* TAB 2: INVOICES & SPARES HISTORY                         */}
          {/* ======================================================== */}
          {activeTab === 'INVOICES' && (
            <div className="p-4 sm:p-5 space-y-3.5">
              {invoices.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">No Billed Invoices Found</p>
                  <p className="text-xs text-slate-400 mt-0.5">When you purchase spare parts from the dealership, bills will show up here with full line-item details.</p>
                </div>
              ) : (
                invoices.map((inv: any) => {
                  const isExpanded = expandedInvoiceId === inv.id;
                  const lineItems = inv.items || [];

                  return (
                    <div 
                      key={inv.id} 
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-mono font-black text-slate-900">
                              {inv.invoiceNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                              TAX INVOICE
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2">
                            <span>Date: {inv.date}</span>
                            <span>•</span>
                            <span>{inv.itemCount || lineItems.length || 0} Parts Lines</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Amount</div>
                            <div className="text-lg font-black font-mono text-slate-900 tabular-nums">
                              {formatPaiseToRupees(BigInt(inv.grandTotalPaise || 0))}
                            </div>
                          </div>

                          {lineItems.length > 0 && (
                            <button
                              onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                              className="h-8 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide Items' : 'View Spares'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Line Items Breakdown (Collapsible or Shown) */}
                      {lineItems.length > 0 && (isExpanded || invoices.length <= 3) && (
                        <div className="mt-3 divide-y divide-slate-200/60 text-xs">
                          <div className="py-1.5 text-[10px] font-bold uppercase text-slate-400 grid grid-cols-12 gap-2">
                            <span className="col-span-7">Spare Part / Description</span>
                            <span className="col-span-2 text-center">Qty</span>
                            <span className="col-span-3 text-right">Amount (₹)</span>
                          </div>
                          {lineItems.map((item: any, idx: number) => (
                            <div key={idx} className="py-2.5 grid grid-cols-12 gap-2 items-center text-slate-700">
                              <div className="col-span-7 flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div>
                                  <span className="font-semibold text-slate-900">{item.name}</span>
                                  {item.partNumber && item.partNumber !== '-' && (
                                    <span className="ml-1.5 text-[10px] text-slate-400 font-mono">({item.partNumber})</span>
                                  )}
                                </div>
                              </div>
                              <div className="col-span-2 text-center font-mono font-medium text-slate-600">
                                {item.qty}
                              </div>
                              <div className="col-span-3 font-mono text-right tabular-nums text-slate-900 font-bold">
                                {formatPaiseToRupees(BigInt(item.totalPaise || (BigInt(item.ratePaise || 0) * BigInt(item.qty || 1))))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: GENUINE SPARES CATALOG & ORDERING                */}
          {/* ======================================================== */}
          {activeTab === 'CATALOG' && (
            <div className="p-4 sm:p-5 space-y-5">
              
              {/* Top Search & Filter Bar */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3.5 print:hidden">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search parts by name, OEM SKU, bike model (e.g. Activa, Brake Shoe)..."
                      className="w-full h-9.5 pl-9.5 pr-8 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden shadow-2xs"
                    />
                    {catalogSearch && (
                      <button
                        onClick={() => setCatalogSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Cart Overview Button / Pill */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold shadow-2xs">
                      <ShoppingCart className="w-4 h-4 text-[#C81E1E]" />
                      <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} Items</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-emerald-700">₹{(Number(cartTotalPaise) / 100).toFixed(2)}</span>
                    </div>

                    {cart.length > 0 && (
                      <button
                        onClick={clearCart}
                        className="h-8.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-red-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                        title="Clear Cart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bike Model Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>Model:</span>
                  </span>
                  {['ALL', ...catalogModels].slice(0, 8).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                        selectedModel === m
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {m === 'ALL' ? '🏍️ All Bike Models' : m}
                    </button>
                  ))}
                </div>

                {/* Category Filter Pills */}
                {catalogCategories.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span>Category:</span>
                    </span>
                    {['ALL', ...catalogCategories].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition shrink-0 cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-[#C81E1E] text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {cat === 'ALL' ? 'All Categories' : cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Content Layout: Product Grid + Floating Cart Drawer */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Product Catalog Grid (8 or 12 Cols depending on cart) */}
                <div className={`${cart.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
                  {catalogLoading ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-mono space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C81E1E]" />
                      <p>Loading genuine parts catalog from showroom inventory...</p>
                    </div>
                  ) : catalogProducts.length === 0 ? (
                    <div className="p-12 bg-[#F8FAFC] border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                      <Package className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No matching parts found in stock</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your bike model filter or search term.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {catalogProducts
                        .filter((p) => {
                          const q = catalogSearch.toLowerCase().trim();
                          const matchesSearch =
                            !q ||
                            p.name.toLowerCase().includes(q) ||
                            p.partNumber.toLowerCase().includes(q) ||
                            p.brand.toLowerCase().includes(q) ||
                            (p.models && p.models.some((m: string) => m.toLowerCase().includes(q)));

                          const matchesCategory =
                            selectedCategory === 'ALL' ||
                            (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

                          const matchesModel =
                            selectedModel === 'ALL' ||
                            (p.models && p.models.some((m: string) => m.toLowerCase().includes(selectedModel.toLowerCase())));

                          return matchesSearch && matchesCategory && matchesModel;
                        })
                        .map((prod) => {
                          const inCartItem = cart.find((item) => item.product.id === prod.id);
                          const isLowStock = prod.stockQty > 0 && prod.stockQty <= 5;
                          const isOutOfStock = prod.stockQty <= 0;

                          return (
                            <div
                              key={prod.id}
                              className={`bg-white border rounded-xl p-4 flex flex-col justify-between transition hover:shadow-md ${
                                inCartItem ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]/20' : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div>
                                {/* Card Header Badges */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                    {prod.partNumber}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                                    isOutOfStock 
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                      : isLowStock 
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`} />
                                    {isOutOfStock ? 'Out of Stock' : `${prod.stockQty} In Stock`}
                                  </span>
                                </div>

                                {/* Part Title */}
                                <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                                  {prod.name}
                                </h4>

                                <div className="text-[11px] text-slate-500 font-medium mt-1">
                                  {prod.brand} • {prod.category}
                                </div>

                                {/* Compatible Models Pills */}
                                {prod.models && prod.models.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2.5">
                                    {prod.models.slice(0, 3).map((mod: string) => (
                                      <span key={mod} className="text-[9px] bg-slate-50 text-slate-600 font-medium px-1.5 py-0.5 rounded border border-slate-200/80">
                                        {mod}
                                      </span>
                                    ))}
                                    {prod.models.length > 3 && (
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        +{prod.models.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Price & Action Row */}
                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Wholesale Rate</div>
                                  <div className="text-sm font-black font-mono text-slate-900">
                                    {formatPaiseToRupees(BigInt(prod.salePricePaise || 0))}
                                  </div>
                                </div>

                                {/* Add to Cart / Qty Stepper */}
                                <div>
                                  {inCartItem ? (
                                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                      <button
                                        onClick={() => updateCartQty(prod.id, inCartItem.quantity - 1)}
                                        className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs transition cursor-pointer shadow-2xs"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <span className="w-6 text-center text-xs font-black font-mono text-slate-900">
                                        {inCartItem.quantity}
                                      </span>
                                      <button
                                        onClick={() => updateCartQty(prod.id, inCartItem.quantity + 1)}
                                        className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs transition cursor-pointer shadow-2xs"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => addToCart(prod)}
                                      disabled={isOutOfStock}
                                      className="h-7.5 px-3 bg-slate-900 hover:bg-[#C81E1E] disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Add</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Shopping Cart & Khata Requisition Checkout Card */}
                {cart.length > 0 && (
                  <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-4 sticky top-20 self-start">
                    
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-50 text-[#C81E1E] flex items-center justify-center">
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Khata Requisition ({cart.reduce((s, i) => s + i.quantity, 0)})
                        </h3>
                      </div>
                      <button
                        onClick={clearCart}
                        className="text-[11px] font-semibold text-slate-400 hover:text-red-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Cart Items List */}
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1 text-xs space-y-2">
                      {cart.map((item) => (
                        <div key={item.product.id} className="pt-2 flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900 line-clamp-1">{item.product.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {item.product.partNumber} • {formatPaiseToRupees(BigInt(item.product.salePricePaise || 0))} x {item.quantity}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {formatPaiseToRupees(BigInt(item.product.salePricePaise || 0) * BigInt(item.quantity))}
                            </span>
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-slate-300 hover:text-rose-600 p-0.5 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Financial Summary Strip */}
                    <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Requisition Subtotal:</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          ₹{(Number(cartTotalPaise) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/80">
                        <span>Current Available Credit:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatPaiseToRupees(availableCreditPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Payment Terms:</span>
                        <span className="font-mono font-bold text-slate-700">
                          {customer.termsDays || 15} Days Net Khata
                        </span>
                      </div>
                    </div>

                    {/* Credit Limit Exceeded Warning if applicable */}
                    {cartTotalPaise > availableCreditPaise && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Credit Limit Notice: </span>
                          <span>Order value exceeds current available credit. Dealership owner approval may be required before dispatch.</span>
                        </div>
                      </div>
                    )}

                    {/* Dispatch Notes */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Packaging / Delivery Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="e.g. Keep ready for mechanic pickup at 3 PM..."
                        className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                      />
                    </div>

                    {/* Order on Khata CTA Button */}
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isSubmittingOrder}
                      className="w-full h-10 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-60 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Submitting Requisition...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Place Requisition on Khata</span>
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-center text-slate-400 font-mono">
                      🔒 Direct link with {dealership?.name || 'Showroom'} billing counter.
                    </p>

                  </div>
                )}

              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: DEALERSHIP & BANK INFO                            */}
          {/* ======================================================== */}
          {activeTab === 'DEALER' && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Showroom Contact Card */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <Store className="w-4 h-4 text-[#C81E1E]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Dealership Contact & Service Bay
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Showroom Trade Name</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{dealership?.name || 'Honda Dealership'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Workshop Bay Address</div>
                    <div className="font-medium text-slate-700 mt-0.5">{dealership?.address || 'Main Service Center'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Helpdesk Phone / WhatsApp</div>
                    <div className="font-bold text-slate-900 font-mono flex items-center gap-2 mt-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${dealership?.phone}`} className="text-blue-700 hover:underline">
                        +91 {dealership?.phone}
                      </a>
                    </div>
                  </div>
                  {dealership?.gstin && (
                    <div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Dealership GSTIN</div>
                      <div className="font-bold text-slate-900 font-mono mt-0.5">{dealership.gstin}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Direct Bank Settlement & QR Card */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-[#2563EB]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Direct Bank Settlement Account
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      NEFT / RTGS / IMPS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 mt-3.5 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Bank Name</div>
                      <div className="font-bold text-slate-900 mt-0.5">{dealership?.bankName || 'HDFC Bank Ltd'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">IFSC Code</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-bold text-slate-900 font-mono">{dealership?.ifscCode || 'HDFC0001234'}</span>
                        <button
                          onClick={() => handleCopy(dealership?.ifscCode || 'HDFC0001234', 'IFSC')}
                          className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                          title="Copy IFSC"
                        >
                          {copiedBankIfsc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="col-span-2 bg-white p-3 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Current Account Number</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-black text-slate-900 font-mono text-base tracking-wider">
                          {dealership?.accountNumber || '50200012345678'}
                        </span>
                        <button
                          onClick={() => handleCopy(dealership?.accountNumber || '50200012345678', 'ACC')}
                          className="h-6 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-700 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedBankAcc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedBankAcc ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Counter UPI VPA Box */}
                <div className="p-3 bg-white border border-slate-300 rounded-xl flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-extrabold">Instant Counter UPI VPA</div>
                    <div className="text-xs font-mono font-bold text-blue-700 mt-0.5">{upiId}</div>
                  </div>
                  <button
                    onClick={() => handleCopy(upiId, 'UPI')}
                    className="h-7.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUpi ? 'Copied!' : 'Copy UPI'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </main>

      {/* ============================================================ */}
      {/* 4. INSTANT PAYMENT SETTLEMENT MODAL                          */}
      {/* ============================================================ */}
      {isPayModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-2xs">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Settle Khata Balance</h3>
                    <p className="text-[11px] text-slate-500">Pay directly to {dealership?.name || 'Dealership'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPayModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Dynamic UPI QR Code */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center text-center space-y-2.5">
                <div className="w-38 h-38 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-center shadow-xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      `upi://pay?pa=${upiId}&pn=${encodeURIComponent(dealership?.name || 'Dealership')}&am=${customPayAmount || '0'}&cu=INR&tn=Khata Settlement`
                    )}`}
                    alt="UPI QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Scan using PhonePe, Google Pay, Paytm, or BHIM</p>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{upiId}</div>
                </div>
              </div>

              {/* Quick Preset Amount Buttons */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-500">Quick Amount Select</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {isDue && (
                    <button
                      type="button"
                      onClick={() => setCustomPayAmount((Number(absBalance) / 100).toFixed(2))}
                      className="py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold font-mono transition cursor-pointer"
                    >
                      Exact Due
                    </button>
                  )}
                  {['500', '1000', '2000', '5000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCustomPayAmount(Number(amt).toFixed(2))}
                      className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold font-mono transition cursor-pointer"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile UPI Deep Link */}
              <a
                href={upiPayUrl}
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Open in Mobile UPI App</span>
              </a>

              {/* Form */}
              <form onSubmit={handleSettlePayment} className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customPayAmount}
                      onChange={(e) => setCustomPayAmount(e.target.value)}
                      placeholder="e.g. 600.00"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                    <select
                      value={payMode}
                      onChange={(e: any) => setPayMode(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="BANK">Bank Transfer (IMPS/NEFT)</option>
                      <option value="ONLINE">Net Banking / Gateway</option>
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
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] outline-hidden"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPay}
                    className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmittingPay ? 'Recording...' : 'Record & Credit Khata'}</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        </ClientPortal>
      )}

      {/* ============================================================ */}
      {/* 5. ORDER REQUISITION PLACED SUCCESS MODAL                     */}
      {/* ============================================================ */}
      {orderSuccessData && (
        <ClientPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Requisition Placed Successfully!
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Order Ref: <span className="font-bold text-slate-800">{orderSuccessData.invoiceNumber}</span>
                </p>
              </div>

              {/* Order Info Card */}
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Items Ordered:</span>
                  <span className="font-bold text-slate-900">{orderSuccessData.itemCount} Spare Parts</span>
                </div>
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Total Requisition Value:</span>
                  <span className="font-bold font-mono text-slate-900 text-sm">₹{orderSuccessData.totalRupees}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-600 pt-1 border-t border-slate-200/80">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-emerald-700">Khata Credit Requisition</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {/* 1-Click WhatsApp Dispatch Button */}
                <a
                  href={orderSuccessData.waShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>Send Order Summary to Dealership on WhatsApp</span>
                </a>

                <button
                  onClick={() => setOrderSuccessData(null)}
                  className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Close & View Khata Passbook
                </button>
              </div>

            </div>
          </div>
        </ClientPortal>
      )}

    </div>
  );
}
