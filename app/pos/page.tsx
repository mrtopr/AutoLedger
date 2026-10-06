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
  Check
} from 'lucide-react';
import { calculateInvoiceTax, formatPaiseToRupees, parseRupeesToPaise, LineItemInput } from '@/server/lib/tax';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';
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

  // Invoice / Success Modal states
  const [isSubmittingBill, setIsSubmittingBill] = useState<boolean>(false);
  const [isSuccessModal, setIsSuccessModal] = useState<boolean>(false);
  const [issuedInvoiceData, setIssuedInvoiceData] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [currentPreviewData, setCurrentPreviewData] = useState<InvoicePreviewData | null>(null);

  const placeOfSupply = tenant?.stateCode ? tenant.stateCode.split('-')[0].trim() : '27';

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
            setSelectedCustomerId(custData.customers[0].id);
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

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0] || {
    id: '',
    name: 'Walk-in Customer',
    shopName: 'Walk-in Customer',
    phone: '',
    balancePaise: '0',
    creditLimitPaise: '0',
    status: 'GREEN',
    termsDays: 0,
  };

  // Real-time tax and totals calculation
  const taxSummary = useMemo(() => {
    const calculationInputs: LineItemInput[] = items.map((item) => {
      const parsedRate = parseRupeesToPaise(item.rateRupees);
      const discountPaise = item.discountType === 'FLAT' ? parseRupeesToPaise(item.discountValue) : 0n;
      const discountPercent = item.discountType === 'PERCENT' ? parseFloat(item.discountValue) || 0 : 0;

      return {
        qty: item.qty || 0,
        rate: parsedRate,
        discountPaise,
        discountPercent,
        gstRateBp: item.gstRateBp,
        isTaxInclusive: item.isTaxInclusive,
      };
    });

    return calculateInvoiceTax(calculationInputs, placeOfSupply, placeOfSupply);
  }, [items, placeOfSupply]);

  // Sync payment amounts whenever grand total or payment mode changes
  const grandTotalRupees = (Number(taxSummary.grandTotal) / 100).toFixed(2);

  useEffect(() => {
    if (paymentMode === 'FULL_CASH') {
      setCashAmount(grandTotalRupees);
      setUpiAmount('0.00');
    } else if (paymentMode === 'FULL_UPI') {
      setCashAmount('0.00');
      setUpiAmount(grandTotalRupees);
    } else if (paymentMode === 'FULL_KHATA') {
      setCashAmount('0.00');
      setUpiAmount('0.00');
    }
  }, [paymentMode, grandTotalRupees]);

  const cashPaise = parseRupeesToPaise(cashAmount);
  const upiPaise = parseRupeesToPaise(upiAmount);
  const totalPaidNowPaise = cashPaise + upiPaise;
  const balanceOnCreditPaise = taxSummary.grandTotal > totalPaidNowPaise ? taxSummary.grandTotal - totalPaidNowPaise : 0n;

  // Add Item Row
  const addItemRow = (product?: CatalogOption) => {
    const rateRupees = product ? (Number(product.salePricePaise) / 100).toFixed(2) : '0.00';
    const newItem: PosLineItem = {
      id: Date.now().toString(),
      productId: product?.id,
      name: product?.name || '',
      partNumber: product?.partNumber || '',
      qty: 1,
      unit: product?.unit || 'pcs',
      rateRupees: rateRupees,
      discountType: 'FLAT',
      discountValue: '0',
      gstRateBp: product?.gstRateBp || 1800,
      isTaxInclusive: false,
    };
    setItems((prev) => [...prev, newItem]);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const removeItemRow = (id: string) => {
    if (items.length <= 1) {
      setItems([{ id: Date.now().toString(), name: '', qty: 1, unit: 'pcs', rateRupees: '0.00', discountType: 'FLAT', discountValue: '0', gstRateBp: 1800, isTaxInclusive: false }]);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemRow = (id: string, field: keyof PosLineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      })
    );
  };

  // Keyboard shortcut (F2 = Add Row)
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

  // Filter catalog products for search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return catalog.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.partNumber.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [searchQuery, catalog]);

  // Issue Bill & Save to Database
  const handleIssueInvoice = async () => {
    const validItems = items.filter(it => it.name.trim() !== '' || Number(it.rateRupees) > 0);
    if (validItems.length === 0) {
      alert('Please add at least one spare part or labor item.');
      return;
    }

    try {
      setIsSubmittingBill(true);

      const payloadItems = validItems.map((item) => ({
        productId: item.productId,
        name: item.name || 'Motorcycle Spare Part',
        partNumber: item.partNumber,
        qty: item.qty,
        unit: item.unit,
        ratePaise: parseRupeesToPaise(item.rateRupees).toString(),
        discountPaise: item.discountType === 'FLAT' ? parseRupeesToPaise(item.discountValue).toString() : '0',
        discountPercent: item.discountType === 'PERCENT' ? parseFloat(item.discountValue) || 0 : 0,
        gstRateBp: item.gstRateBp,
        isTaxInclusive: item.isTaxInclusive,
      }));

      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id || null,
          placeOfSupply: placeOfSupply,
          items: payloadItems,
          cashPaidPaise: cashPaise.toString(),
          upiPaidPaise: upiPaise.toString(),
          upiRef: upiRef,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to issue invoice');
        return;
      }

      const invoiceRecord = {
        invoiceNumber: data.invoice?.invoiceNumber || `${tenant?.settings?.invoicePrefix || 'INV/2026-27/'}${Math.floor(1000 + Math.random() * 9000)}`,
        customer: selectedCustomer,
        items: validItems,
        taxSummary: taxSummary,
        paidNowPaise: totalPaidNowPaise,
        cashPaidPaise: cashPaise,
        upiPaidPaise: upiPaise,
        upiRef: upiRef,
        creditBalancePaise: balanceOnCreditPaise,
        newTotalCustomerBalancePaise: BigInt(selectedCustomer.balancePaise || 0) + balanceOnCreditPaise,
        issuedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };

      setIssuedInvoiceData(invoiceRecord);
      setIsSuccessModal(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  const startNextBill = () => {
    setIsSuccessModal(false);
    setItems([
      {
        id: Date.now().toString(),
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
    setPaymentMode('FULL_CASH');
    setCashAmount('0.00');
    setUpiAmount('0.00');
    setUpiRef('');
  };

  // Open Preview Modal
  const openCurrentBillPreview = () => {
    const previewItems = items
      .filter((it) => it.name.trim() !== '' || Number(it.rateRupees) > 0)
      .map((it) => {
        const rateP = parseRupeesToPaise(it.rateRupees);
        const discP = it.discountType === 'FLAT' ? parseRupeesToPaise(it.discountValue) : 0n;
        const totalP = (rateP - discP) * BigInt(it.qty || 1);
        return {
          name: it.name || 'Motorcycle Spare Part',
          partNumber: it.partNumber,
          qty: it.qty,
          unit: it.unit,
          rateRupees: it.rateRupees,
          ratePaise: rateP.toString(),
          discountValue: it.discountValue,
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      
      {/* 1. TOP HEADER: CLEAN BILL INFO & CUSTOMER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Bill Meta */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#C81E1E] flex items-center justify-center font-bold shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                {language === 'hi' ? 'नया काउंटर बिक्री बिल' : 'New Counter Sale Bill'}
              </h1>
              <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {tenant?.settings?.invoicePrefix || 'INV/2026-27/'}DRAFT
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {language === 'hi' 
                ? 'जीएसटी गणना · लाइव स्टॉक डिडक्शन · दोहरा खाता प्रविष्टि' 
                : 'Instant GST calculation · Auto-inventory decrement · Double-entry khata'}
            </div>
          </div>
        </div>

        {/* Right: Customer & Khata Pill */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[260px] sm:min-w-[320px]">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-800 transition"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shopName} ({c.name}) · {c.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Current Khata Balance Pill */}
          {selectedCustomer.id && (
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'hi' ? 'बकाया खाता:' : 'Khata Due:'} {formatPaiseToRupees(Number(selectedCustomer.balancePaise) || 0)}</span>
            </div>
          )}

          <Link
            href="/customers"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title={t('khata.add_customer', 'Add New Customer / Garage')}
          >
            <UserPlus className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN ERGONOMIC WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT PANEL (8 COLS): PARTS SEARCH & LINE ITEMS TABLE */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Quick Auto-Complete Part Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-2.5 relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder={t('pos.search_parts', 'Type part name, OEM SKU, or scan barcode...')}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 transition"
              />
            </div>

            {/* Live Search Results Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute left-3.5 right-3.5 top-14 bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 z-30 max-h-60 overflow-y-auto">
                {searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => addItemRow(prod)}
                    className="p-2.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{prod.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: {prod.partNumber} · Stock: {prod.stockQty} {prod.unit}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-slate-900">₹{(Number(prod.salePricePaise) / 100).toFixed(2)}</div>
                      <span className="text-[9px] text-slate-900 font-medium bg-slate-100 px-1.5 py-0.5 rounded">{language === 'hi' ? '+ जोड़ें' : '+ Add'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fast-Add Popular Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider shrink-0 mr-1">{language === 'hi' ? 'त्वरित जोड़ें:' : 'Fast Add:'}</span>
              {catalog.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItemRow(p)}
                  className="shrink-0 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-[11px] transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-[#DC2626]" />
                  <span>{p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}</span>
                  <span className="font-mono text-slate-500">₹{(Number(p.salePricePaise) / 100).toFixed(0)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Line Items Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">{t('pos.item_name', 'Item Description & OEM SKU')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">{t('pos.quantity', 'Qty')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">{language === 'hi' ? 'इकाई' : 'Unit'}</th>
                    <th className="py-2.5 px-3 w-24 text-right">{t('pos.rate', 'Rate (₹)')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">GST</th>
                    <th className="py-2.5 px-3 w-24 text-right">{t('pos.amount', 'Amount (₹)')}</th>
                    <th className="py-2.5 px-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {items.map((item, idx) => {
                    const rateNum = parseFloat(item.rateRupees) || 0;
                    const discNum = item.discountType === 'PERCENT' 
                      ? (rateNum * (parseFloat(item.discountValue) || 0)) / 100 
                      : (parseFloat(item.discountValue) || 0);
                    const lineTotal = Math.max(0, (rateNum - discNum) * (item.qty || 1));

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                        
                        {/* Name & SKU */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItemRow(item.id, 'name', e.target.value)}
                            placeholder={language === 'hi' ? 'पार्ट या सर्विस का नाम दर्ज करें...' : 'Enter item name or custom work...'}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-800 transition"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItemRow(item.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 text-center bg-slate-50 border border-slate-300 rounded-lg py-1 font-semibold font-mono text-slate-900 focus:bg-white focus:border-slate-800"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2.5 px-2 text-center">
                          <select
                            value={item.unit}
                            onChange={(e) => updateItemRow(item.id, 'unit', e.target.value)}
                            className="bg-slate-50 border border-slate-300 rounded-lg py-1 px-1 text-[11px] font-medium text-slate-700"
                          >
                            <option value="pcs">pcs</option>
                            <option value="set">set</option>
                            <option value="can">can</option>
                            <option value="ltr">ltr</option>
                            <option value="kit">kit</option>
                          </select>
                        </td>

                        {/* Rate (₹) */}
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="text"
                            value={item.rateRupees}
                            onChange={(e) => updateItemRow(item.id, 'rateRupees', e.target.value)}
                            className="w-20 text-right bg-slate-50 border border-slate-300 rounded-lg py-1 px-2 font-mono font-semibold text-slate-900 focus:bg-white focus:border-slate-800"
                          />
                        </td>

                        {/* GST Slab */}
                        <td className="py-2.5 px-2 text-center">
                          <select
                            value={item.gstRateBp}
                            onChange={(e) => updateItemRow(item.id, 'gstRateBp', parseInt(e.target.value))}
                            className="bg-slate-50 border border-slate-300 rounded-lg py-1 px-1 text-[11px] font-semibold font-mono text-slate-700"
                          >
                            <option value={1800}>18%</option>
                            <option value={2800}>28%</option>
                            <option value={1200}>12%</option>
                            <option value={500}>5%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>

                        {/* Line Total */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        {/* Delete */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition"
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
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => addItemRow()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs rounded-xl border border-slate-300 shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>{language === 'hi' ? '+ नया आइटम जोड़ें (F2)' : 'Add Item Row (F2)'}</span>
              </button>

              <span className="text-[11px] text-slate-500 font-medium">
                {items.length} {language === 'hi' ? 'आइटम्स बिल पर' : 'items on bill'}
              </span>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL (4 COLS): STICKY SETTLEMENT & INSTANT CHECKOUT */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Bill Summary & Payment Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 sticky top-20">
            
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>{language === 'hi' ? 'भुगतान एवं त्वरित बिलिंग' : 'Settlement & Instant Payment'}</span>
              </h2>
            </div>

            {/* Quick 1-Click Payment Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">{t('pos.payment_type', 'Payment Mode:')}</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL_CASH')}
                  className={`py-2 px-2.5 rounded-xl border transition flex items-center justify-center gap-1.5 ${
                    paymentMode === 'FULL_CASH' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>💵 {t('pos.cash_payment', 'Cash')}</span>
                  {paymentMode === 'FULL_CASH' && <Check className="w-3 h-3 text-emerald-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL_UPI')}
                  className={`py-2 px-2.5 rounded-xl border transition flex items-center justify-center gap-1.5 ${
                    paymentMode === 'FULL_UPI' 
                      ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-500/20' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>📱 {t('pos.upi_payment', 'UPI / QR')}</span>
                  {paymentMode === 'FULL_UPI' && <Check className="w-3 h-3 text-blue-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL_KHATA')}
                  className={`py-2 px-2.5 rounded-xl border transition flex items-center justify-center gap-1.5 ${
                    paymentMode === 'FULL_KHATA' 
                      ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>📖 {t('pos.credit_khata', 'Credit / Khata')}</span>
                  {paymentMode === 'FULL_KHATA' && <Check className="w-3 h-3 text-amber-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('SPLIT')}
                  className={`py-2 px-2.5 rounded-xl border transition flex items-center justify-center gap-1.5 ${
                    paymentMode === 'SPLIT' 
                      ? 'bg-purple-50 text-purple-800 border-purple-300 ring-2 ring-purple-500/20' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>⚡ {t('pos.split_payment', 'Split / Part')}</span>
                  {paymentMode === 'SPLIT' && <Check className="w-3 h-3 text-purple-600" />}
                </button>
              </div>
            </div>

            {/* Split / Custom Input Details if Selected */}
            {paymentMode === 'SPLIT' && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5 text-xs animate-in fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">{language === 'hi' ? 'नकद भुगतान (₹)' : 'Cash Paid (₹)'}</label>
                    <input
                      type="text"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">{language === 'hi' ? 'UPI भुगतान (₹)' : 'UPI Paid (₹)'}</label>
                    <input
                      type="text"
                      value={upiAmount}
                      onChange={(e) => setUpiAmount(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono font-semibold text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                    placeholder={language === 'hi' ? 'वैकल्पिक UPI रेफरेंस नंबर...' : 'Optional UPI UTR / Ref Number...'}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-slate-700"
                  />
                </div>
              </div>
            )}

            {/* Financial Totals Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>{t('pos.subtotal', 'Taxable Value')}:</span>
                <span className="font-mono-numeric font-semibold text-slate-800">
                  {formatPaiseToRupees(taxSummary.taxableValue)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{t('pos.total_tax', 'GST (CGST + SGST)')}:</span>
                <span className="font-mono-numeric font-semibold text-slate-800">
                  {formatPaiseToRupees(taxSummary.totalTax)}
                </span>
              </div>
              {taxSummary.roundOff !== 0n && (
                <div className="flex justify-between text-slate-500">
                  <span>{language === 'hi' ? 'राउंड ऑफ:' : 'Round Off:'}</span>
                  <span className="font-mono-numeric font-semibold text-slate-700">
                    {formatPaiseToRupees(taxSummary.roundOff)}
                  </span>
                </div>
              )}

              {/* GRAND TOTAL */}
              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 text-sm">{t('pos.grand_total', 'Grand Total')}:</span>
                <span className="text-2xl font-bold text-slate-900 font-mono-numeric tracking-tight">
                  {formatPaiseToRupees(taxSummary.grandTotal)}
                </span>
              </div>

              {/* Paid vs Due Pill */}
              <div className="pt-1.5 flex justify-between text-xs font-mono font-medium">
                <span className="text-emerald-700">{language === 'hi' ? 'जमा राशि:' : 'Paid Now:'} {formatPaiseToRupees(totalPaidNowPaise)}</span>
                {balanceOnCreditPaise > 0n && (
                  <span className="text-amber-700">{language === 'hi' ? 'खाता उधार:' : 'On Khata:'} {formatPaiseToRupees(balanceOnCreditPaise)}</span>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleIssueInvoice}
                disabled={isSubmittingBill}
                className="w-full py-3 bg-[#C81E1E] hover:bg-[#991B1B] disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isSubmittingBill ? (language === 'hi' ? 'बिल बन रहा है...' : 'Issuing Bill...') : (language === 'hi' ? 'बिल बनाएं व बिक्री दर्ज करें' : 'Issue Bill & Record Sale')}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openCurrentBillPreview}
                  className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-xl text-xs border border-slate-200 transition flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-700" />
                  <span>{language === 'hi' ? 'बिल देखें' : 'Preview Bill'}</span>
                </button>

                <button
                  type="button"
                  onClick={openCurrentBillPreview}
                  className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-xl text-xs border border-slate-200 transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'प्रिंट A4 / PDF' : 'Print A4 / PDF'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. SUCCESS / BILL CONFIRMATION MODAL */}
      {isSuccessModal && issuedInvoiceData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sale Bill Issued & Recorded!</h3>
                <div className="text-xs font-mono font-bold text-emerald-700">{issuedInvoiceData.invoiceNumber}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900">{issuedInvoiceData.customer?.shopName || 'Walk-in Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Grand Total:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatPaiseToRupees(issuedInvoiceData.taxSummary.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Paid at Counter:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatPaiseToRupees(issuedInvoiceData.paidNowPaise)}
                </span>
              </div>
              {issuedInvoiceData.creditBalancePaise > 0n && (
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500 font-medium">Added to Khata Due:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatPaiseToRupees(issuedInvoiceData.creditBalancePaise)}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={openCurrentBillPreview}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <Eye className="w-4 h-4" />
                <span>View & Print PDF</span>
              </button>
              <button
                onClick={openCurrentBillPreview}
                className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Bill</span>
              </button>
            </div>

            <button
              onClick={startNextBill}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
            >
              Start Next Bill (F2)
            </button>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={currentPreviewData}
      />
    </div>
  );
}
