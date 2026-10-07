'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  Search, 
  Package, 
  UserPlus,
  Eye,
  MessageCircle,
  FileText,
  CreditCard,
  Wallet,
  BookOpen,
  QrCode,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Percent,
  Check,
  Zap,
  X,
  Edit3
} from 'lucide-react';
import { calculateInvoiceTax, formatPaiseToRupees, parseRupeesToPaise, LineItemInput } from '@/server/lib/tax';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';
import RazorpayModal from '@/app/components/RazorpayModal';
import ClientPortal from '@/app/components/ClientPortal';
import ModernLoader from '@/app/components/ModernLoader';
import PageSkeleton from '@/app/components/PageSkeleton';
import EditCustomerModal from '@/app/components/EditCustomerModal';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';

interface PosLineItem {
  id: string;
  productId?: string;
  name: string;
  partNumber?: string;
  qty: number;
  unit: string;
  rateRupees: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: string;
  gstRateBp: number;
  isTaxInclusive: boolean;
}

interface CustomerOption {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  balancePaise: string;
  creditLimitPaise: string;
  status: string;
  termsDays: number;
  address?: string;
  gstin?: string | null;
}

interface CatalogOption {
  id: string;
  name: string;
  partNumber: string;
  salePricePaise: string;
  gstRateBp: number;
  unit: string;
  stockQty: number;
  category?: string;
}

export default function QuickBillPosPage() {
  const { tenant } = useAuth();
  const { t, language } = useLanguage();
  
  // Data states
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Quick Catalog Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Line items state
  const [items, setItems] = useState<PosLineItem[]>([
    {
      id: '1',
      name: '',
      qty: 1,
      unit: 'pcs',
      rateRupees: '0.00',
      discountType: 'FLAT',
      discountValue: '0',
      gstRateBp: 1800,
      isTaxInclusive: false,
    }
  ]);

  // Payment states
  const [paymentMode, setPaymentMode] = useState<'FULL_CASH' | 'FULL_UPI' | 'FULL_KHATA' | 'SPLIT'>('FULL_CASH');
  const [cashAmount, setCashAmount] = useState<string>('0.00');
  const [upiAmount, setUpiAmount] = useState<string>('0.00');
  const [upiRef, setUpiRef] = useState<string>('');

  // Invoice / Success / Customer Modal states
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState<boolean>(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState<boolean>(false);
  const [isSuccessModal, setIsSuccessModal] = useState<boolean>(false);
  const [issuedInvoiceData, setIssuedInvoiceData] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [currentPreviewData, setCurrentPreviewData] = useState<InvoicePreviewData | null>(null);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState<boolean>(false);

  const placeOfSupply = tenant?.stateCode ? tenant.stateCode.split('-')[0].trim() : '27';

  const refreshCustomers = async () => {
    try {
      const res = await fetch('/api/v1/customers');
      if (res.ok) {
        const custData = await res.json();
        if (custData.customers) {
          setCustomers(custData.customers);
        }
      }
    } catch (e) {
      console.error('Error refreshing customers:', e);
    }
  };

  // Load Customers & Product Catalog
  useEffect(() => {
    async function loadData() {
      try {
        const [custRes, prodRes] = await Promise.all([
          fetch('/api/v1/customers'),
          fetch('/api/v1/products')
        ]);

        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.customers && custData.customers.length > 0) {
            setCustomers(custData.customers);
            const urlParamCustId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('customerId') : null;
            const matched = urlParamCustId && custData.customers.find((c: any) => c.id === urlParamCustId);
            setSelectedCustomerId(matched ? matched.id : custData.customers[0].id);
          }
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products && prodData.products.length > 0) {
            setCatalog(prodData.products);
            const first = prodData.products[0];
            setItems([
              {
                id: '1',
                productId: first.id,
                name: first.name,
                partNumber: first.partNumber,
                qty: 1,
                unit: first.unit || 'pcs',
                rateRupees: (Number(first.salePricePaise) / 100).toFixed(2),
                discountType: 'FLAT',
                discountValue: '0',
                gstRateBp: first.gstRateBp || 1800,
                isTaxInclusive: false,
              }
            ]);
          }
        }
      } catch (err) {
        console.error('Error loading POS initial data:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Keyboard shortcut listener: F2 for new line item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        addItemRow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || (customers[0] || {
      id: '',
      name: 'Counter Walk-in Customer',
      shopName: 'Cash Retail Counter',
      phone: '',
      balancePaise: '0',
      creditLimitPaise: '5000000',
      status: 'GREEN',
      termsDays: 0,
    });
  }, [customers, selectedCustomerId]);

  // Filter Catalog by search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return catalog.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.partNumber && p.partNumber.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [catalog, searchQuery]);

  // Calculation Engine via tax library
  const taxSummary = useMemo(() => {
    const lines: LineItemInput[] = items
      .filter(it => it.name.trim() !== '')
      .map(it => {
        const rate = parseRupeesToPaise(it.rateRupees || '0');
        const isPercent = it.discountType === 'PERCENT';
        return {
          rate,
          qty: it.qty,
          gstRateBp: it.gstRateBp,
          discountPercent: isPercent ? parseFloat(it.discountValue) || 0 : 0,
          discountPaise: !isPercent ? parseRupeesToPaise(it.discountValue || '0') : 0n,
          isTaxInclusive: it.isTaxInclusive,
        };
      });

    return calculateInvoiceTax(lines, placeOfSupply, placeOfSupply);
  }, [items, placeOfSupply]);

  // Payment Breakdown Calculation
  const grandTotalPaise = taxSummary.grandTotal;
  const cashPaise = paymentMode === 'FULL_CASH' 
    ? grandTotalPaise 
    : paymentMode === 'SPLIT' 
    ? parseRupeesToPaise(cashAmount || '0') 
    : 0n;
  const upiPaise = paymentMode === 'FULL_UPI' 
    ? grandTotalPaise 
    : paymentMode === 'SPLIT' 
    ? parseRupeesToPaise(upiAmount || '0') 
    : 0n;
  const totalPaidNowPaise = cashPaise + upiPaise;
  const balanceOnCreditPaise = grandTotalPaise > totalPaidNowPaise ? (grandTotalPaise - totalPaidNowPaise) : 0n;

  // Add Item Row
  const addItemRow = (prod?: CatalogOption) => {
    const newItem: PosLineItem = prod ? {
      id: Math.random().toString(),
      productId: prod.id,
      name: prod.name,
      partNumber: prod.partNumber,
      qty: 1,
      unit: prod.unit || 'pcs',
      rateRupees: (Number(prod.salePricePaise) / 100).toFixed(2),
      discountType: 'FLAT',
      discountValue: '0',
      gstRateBp: prod.gstRateBp || 1800,
      isTaxInclusive: false,
    } : {
      id: Math.random().toString(),
      name: '',
      qty: 1,
      unit: 'pcs',
      rateRupees: '0.00',
      discountType: 'FLAT',
      discountValue: '0',
      gstRateBp: 1800,
      isTaxInclusive: false,
    };

    setItems(prev => [...prev, newItem]);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  // Remove Item Row
  const removeItemRow = (id: string) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [{
          id: '1',
          name: '',
          qty: 1,
          unit: 'pcs',
          rateRupees: '0.00',
          discountType: 'FLAT',
          discountValue: '0',
          gstRateBp: 1800,
          isTaxInclusive: false,
        }];
      }
      return prev.filter(it => it.id !== id);
    });
  };

  // Update Item Row
  const updateItemRow = (id: string, field: keyof PosLineItem, value: any) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  // Handle Complete Bill Submission
  const handleIssueInvoice = async () => {
    const validItems = items.filter(it => it.name.trim() !== '');
    if (validItems.length === 0) {
      alert('Please add at least 1 spare part to generate invoice.');
      return;
    }

    try {
      setIsSubmittingBill(true);

      const payload = {
        customerId: selectedCustomer.id || undefined,
        customerName: selectedCustomer.shopName || selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerGstin: selectedCustomer.gstin,
        items: validItems.map(it => ({
          productId: it.productId,
          name: it.name,
          partNumber: it.partNumber,
          qty: it.qty,
          unit: it.unit,
          ratePaise: parseRupeesToPaise(it.rateRupees).toString(),
          discountType: it.discountType,
          discountValue: it.discountType === 'PERCENT' ? it.discountValue : parseRupeesToPaise(it.discountValue).toString(),
          gstRateBp: it.gstRateBp,
        })),
        cashPaidPaise: cashPaise.toString(),
        upiPaidPaise: upiPaise.toString(),
        upiRef: upiRef || undefined,
        creditBalancePaise: balanceOnCreditPaise.toString(),
      };

      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to issue invoice');
        return;
      }

      setIssuedInvoiceData({
        ...data.invoice,
        customer: selectedCustomer,
        items: validItems,
        taxSummary,
        cashPaidPaise: cashPaise,
        upiPaidPaise: upiPaise,
        creditBalancePaise: balanceOnCreditPaise,
        paidNowPaise: totalPaidNowPaise,
      });

      setIsSuccessModal(true);
      refreshCustomers();
    } catch (err: any) {
      console.error('Invoice issuance error:', err);
      alert(err.message || 'Error communicating with billing server');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  const startNextBill = () => {
    setIsSuccessModal(false);
    setItems([
      {
        id: Math.random().toString(),
        name: '',
        qty: 1,
        unit: 'pcs',
        rateRupees: '0.00',
        discountType: 'FLAT',
        discountValue: '0',
        gstRateBp: 1800,
        isTaxInclusive: false,
      }
    ]);
    setCashAmount('0.00');
    setUpiAmount('0.00');
    setUpiRef('');
    setPaymentMode('FULL_CASH');
  };

  const openCurrentBillPreview = () => {
    const validItems = items.filter(it => it.name.trim() !== '');
    const previewItems = validItems.map(it => {
        const rateP = parseRupeesToPaise(it.rateRupees || '0');
        const discVal = parseRupeesToPaise(it.discountValue || '0');
        const discP = it.discountType === 'PERCENT'
          ? (rateP * BigInt(parseInt(it.discountValue, 10) || 0)) / 100n
          : discVal;
        const totalP = (rateP - discP) * BigInt(it.qty || 1);

        return {
          productId: it.productId,
          name: it.name,
          partNumber: it.partNumber || 'SP-GEN-01',
          hsnCode: '8714',
          qty: it.qty,
          unit: it.unit,
          ratePaise: rateP.toString(),
          rateRupees: it.rateRupees,
          discountType: it.discountType,
          discountPaise: discP.toString(),
          gstRateBp: it.gstRateBp,
          taxableValuePaise: totalP.toString(),
          totalPaise: totalP.toString(),
        };
      });

    const previewInvoice: InvoicePreviewData = {
      invoiceNumber: issuedInvoiceData?.invoiceNumber || `${tenant?.settings?.invoicePrefix || 'INV/2026-27/'}DRAFT`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      placeOfSupply: tenant?.stateCode || '27 - Maharashtra',
      customer: {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        shopName: selectedCustomer.shopName,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address || 'Local Counter Customer',
        gstin: selectedCustomer.gstin || null,
      },
      items: previewItems.length > 0 ? previewItems : [
        {
          name: 'General Motorcycle Spare',
          partNumber: 'SP-GEN-01',
          qty: 1,
          unit: 'pcs',
          rateRupees: '0.00',
          ratePaise: '0',
          gstRateBp: 1800,
          totalPaise: '0',
        }
      ],
      subtotalPaise: (taxSummary?.subtotal || 0n).toString(),
      discountTotalPaise: (taxSummary?.discountTotal || 0n).toString(),
      taxableValuePaise: (taxSummary?.taxableValue || 0n).toString(),
      cgstPaise: (taxSummary?.cgst || 0n).toString(),
      sgstPaise: (taxSummary?.sgst || 0n).toString(),
      totalTaxPaise: (taxSummary?.totalTax || 0n).toString(),
      roundOffPaise: (taxSummary?.roundOff || 0n).toString(),
      grandTotalPaise: (taxSummary?.grandTotal || 0n).toString(),
      paidNowPaise: totalPaidNowPaise.toString(),
      cashPaidPaise: cashPaise.toString(),
      upiPaidPaise: upiPaise.toString(),
      upiRef: upiRef || '',
      creditBalancePaise: balanceOnCreditPaise.toString(),
      tenant: {
        name: tenant?.name || 'Royal Auto Spares & Wholesalers',
        legalName: tenant?.legalName || 'AutoLedger Spares Pvt Ltd',
        address: tenant?.address || 'Shop No. 12-15, Nana Peth Auto Market, Pune, Maharashtra - 411002',
        gstin: tenant?.gstin || '27ABCDE1234F1Z5',
        phone: tenant?.phone || '+91 9822100001',
        email: tenant?.email || 'billing@royalauto.com',
        stateCode: tenant?.stateCode || '27 - Maharashtra',
        bankName: tenant?.bankDetails?.bankName || 'HDFC Bank',
        accountNumber: tenant?.bankDetails?.accountNumber || '50200012345678',
        ifscCode: tenant?.bankDetails?.ifscCode || 'HDFC0001234',
        upiId: tenant?.upiId || 'royalauto@okhdfcbank',
      },
    };

    setCurrentPreviewData(previewInvoice);
    setIsPreviewModalOpen(true);
  };

  if (loadingInitial) {
    return (
      <PageSkeleton 
        title={language === 'hi' ? 'काउंटर पीओएस लोड हो रहा है...' : 'Initializing POS Billing...'} 
        subtitle={language === 'hi' ? 'इन्वेंट्री कैटलॉग और ग्राहक डेटा लोड हो रहा है...' : 'Fetching parts catalog, real-time rates, and customer accounts...'} 
      />
    );
  }

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER: BILL INFO & CUSTOMER SELECTION */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Left: Bill Meta */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                {language === 'hi' ? 'काउंटर बिक्री बिलिंग' : 'Fast Counter POS Billing'}
              </h1>
              <span className="text-[10px] font-mono font-semibold bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded border border-[#E2E8F0]">
                {tenant?.settings?.invoicePrefix || 'INV/2026-27/'}DRAFT
              </span>
            </div>
            <div className="text-[11px] text-[#64748B]">
              Real-time GST calculations · Instant inventory allocation · Double-entry khata
            </div>
          </div>
        </div>

        {/* Right: Customer & Khata Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-md py-1.5 px-3 text-xs font-medium text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shopName} ({c.name}) · {c.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Edit Customer Button */}
          {selectedCustomer.id && (
            <button
              type="button"
              onClick={() => setIsEditCustomerOpen(true)}
              className="h-8 px-2.5 flex items-center gap-1 bg-white hover:bg-[#F8F9FA] text-[#334155] text-xs font-medium rounded-md border border-[#CBD5E1] transition shadow-2xs"
              title="Edit Selected Customer Details"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {/* Current Khata Balance Pill */}
          {selectedCustomer.id && (
            <div className="px-2.5 py-1 bg-[#FFFBEB] border border-[#FEF3C7] rounded-md flex items-center gap-1.5 text-xs font-semibold text-[#92400E] font-mono tabular-nums shadow-2xs">
              <BookOpen className="w-3 h-3 text-[#D97706]" />
              <span>Due: {formatPaiseToRupees(Number(selectedCustomer.balancePaise) || 0)}</span>
            </div>
          )}

          <Link
            href="/invoices"
            className="h-8 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-[#F8F9FA] text-[#334155] font-medium text-xs rounded-md border border-[#CBD5E1] transition shadow-2xs"
            title="Search Past Bills & Invoices"
          >
            <FileText className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Past Invoices</span>
          </Link>

          <Link
            href="/customers"
            className="h-8 w-8 flex items-center justify-center bg-white hover:bg-[#F8F9FA] text-[#334155] rounded-md border border-[#CBD5E1] transition shadow-2xs"
            title={t('khata.add_customer', 'Add New Customer / Garage')}
          >
            <UserPlus className="w-3.5 h-3.5 text-[#64748B]" />
          </Link>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* LEFT PANEL (8 COLS): PARTS SEARCH & LINE ITEMS TABLE */}
        <div className="lg:col-span-8 space-y-3.5">
          
          {/* Quick Auto-Complete Part Search Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-2.5 relative">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder={t('pos.search_parts', 'Type part name, OEM SKU, or scan barcode...')}
                className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl py-2 pl-9 pr-3 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden transition shadow-2xs"
              />
            </div>

            {/* Live Search Results Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute left-3.5 right-3.5 top-[52px] bg-white rounded-xl shadow-xl border border-[#CBD5E1] divide-y divide-[#F1F5F9] z-30 max-h-56 overflow-y-auto">
                {searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => addItemRow(prod)}
                    className="p-2.5 hover:bg-[#F8F9FA] flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[#0F172A]">{prod.name}</div>
                      <div className="text-[10px] text-[#64748B] font-mono">SKU: {prod.partNumber} · Stock: {prod.stockQty} {prod.unit}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#0F172A] tabular-nums">₹{(Number(prod.salePricePaise) / 100).toFixed(2)}</div>
                      <span className="text-[9px] text-[#166534] font-semibold bg-[#F0FDF4] px-1.5 py-0.5 rounded-md border border-[#DCFCE7]">+ Add</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fast-Add Popular Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider shrink-0 mr-0.5">Quick Add:</span>
              {catalog.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItemRow(p)}
                  className="shrink-0 px-2.5 py-1 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] font-medium rounded-lg text-[11px] border border-[#E2E8F0] transition flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-2.5 h-2.5 text-[#C81E1E]" />
                  <span>{p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}</span>
                  <span className="font-mono tabular-nums text-[#64748B]">₹{(Number(p.salePricePaise) / 100).toFixed(0)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Line Items Table Container */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">{t('pos.item_name', 'Item Description & SKU')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">{t('pos.quantity', 'Qty')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-3 w-26 text-right">{t('pos.rate', 'Rate (₹)')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">GST</th>
                    <th className="py-2.5 px-3 w-26 text-right">{t('pos.amount', 'Amount (₹)')}</th>
                    <th className="py-2.5 px-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
                  {items.map((item, idx) => {
                    const rateNum = parseFloat(item.rateRupees) || 0;
                    const discNum = item.discountType === 'PERCENT' 
                      ? (rateNum * (parseFloat(item.discountValue) || 0)) / 100 
                      : (parseFloat(item.discountValue) || 0);
                    const lineTotal = Math.max(0, (rateNum - discNum) * (item.qty || 1));

                    return (
                      <tr key={item.id} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="py-2 px-2.5 text-center font-mono text-[#94A3B8] text-[11px]">{idx + 1}</td>
                        
                        {/* Name & SKU */}
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItemRow(item.id, 'name', e.target.value)}
                            placeholder="Enter item description..."
                            className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs font-medium text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItemRow(item.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 text-center bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 font-semibold font-mono tabular-nums text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-2 text-center">
                          <select
                            value={item.unit}
                            onChange={(e) => updateItemRow(item.id, 'unit', e.target.value)}
                            className="bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 px-1.5 text-[11px] font-medium text-[#334155] outline-hidden shadow-2xs"
                          >
                            <option value="pcs">pcs</option>
                            <option value="set">set</option>
                            <option value="can">can</option>
                            <option value="ltr">ltr</option>
                            <option value="kit">kit</option>
                          </select>
                        </td>

                        {/* Rate (₹) */}
                        <td className="py-2 px-2.5 text-right">
                          <input
                            type="text"
                            value={item.rateRupees}
                            onChange={(e) => updateItemRow(item.id, 'rateRupees', e.target.value)}
                            className="w-22 text-right bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 px-2 font-mono tabular-nums font-semibold text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                          />
                        </td>

                        {/* GST Slab */}
                        <td className="py-2 px-2 text-center">
                          <select
                            value={item.gstRateBp}
                            onChange={(e) => updateItemRow(item.id, 'gstRateBp', parseInt(e.target.value))}
                            className="bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 px-1.5 text-[11px] font-medium font-mono text-[#334155] outline-hidden shadow-2xs"
                          >
                            <option value={1800}>18%</option>
                            <option value={2800}>28%</option>
                            <option value={1200}>12%</option>
                            <option value={500}>5%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>

                        {/* Line Total */}
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-[#0F172A]">
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        {/* Delete */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(item.id)}
                            className="p-1 text-[#94A3B8] hover:text-[#DC2626] rounded-md transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Row: + Add Row Button */}
            <div className="p-3 border-t border-[#F1F5F9] bg-[#F8F9FA] flex items-center justify-between">
              <button
                type="button"
                onClick={() => addItemRow()}
                className="h-8 inline-flex items-center gap-1.5 px-3.5 bg-white hover:bg-[#F1F5F9] text-[#0F172A] font-semibold text-xs rounded-md border border-[#CBD5E1] shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5 text-[#C81E1E]" />
                <span>Add Item Row (F2)</span>
              </button>

              <span className="text-[11px] text-[#64748B]">
                {items.length} line items on bill
              </span>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL (4 COLS): SETTLEMENT & CHECKOUT */}
        <div className="lg:col-span-4 space-y-3.5">
          
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs space-y-4 sticky top-16">
            
            <div className="border-b border-[#F1F5F9] pb-2.5">
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Settlement & Checkout</span>
              </h2>
            </div>

            {/* Quick 1-Click Payment Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">{t('pos.payment_type', 'Payment Mode:')}</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL_CASH')}
                  className={`h-9 px-2.5 rounded-md border transition-colors flex items-center justify-center gap-1.5 text-xs shadow-2xs ${
                    paymentMode === 'FULL_CASH' 
                      ? 'bg-[#0F172A] text-white border-[#0F172A] font-semibold' 
                      : 'bg-[#F8F9FA] text-[#334155] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  <span>💵 Cash</span>
                  {paymentMode === 'FULL_CASH' && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL_UPI')}
                  className={`h-9 px-2.5 rounded-md border transition-colors flex items-center justify-center gap-1.5 text-xs shadow-2xs ${
                    paymentMode === 'FULL_UPI' 
                      ? 'bg-[#0F172A] text-white border-[#0F172A] font-semibold' 
                      : 'bg-[#F8F9FA] text-[#334155] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  <span>📱 UPI / QR</span>
                  {paymentMode === 'FULL_UPI' && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL_KHATA')}
                  className={`h-9 px-2.5 rounded-md border transition-colors flex items-center justify-center gap-1.5 text-xs shadow-2xs ${
                    paymentMode === 'FULL_KHATA' 
                      ? 'bg-[#D97706] text-white border-[#D97706] font-semibold' 
                      : 'bg-[#F8F9FA] text-[#334155] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  <span>📖 Khata</span>
                  {paymentMode === 'FULL_KHATA' && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('SPLIT')}
                  className={`h-9 px-2.5 rounded-md border transition-colors flex items-center justify-center gap-1.5 text-xs shadow-2xs ${
                    paymentMode === 'SPLIT' 
                      ? 'bg-[#0F172A] text-white border-[#0F172A] font-semibold' 
                      : 'bg-[#F8F9FA] text-[#334155] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                >
                  <span>⚡ Split</span>
                  {paymentMode === 'SPLIT' && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            </div>

            {/* FULL_UPI QR action */}
            {paymentMode === 'FULL_UPI' && (
              <div className="bg-[#EFF6FF] p-2.5 rounded-md border border-[#DBEAFE] flex items-center justify-between text-xs shadow-2xs">
                <span className="text-[11px] text-[#1E40AF] font-medium">Dynamic QR Link:</span>
                <button
                  type="button"
                  onClick={() => setIsRazorpayModalOpen(true)}
                  className="h-7 px-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[10px] rounded-md transition flex items-center gap-1 shadow-2xs"
                >
                  <QrCode className="w-3 h-3" />
                  <span>Show QR</span>
                </button>
              </div>
            )}

            {/* Split / Custom Input */}
            {paymentMode === 'SPLIT' && (
              <div className="bg-[#F8F9FA] p-3 rounded-md border border-[#E2E8F0] space-y-2 text-xs shadow-2xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">Cash Paid (₹)</label>
                    <input
                      type="text"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-md p-1.5 font-mono tabular-nums font-semibold text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">UPI Paid (₹)</label>
                    <input
                      type="text"
                      value={upiAmount}
                      onChange={(e) => setUpiAmount(e.target.value)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-md p-1.5 font-mono tabular-nums font-semibold text-[#0F172A]"
                    />
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                    placeholder="Optional UPI Ref / UTR..."
                    className="w-full bg-white border border-[#CBD5E1] rounded-md p-1.5 text-[11px] text-[#334155]"
                  />
                </div>
              </div>
            )}

            {/* Financial Totals Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-[#F1F5F9] text-xs">
              <div className="flex justify-between text-[#64748B]">
                <span>{t('pos.subtotal', 'Taxable Value')}:</span>
                <span className="font-mono tabular-nums font-semibold text-[#334155]">
                  {formatPaiseToRupees(taxSummary.taxableValue)}
                </span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>{t('pos.total_tax', 'GST (CGST + SGST)')}:</span>
                <span className="font-mono tabular-nums font-semibold text-[#334155]">
                  {formatPaiseToRupees(taxSummary.totalTax)}
                </span>
              </div>
              {taxSummary.roundOff !== 0n && (
                <div className="flex justify-between text-[#64748B]">
                  <span>Round Off:</span>
                  <span className="font-mono tabular-nums font-semibold text-[#64748B]">
                    {formatPaiseToRupees(taxSummary.roundOff)}
                  </span>
                </div>
              )}

              {/* GRAND TOTAL */}
              <div className="border-t border-[#E2E8F0] pt-2 flex justify-between items-baseline">
                <span className="font-bold text-[#0F172A] text-xs">{t('pos.grand_total', 'Grand Total')}:</span>
                <span className="text-xl font-bold text-[#0F172A] font-mono tabular-nums tracking-tight">
                  {formatPaiseToRupees(taxSummary.grandTotal)}
                </span>
              </div>

              {/* Paid vs Due Pill */}
              <div className="pt-1.5 flex justify-between text-[11px] font-mono tabular-nums font-semibold">
                <span className="text-[#166534]">Paid: {formatPaiseToRupees(totalPaidNowPaise)}</span>
                {balanceOnCreditPaise > 0n && (
                  <span className="text-[#92400E]">Khata: {formatPaiseToRupees(balanceOnCreditPaise)}</span>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleIssueInvoice}
                disabled={isSubmittingBill}
                className="w-full h-10 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-60 text-white font-bold text-xs rounded-md shadow-2xs transition flex items-center justify-center gap-2"
              >
                {isSubmittingBill ? (
                  <>
                    <ModernLoader size="xs" />
                    <span>{language === 'hi' ? 'बिल जारी हो रहा है...' : 'Issuing Bill & Recording...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'hi' ? 'बिल जारी करें और बिक्री दर्ज करें' : 'Issue Bill & Record Sale'}</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openCurrentBillPreview}
                  className="h-8 bg-white hover:bg-[#F8F9FA] text-[#334155] font-medium rounded-md text-[11px] border border-[#CBD5E1] transition flex items-center justify-center gap-1 shadow-2xs"
                >
                  <Eye className="w-3 h-3 text-[#64748B]" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={openCurrentBillPreview}
                  className="h-8 bg-white hover:bg-[#F8F9FA] text-[#334155] font-medium rounded-md text-[11px] border border-[#CBD5E1] transition flex items-center justify-center gap-1 shadow-2xs"
                >
                  <Printer className="w-3 h-3 text-[#64748B]" />
                  <span>Print A4</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. SUCCESS / BILL CONFIRMATION MODAL */}
      {isSuccessModal && issuedInvoiceData && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white border border-[#CBD5E1] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl relative">
              <div className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Sale Bill Issued & Recorded</h3>
                    <div className="text-xs font-mono font-semibold text-[#166534]">{issuedInvoiceData.invoiceNumber}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSuccessModal(false)}
                  className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A]"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-[#F8F9FA] p-3.5 rounded-md border border-[#E2E8F0] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Customer:</span>
                  <span className="font-semibold text-[#0F172A]">{issuedInvoiceData.customer?.shopName || 'Walk-in Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Grand Total:</span>
                  <span className="font-mono tabular-nums font-bold text-[#0F172A]">
                    {formatPaiseToRupees(issuedInvoiceData?.taxSummary?.grandTotal || issuedInvoiceData?.grandTotalPaise || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Paid at Counter:</span>
                  <span className="font-mono tabular-nums font-bold text-[#166534]">
                    {formatPaiseToRupees(issuedInvoiceData.paidNowPaise)}
                  </span>
                </div>
                {issuedInvoiceData.creditBalancePaise > 0n && (
                  <div className="flex justify-between border-t border-[#E2E8F0] pt-1.5">
                    <span className="text-[#64748B]">Added to Khata Due:</span>
                    <span className="font-mono tabular-nums font-bold text-[#92400E]">
                      {formatPaiseToRupees(issuedInvoiceData.creditBalancePaise)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={openCurrentBillPreview}
                  className="h-8.5 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold rounded-md text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View / Print PDF</span>
                </button>
                <button
                  onClick={openCurrentBillPreview}
                  className="h-8.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold rounded-md text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Bill</span>
                </button>
                {issuedInvoiceData.creditBalancePaise > 0n && (
                  <button
                    onClick={() => setIsRazorpayModalOpen(true)}
                    className="h-8.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] font-semibold rounded-md text-xs flex items-center justify-center gap-1.5 border border-[#BFDBFE] transition col-span-2 shadow-2xs"
                  >
                    <Zap className="w-3 h-3 text-[#2563EB]" />
                    <span>Send Razorpay Payment Link (WhatsApp)</span>
                  </button>
                )}
              </div>

              <button
                onClick={startNextBill}
                className="w-full h-8.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold rounded-md text-xs transition shadow-2xs"
              >
                Start Next Bill (F2)
              </button>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={currentPreviewData}
      />

      {/* Razorpay Dynamic Payment Modal */}
      {isRazorpayModalOpen && (
        <RazorpayModal
          isOpen={isRazorpayModalOpen}
          onClose={() => setIsRazorpayModalOpen(false)}
          customerId={selectedCustomer?.id}
          customerName={selectedCustomer?.shopName || selectedCustomer?.name || 'Walk-in Customer'}
          customerPhone={selectedCustomer?.phone || ''}
          invoiceNumber={issuedInvoiceData?.invoiceNumber}
          defaultAmountRupees={(Number(issuedInvoiceData?.taxSummary?.grandTotal || issuedInvoiceData?.grandTotalPaise || taxSummary?.grandTotal || 0) / 100).toFixed(2)}
        />
      )}

      {/* Edit Customer Modal */}
      {isEditCustomerOpen && selectedCustomer.id && (
        <EditCustomerModal
          isOpen={isEditCustomerOpen}
          onClose={() => setIsEditCustomerOpen(false)}
          customer={selectedCustomer}
          onSuccess={() => {
            refreshCustomers();
          }}
        />
      )}
    </div>
  );
}
