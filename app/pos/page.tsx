'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Edit3,
  AlertCircle,
  Store,
  Phone,
  Users,
  Calendar,
  Calculator
} from 'lucide-react';
import { calculateInvoiceTax, formatPaiseToRupees, parseRupeesToPaise, LineItemInput } from '@/server/lib/tax';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';
import RazorpayModal from '@/app/components/RazorpayModal';
import ClientPortal from '@/app/components/ClientPortal';
import ModernLoader from '@/app/components/ModernLoader';
import PageSkeleton from '@/app/components/PageSkeleton';
import EditCustomerModal from '@/app/components/EditCustomerModal';
import AddCustomerModal from '@/app/components/AddCustomerModal';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { searchTallyItems, getHighlightedTallySegments } from '@/app/lib/tallySearch';

interface PosLineItem {
  id: string;
  productId?: string;
  name: string;
  partNumber?: string;
  qty: number;
  unit: string;
  mrpRupees: string;
  discountPercent: string;
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
  brand?: string;
  category?: string;
  salePricePaise: string;
  mrpPaise?: string;
  gstRateBp: number;
  unit: string;
  stockQty: number;
  models?: string[];
}

export default function QuickBillPosPage() {
  const { tenant } = useAuth();
  const { t, language } = useLanguage();
  
  // Data states
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('WALK_IN');
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Walk-in / Non-regular customer quick details
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [walkInVehicle, setWalkInVehicle] = useState<string>('');
  const [showWalkInDetails, setShowWalkInDetails] = useState<boolean>(true);

  // Quick Catalog Search (Tally Multi-Token Engine)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Line items state
  const [items, setItems] = useState<PosLineItem[]>([
    {
      id: '1',
      name: '',
      qty: 1,
      unit: 'pcs',
      mrpRupees: '',
      discountPercent: '0',
      rateRupees: '',
      discountType: 'PERCENT',
      discountValue: '0',
      gstRateBp: 1800,
      isTaxInclusive: false,
    }
  ]);

  // Payment states
  const [paymentMode, setPaymentMode] = useState<'FULL_CASH' | 'FULL_UPI' | 'FULL_KHATA' | 'SPLIT'>('FULL_CASH');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [upiAmount, setUpiAmount] = useState<string>('');
  const [upiRef, setUpiRef] = useState<string>('');

  // Live Counter Cash states
  const [counterCashPaise, setCounterCashPaise] = useState<bigint>(0n);
  const [counterOpeningFloatPaise, setCounterOpeningFloatPaise] = useState<bigint>(0n);
  const [counterCashSalesPaise, setCounterCashSalesPaise] = useState<bigint>(0n);
  const [cashTenderedRupees, setCashTenderedRupees] = useState<string>('');

  // Invoice / Success / Customer Modal states
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState<boolean>(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState<boolean>(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState<boolean>(false);
  const [isSuccessModal, setIsSuccessModal] = useState<boolean>(false);
  const [issuedInvoiceData, setIssuedInvoiceData] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [currentPreviewData, setCurrentPreviewData] = useState<InvoicePreviewData | null>(null);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState<boolean>(false);

  const placeOfSupply = tenant?.stateCode ? tenant.stateCode.split('-')[0].trim() : '27';

  // Real-time Counter Cash fetcher
  const refreshCounterCash = async (targetDate?: string) => {
    try {
      const d = targetDate || invoiceDate || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/v1/reports/settlement?date=${d}`);
      if (res.ok) {
        const json = await res.json();
        const saved = json.savedSettlement;
        const opening = saved 
          ? BigInt(saved.openingFloatPaise || '0') 
          : BigInt(json.summary?.openingFloatPaise || '0');
        const cashIn = saved 
          ? BigInt(saved.cashSalesPaise || '0') 
          : BigInt(json.summary?.cashCollectedPaise || '0');
        const cashOut = saved 
          ? BigInt(saved.cashExpensesPaise || '0') 
          : 0n;
        const totalAvail = opening + cashIn - cashOut;

        setCounterOpeningFloatPaise(opening);
        setCounterCashSalesPaise(cashIn);
        setCounterCashPaise(totalAvail);
      }
    } catch (e) {
      console.error('Error fetching counter cash:', e);
    }
  };

  const refreshCustomers = async (selectCustomerId?: string) => {
    try {
      const res = await fetch('/api/v1/customers');
      if (res.ok) {
        const custData = await res.json();
        if (custData.customers) {
          setCustomers(custData.customers);
          if (selectCustomerId) {
            setSelectedCustomerId(selectCustomerId);
          }
        }
      }
    } catch (e) {
      console.error('Error refreshing customers:', e);
    }
  };

  const handleCustomerSelectChange = (val: string) => {
    if (val === 'ADD_NEW_CUSTOMER') {
      setIsAddCustomerOpen(true);
    } else {
      setSelectedCustomerId(val);
    }
  };

  // Re-fetch Counter Cash when invoice date changes
  useEffect(() => {
    refreshCounterCash(invoiceDate);
  }, [invoiceDate]);

  // Load Customers, Product Catalog & Initial Counter Cash
  useEffect(() => {
    async function loadData() {
      try {
        const [custRes, prodRes] = await Promise.all([
          fetch('/api/v1/customers'),
          fetch('/api/v1/products')
        ]);

        refreshCounterCash(invoiceDate);

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
            const salePrice = (Number(first.salePricePaise) / 100).toFixed(2);
            const mrp = first.mrpPaise && Number(first.mrpPaise) > 0 
              ? (Number(first.mrpPaise) / 100).toFixed(2) 
              : salePrice;
            const mrpNum = parseFloat(mrp) || 0;
            const rateNum = parseFloat(salePrice) || 0;
            let discPct = '0';
            if (mrpNum > 0 && mrpNum > rateNum) {
              const calc = ((mrpNum - rateNum) / mrpNum) * 100;
              discPct = Number.isInteger(calc) ? calc.toString() : calc.toFixed(1);
            }
            setItems([
              {
                id: '1',
                productId: first.id,
                name: first.name,
                partNumber: first.partNumber,
                qty: 1,
                unit: first.unit || 'pcs',
                mrpRupees: mrp,
                discountPercent: discPct,
                rateRupees: salePrice,
                discountType: 'PERCENT',
                discountValue: discPct,
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

  // Keyboard shortcut listener: F2 for new line item, F3/Alt+S for Tally search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        addItemRow();
      } else if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Catalog by search (Tally Multi-Token Engine)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchTallyItems(catalog, searchQuery, 50);
  }, [catalog, searchQuery]);

  // Auto-scroll active Tally search item into view
  useEffect(() => {
    if (isSearchOpen && searchResults.length > 0) {
      const el = document.getElementById(`tally-search-item-${selectedSearchIndex}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedSearchIndex, isSearchOpen, searchResults.length]);

  const isWalkIn = selectedCustomerId === 'WALK_IN' || !selectedCustomerId;

  // Auto-switch away from Khata if customer is Walk-in
  useEffect(() => {
    if (isWalkIn && paymentMode === 'FULL_KHATA') {
      setPaymentMode('FULL_CASH');
    }
  }, [isWalkIn, paymentMode]);

  const selectedCustomer = useMemo(() => {
    if (isWalkIn) {
      return {
        id: '',
        name: walkInName.trim() || 'Walk-in Retail Customer',
        shopName: walkInName.trim() ? `${walkInName.trim()} (Walk-in)` : '⚡ Walk-in Customer (Counter Cash)',
        phone: walkInPhone.trim(),
        balancePaise: '0',
        creditLimitPaise: '0', // Walk-in customers have ZERO credit limit
        status: 'WALK_IN',
        termsDays: 0,
        address: walkInVehicle.trim() ? `Ref: ${walkInVehicle.trim()}` : 'Counter Retail Cash Sale',
        gstin: null,
      };
    }
    return customers.find(c => c.id === selectedCustomerId) || {
      id: '',
      name: 'Walk-in Retail Customer',
      shopName: '⚡ Walk-in Customer (Counter Cash)',
      phone: '',
      balancePaise: '0',
      creditLimitPaise: '0',
      status: 'WALK_IN',
      termsDays: 0,
      address: 'Counter Retail Cash Sale',
      gstin: null,
    };
  }, [customers, selectedCustomerId, isWalkIn, walkInName, walkInPhone, walkInVehicle]);

  // Calculation Engine via tax library
  const taxSummary = useMemo(() => {
    const lines: LineItemInput[] = items
      .filter(it => it.name.trim() !== '')
      .map(it => {
        const rate = parseRupeesToPaise(it.rateRupees || '0');
        return {
          rate,
          qty: it.qty,
          gstRateBp: it.gstRateBp,
          discountPercent: 0,
          discountPaise: 0n,
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

  // Simple Split Handlers (Cash & UPI)
  const handleSelectSplitMode = () => {
    setPaymentMode('SPLIT');
    if (cashAmount === '0.00' || cashAmount === '0') setCashAmount('');
    if (upiAmount === '0.00' || upiAmount === '0') setUpiAmount('');
  };

  const handleCashAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setCashAmount(cleaned);
  };

  const handleUpiAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setUpiAmount(cleaned);
  };

  // Add Item Row (Tally fast selection & auto-focus)
  const addItemRow = (prod?: CatalogOption) => {
    let newItem: PosLineItem;
    if (prod) {
      const salePrice = (Number(prod.salePricePaise) / 100).toFixed(2);
      const mrp = prod.mrpPaise && Number(prod.mrpPaise) > 0 
        ? (Number(prod.mrpPaise) / 100).toFixed(2) 
        : salePrice;
      const mrpNum = parseFloat(mrp) || 0;
      const rateNum = parseFloat(salePrice) || 0;
      let discPct = '0';
      if (mrpNum > 0 && mrpNum > rateNum) {
        const calc = ((mrpNum - rateNum) / mrpNum) * 100;
        discPct = Number.isInteger(calc) ? calc.toString() : calc.toFixed(1);
      }
      newItem = {
        id: Math.random().toString(),
        productId: prod.id,
        name: prod.name,
        partNumber: prod.partNumber,
        qty: 1,
        unit: prod.unit || 'pcs',
        mrpRupees: mrp,
        discountPercent: discPct,
        rateRupees: salePrice,
        discountType: 'PERCENT',
        discountValue: discPct,
        gstRateBp: prod.gstRateBp || 1800,
        isTaxInclusive: false,
      };
    } else {
      newItem = {
        id: Math.random().toString(),
        name: '',
        qty: 1,
        unit: 'pcs',
        mrpRupees: '',
        discountPercent: '0',
        rateRupees: '',
        discountType: 'PERCENT',
        discountValue: '0',
        gstRateBp: 1800,
        isTaxInclusive: false,
      };
    }

    let targetIdx = 0;
    setItems(prev => {
      // If there is only 1 row and it is empty, replace it with the selected product
      if (prev.length === 1 && !prev[0].name.trim() && prod) {
        targetIdx = 0;
        return [newItem];
      }
      targetIdx = prev.length;
      return [...prev, newItem];
    });

    setSearchQuery('');
    setIsSearchOpen(false);
    setSelectedSearchIndex(0);

    // Auto-focus quantity field so operator can immediately type quantity like in Tally!
    setTimeout(() => {
      const qtyInput = document.getElementById(`item-qty-${targetIdx}`) as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
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
          mrpRupees: '',
          discountPercent: '0',
          rateRupees: '',
          discountType: 'PERCENT',
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

  // Handle MRP change with auto-calculation of Discount %
  const handleMrpChange = (id: string, newMrpStr: string) => {
    const cleaned = newMrpStr.replace(/[^0-9.]/g, '');
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const mrp = parseFloat(cleaned) || 0;
      const rate = parseFloat(it.rateRupees) || 0;
      let newDisc = it.discountPercent;
      if (mrp > 0 && rate > 0) {
        if (mrp >= rate) {
          const calc = ((mrp - rate) / mrp) * 100;
          newDisc = Number.isInteger(calc) ? calc.toString() : calc.toFixed(1);
        } else {
          newDisc = '0';
        }
      } else if (mrp > 0 && rate === 0 && parseFloat(it.discountPercent) > 0) {
        const disc = parseFloat(it.discountPercent) || 0;
        const calcRate = Math.max(0, mrp * (1 - disc / 100));
        const formatted = calcRate.toFixed(2);
        return {
          ...it,
          mrpRupees: cleaned,
          rateRupees: formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted,
        };
      }
      return {
        ...it,
        mrpRupees: cleaned,
        discountPercent: newDisc,
        discountValue: newDisc,
      };
    }));
  };

  // Handle Rate change with auto-calculation of Discount % (as requested: enter mrp and enter rate, discount auto-calculated)
  const handleRateChange = (id: string, newRateStr: string) => {
    const cleaned = newRateStr.replace(/[^0-9.]/g, '');
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const mrp = parseFloat(it.mrpRupees) || 0;
      const rate = parseFloat(cleaned) || 0;
      let newDisc = it.discountPercent;
      if (mrp > 0 && rate > 0) {
        if (mrp >= rate) {
          const calc = ((mrp - rate) / mrp) * 100;
          newDisc = Number.isInteger(calc) ? calc.toString() : calc.toFixed(1);
        } else {
          newDisc = '0';
        }
      }
      return {
        ...it,
        rateRupees: cleaned,
        discountPercent: newDisc,
        discountValue: newDisc,
      };
    }));
  };

  // Handle Discount % change with auto-calculation of Rate
  const handleDiscountChange = (id: string, newDiscStr: string) => {
    const cleaned = newDiscStr.replace(/[^0-9.]/g, '');
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const mrp = parseFloat(it.mrpRupees) || 0;
      const disc = parseFloat(cleaned) || 0;
      let newRate = it.rateRupees;
      if (mrp > 0) {
        const calcRate = Math.max(0, mrp * (1 - disc / 100));
        const formatted = calcRate.toFixed(2);
        newRate = formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
      }
      return {
        ...it,
        discountPercent: cleaned,
        discountValue: cleaned,
        rateRupees: newRate,
      };
    }));
  };

  // Keyboard Navigation: Enter jumps across Name -> Qty -> MRP -> Disc -> Rate
  const handleItemKeyDown = (e: React.KeyboardEvent, idx: number, field: 'name' | 'qty' | 'mrp' | 'disc' | 'rate') => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (field === 'name') {
        const qtyInput = document.getElementById(`item-qty-${idx}`) as HTMLInputElement;
        if (qtyInput) {
          qtyInput.focus();
          qtyInput.select();
        }
      } else if (field === 'qty') {
        const mrpInput = document.getElementById(`item-mrp-${idx}`) as HTMLInputElement;
        if (mrpInput) {
          mrpInput.focus();
          mrpInput.select();
        }
      } else if (field === 'mrp') {
        const discInput = document.getElementById(`item-disc-${idx}`) as HTMLInputElement;
        if (discInput) {
          discInput.focus();
          discInput.select();
        }
      } else if (field === 'disc') {
        const rateInput = document.getElementById(`item-rate-${idx}`) as HTMLInputElement;
        if (rateInput) {
          rateInput.focus();
          rateInput.select();
        }
      } else if (field === 'rate') {
        if (idx === items.length - 1) {
          addItemRow();
          setTimeout(() => {
            const nextNameInput = document.getElementById(`item-name-${idx + 1}`) as HTMLInputElement;
            if (nextNameInput) {
              nextNameInput.focus();
              nextNameInput.select();
            }
          }, 40);
        } else {
          const nextNameInput = document.getElementById(`item-name-${idx + 1}`) as HTMLInputElement;
          if (nextNameInput) {
            nextNameInput.focus();
            nextNameInput.select();
          }
        }
      }
    }
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
        invoiceDate: invoiceDate || undefined,
        items: validItems.map(it => ({
          productId: it.productId,
          name: it.name,
          partNumber: it.partNumber,
          qty: it.qty,
          unit: it.unit,
          ratePaise: parseRupeesToPaise(it.rateRupees).toString(),
          discountType: 'PERCENT',
          discountValue: it.discountPercent || '0',
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
        invoiceDate,
      });

      setIsSuccessModal(true);
      refreshCustomers();
      refreshCounterCash(invoiceDate);
    } catch (err: any) {
      console.error('Invoice issuance error:', err);
      alert(err.message || 'Error communicating with billing server');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  const startNextBill = () => {
    setIsSuccessModal(false);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setItems([
      {
        id: Math.random().toString(),
        name: '',
        qty: 1,
        unit: 'pcs',
        mrpRupees: '',
        discountPercent: '0',
        rateRupees: '',
        discountType: 'PERCENT',
        discountValue: '0',
        gstRateBp: 1800,
        isTaxInclusive: false,
      }
    ]);
    setCashAmount('');
    setUpiAmount('');
    setUpiRef('');
    setCashTenderedRupees('');
    setWalkInName('');
    setWalkInPhone('');
    setWalkInVehicle('');
    setPaymentMode('FULL_CASH');
    refreshCounterCash();
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
      date: invoiceDate 
        ? new Date(`${invoiceDate}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
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
        name: tenant?.name || 'Apex Trade & Wholesale',
        legalName: tenant?.legalName || 'Apex Trade & Wholesale Pvt Ltd',
        address: tenant?.address || 'Shop No. 12-15, Main Commercial Trade Market - 411002',
        gstin: tenant?.gstin || '27ABCDE1234F1Z5',
        phone: tenant?.phone || '+91 9822100001',
        email: tenant?.email || 'billing@tradeledger.app',
        stateCode: tenant?.stateCode || '27 - Maharashtra',
        bankName: tenant?.bankDetails?.bankName || 'HDFC Bank',
        accountNumber: tenant?.bankDetails?.accountNumber || '50200012345678',
        ifscCode: tenant?.bankDetails?.ifscCode || 'HDFC0001234',
        upiId: tenant?.upiId || 'tradeledger@okhdfcbank',
      },
    };

    setCurrentPreviewData(previewInvoice);
    setIsSuccessModal(false);
    setIsPreviewModalOpen(true);
  };

  const handlePrintFromSuccessModal = () => {
    openCurrentBillPreview();
    setTimeout(() => {
      window.print();
    }, 350);
  };

  const handleWhatsAppFromSuccessModal = () => {
    const custPhone = issuedInvoiceData?.customer?.phone || selectedCustomer?.phone || '';
    const cleanPhone = custPhone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const invNo = issuedInvoiceData?.invoiceNumber || 'INV';
    const total = formatPaiseToRupees(issuedInvoiceData?.taxSummary?.grandTotal || issuedInvoiceData?.grandTotalPaise || 0);
    const paid = formatPaiseToRupees(issuedInvoiceData?.paidNowPaise || 0);
    const balance = formatPaiseToRupees(issuedInvoiceData?.creditBalancePaise || 0);

    const message = `*TAX INVOICE - ${tenant?.name || 'TradeLedger'}*\n` +
      `--------------------------------\n` +
      `*Invoice No:* ${invNo}\n` +
      `*Customer:* ${issuedInvoiceData?.customer?.shopName || selectedCustomer?.shopName || 'Customer'}\n` +
      `*Grand Total:* ${total}\n` +
      `*Paid Amount:* ${paid}\n` +
      (issuedInvoiceData?.creditBalancePaise > 0n ? `*Balance Due:* ${balance}\n` : '') +
      `--------------------------------\n` +
      `Thank you for your business!`;

    const encoded = encodeURIComponent(message);
    const url = targetPhone 
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encoded}` 
      : `https://api.whatsapp.com/send?text=${encoded}`;
    
    window.open(url, '_blank');
  };

  // Highlight search tokens within matching text (Tally style)
  const renderHighlightedText = (text: string, query: string, isSelected: boolean) => {
    if (!text) return '';
    const segments = getHighlightedTallySegments(text, query);
    return segments.map((seg, i) =>
      seg.isMatch ? (
        <span
          key={i}
          className={
            isSelected
              ? 'bg-amber-400 text-slate-950 font-bold px-0.5 rounded-2xs'
              : 'bg-amber-100 text-amber-900 font-bold px-0.5 rounded-2xs'
          }
        >
          {seg.text}
        </span>
      ) : (
        <span key={i}>{seg.text}</span>
      )
    );
  };

  if (loadingInitial) {
    return (
      <PageSkeleton 
        title="Initializing POS Billing..." 
        subtitle="Fetching product catalog, real-time rates, and customer accounts..." 
      />
    );
  }

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER RIBBON: TITLE & BILLING MODE SWITCHER */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:px-4 sm:py-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Bill Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                Fast Counter POS Billing
              </h1>
              <span className="text-[10px] font-mono font-semibold bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded border border-[#E2E8F0]">
                {tenant?.settings?.invoicePrefix || 'INV/2026-27/'}DRAFT
              </span>
            </div>
            <div className="text-[11px] text-[#64748B]">
              Real-time GST calculations · Instant inventory allocation · Double-entry Ledger
            </div>
          </div>
        </div>

        {/* Right: Date Picker, Mode Switcher & Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Invoice Date Picker (Supports today & backdated billings) */}
          <div className="flex items-center gap-1.5 bg-[#F8F9FA] hover:bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-0.5 shadow-2xs transition focus-within:border-[#C81E1E] focus-within:bg-white h-8">
            <Calendar className="w-3.5 h-3.5 text-[#C81E1E] shrink-0" />
            <div className="flex flex-col justify-center">
              <label htmlFor="invoice-date-input" className="text-[8px] uppercase font-bold text-[#64748B] leading-none select-none">
                Invoice Date
              </label>
              <input
                id="invoice-date-input"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="text-[11px] font-semibold text-[#0F172A] bg-transparent border-0 outline-hidden p-0 cursor-pointer h-3.5 font-mono"
                title="Invoice Date (Select past date if billing forgotten orders)"
              />
            </div>
          </div>

          {/* Segmented Mode Control */}
          <div className="bg-[#F1F5F9] p-0.5 rounded-lg flex items-center border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setSelectedCustomerId('WALK_IN')}
              className={`h-7.5 px-3 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                isWalkIn
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isWalkIn ? 'fill-slate-950' : 'text-amber-500'}`} />
              <span>Retail Walk-in</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isWalkIn && customers.length > 0) {
                  setSelectedCustomerId(customers[0].id);
                } else if (customers.length === 0) {
                  setIsAddCustomerOpen(true);
                }
              }}
              className={`h-7.5 px-3 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                !isWalkIn
                  ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Account Client</span>
            </button>
          </div>

          <Link
            href="/invoices"
            className="h-8 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-[#F8F9FA] text-[#334155] font-medium text-xs rounded-lg border border-[#CBD5E1] transition shadow-2xs"
            title="Search Past Bills & Invoices"
          >
            <FileText className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="hidden sm:inline">Past Invoices</span>
          </Link>

          <Link
            href="/settlement"
            className="h-8 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-red-50 text-[#C81E1E] font-medium text-xs rounded-lg border border-red-200 transition shadow-2xs"
            title="End of Day Cash Settlement & Till Reconciliation"
          >
            <Calculator className="w-3.5 h-3.5 text-[#C81E1E]" />
            <span className="hidden sm:inline">Day-End Tally</span>
          </Link>

          {/* Real-time Available Counter Cash Badge */}
          <Link
            href="/settlement"
            className="h-8 inline-flex items-center gap-2 px-3 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 font-medium text-xs rounded-lg border border-emerald-300 transition shadow-2xs group cursor-pointer"
            title="Real-time Physical Cash in Counter Till (Opening Float + Cash Sales - Expenses). Click to view Day-End Settlement."
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Counter Cash:</span>
              <span className="font-mono font-bold text-xs tabular-nums text-emerald-950">
                {formatPaiseToRupees(counterCashPaise)}
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* 2. CUSTOMER CONTEXT CARD */}
      {isWalkIn ? (
        /* Walk-in Retail Card */
        <div className="bg-gradient-to-r from-amber-50/80 to-amber-50/40 border border-amber-200/90 rounded-xl p-3.5 shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
            <div className="flex items-center gap-2 text-xs text-amber-950 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Retail Walk-in Customer</span>
              <span className="text-amber-700 font-normal text-[11px]">— Instant Counter Cash / UPI Billing</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100/80 text-amber-900 border border-amber-300/80 rounded text-[10px] font-mono font-bold w-fit">
              ZERO CREDIT SALE · CASH ONLY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Buyer Name (Optional)</label>
              <input
                type="text"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full h-8 px-2.5 bg-white border border-amber-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Mobile Number (For Receipt/SMS)</label>
              <input
                type="tel"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                placeholder="e.g. 9812345678"
                className="w-full h-8 px-2.5 bg-white border border-amber-300 rounded-lg font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Reference / Notes (Optional)</label>
              <input
                type="text"
                value={walkInVehicle}
                onChange={(e) => setWalkInVehicle(e.target.value)}
                placeholder="e.g. Counter Cash / PO-102"
                className="w-full h-8 px-2.5 bg-white border border-amber-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden text-xs"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Registered Account Customer Card */
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs space-y-3">
          {/* Top Row: Dropdown selector & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-lg">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelectChange(e.target.value)}
                  className="w-full bg-[#F8F9FA] hover:bg-white border border-[#CBD5E1] rounded-lg py-1.5 px-3 text-xs font-bold text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden shadow-2xs cursor-pointer transition truncate"
                >
                  {customers.length > 0 ? (
                    <optgroup label="Registered Business Clients & Retailers">
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.shopName} ({c.name}) · {c.phone}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option value="ADD_NEW_CUSTOMER" className="text-blue-600 font-medium bg-blue-50">
                      + No registered accounts yet (Click to add)
                    </option>
                  )}
                  <option value="ADD_NEW_CUSTOMER" className="text-blue-700 font-bold bg-blue-50">
                    + Add New Customer / Client...
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(true)}
                className="h-8 px-3 flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-[#C81E1E] text-xs font-bold rounded-lg border border-red-200 transition shadow-2xs cursor-pointer shrink-0"
                title="Add New Customer Account"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#C81E1E]" />
                <span>+ Add Client</span>
              </button>

              {selectedCustomer.id && (
                <button
                  type="button"
                  onClick={() => setIsEditCustomerOpen(true)}
                  className="h-8 px-2.5 flex items-center gap-1 bg-white hover:bg-[#F8F9FA] text-[#334155] text-xs font-medium rounded-lg border border-[#CBD5E1] transition shadow-2xs cursor-pointer shrink-0"
                  title="Edit Selected Customer Details"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#64748B]" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Selected Customer Live Metrics */}
          {selectedCustomer.id && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs" title={selectedCustomer.shopName || selectedCustomer.name}>
                  <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{selectedCustomer.shopName || selectedCustomer.name}</span>
                </div>
                {selectedCustomer.phone && (
                  <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1 shrink-0">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {selectedCustomer.phone}
                  </span>
                )}
                {selectedCustomer.address && (
                  <span className="text-slate-400 text-[11px] hidden md:inline truncate max-w-[180px]" title={selectedCustomer.address}>
                    · {selectedCustomer.address}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px]">
                {/* Due / Advance Balance Badge */}
                {Number(selectedCustomer.balancePaise || 0) > 0 ? (
                  <div className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-bold bg-amber-50 text-amber-900 border-amber-200">
                    <BookOpen className="w-3 h-3 text-amber-600" />
                    <span>Outstanding: {formatPaiseToRupees(Number(selectedCustomer.balancePaise))}</span>
                  </div>
                ) : Number(selectedCustomer.balancePaise || 0) < 0 ? (
                  <div className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-bold bg-emerald-50 text-emerald-800 border-emerald-200">
                    <Wallet className="w-3 h-3 text-emerald-600" />
                    <span>Advance Credit: {formatPaiseToRupees(Math.abs(Number(selectedCustomer.balancePaise)))}</span>
                  </div>
                ) : (
                  <div className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-bold bg-slate-50 text-slate-700 border-slate-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Balance: ₹0.00 (All Clear)</span>
                  </div>
                )}

                {/* Credit Limit */}
                <div className="px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-md">
                  <span>Limit: {formatPaiseToRupees(Number(selectedCustomer.creditLimitPaise) || 5000000)}</span>
                </div>

                {/* Terms */}
                <div className="px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-md">
                  <span>{selectedCustomer.termsDays || 15} Days Terms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. MAIN 2-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* LEFT PANEL (8 COLS): PARTS SEARCH & LINE ITEMS TABLE */}
        <div className="lg:col-span-8 space-y-3.5">
          
          {/* Quick Auto-Complete Part Search Bar (Tally-Style List of Stock Items) */}
          <div ref={searchContainerRef} className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-2.5 relative">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-3" />
              <input
                ref={searchInputRef}
                id="pos-part-search"
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                  setSelectedSearchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (!isSearchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    setIsSearchOpen(true);
                    e.preventDefault();
                    return;
                  }
                  if (searchResults.length === 0) {
                    if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                    }
                    return;
                  }

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSearchIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSearchIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchResults[selectedSearchIndex]) {
                      addItemRow(searchResults[selectedSearchIndex]);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsSearchOpen(false);
                  }
                }}
                placeholder={t('pos.search_parts', 'Type part name, OEM SKU, or fitment (e.g. TVS RTR, 13 NUT, CHOKE CAB)...')}
                className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl py-2 pl-9 pr-14 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden transition shadow-2xs"
              />
              <div className="absolute right-3 top-2.5 flex items-center gap-1 pointer-events-none">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">F3</kbd>
              </div>
            </div>

            {/* Live Search Results Dropdown - Tally "List of Stock Items" */}
            {isSearchOpen && searchQuery.trim() !== '' && (
              <div 
                ref={searchDropdownRef}
                className="absolute left-0 right-0 top-[52px] bg-white rounded-xl shadow-2xl border border-slate-300 z-50 overflow-hidden animate-in fade-in duration-100"
              >
                {/* Tally Header Bar */}
                <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-400">
                      ⚡ List of Stock Items
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700">
                      {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 flex items-center gap-2">
                    <span><kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-white">↑</kbd> <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-white">↓</kbd> Navigate</span>
                    <span><kbd className="px-1.5 py-0.5 bg-blue-600 border border-blue-500 rounded text-[9px] font-mono text-white font-semibold">↵ Enter</kbd> Select & Add</span>
                    <span><kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-white">Esc</kbd> Close</span>
                  </div>
                </div>

                {/* Table Column Headers */}
                <div className="grid grid-cols-12 gap-2 px-3.5 py-1.5 bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <div className="col-span-5">Item Description & OEM SKU</div>
                  <div className="col-span-3">Make / Fitment</div>
                  <div className="col-span-2 text-right">Closing Stock</div>
                  <div className="col-span-2 text-right">Selling Rate (₹)</div>
                </div>

                {/* Search Results Table Rows */}
                {searchResults.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map((prod, idx) => {
                      const isSelected = idx === selectedSearchIndex;
                      const hasStock = prod.stockQty > 0;

                      return (
                        <div
                          key={prod.id}
                          id={`tally-search-item-${idx}`}
                          onClick={() => addItemRow(prod)}
                          onMouseEnter={() => setSelectedSearchIndex(idx)}
                          className={`grid grid-cols-12 gap-2 px-3.5 py-2 cursor-pointer transition-colors items-center text-xs ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          {/* Item Description & SKU */}
                          <div className="col-span-5 min-w-0 pr-2">
                            <div className={`font-semibold truncate text-[12px] ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                              {renderHighlightedText(prod.name, searchQuery, isSelected)}
                            </div>
                            <div className={`text-[10px] font-mono truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                              SKU: {renderHighlightedText(prod.partNumber || '-', searchQuery, isSelected)}
                              {prod.category && ` · ${prod.category}`}
                            </div>
                          </div>

                          {/* Brand & Model */}
                          <div className="col-span-3 min-w-0 pr-2">
                            <div className={`text-[11px] font-medium truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                              {prod.brand || 'Unbranded'}
                            </div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                              {Array.isArray(prod.models) && prod.models.length > 0 ? prod.models.slice(0, 2).join(', ') : 'Universal Fit'}
                            </div>
                          </div>

                          {/* Closing Stock */}
                          <div className="col-span-2 text-right">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                              isSelected
                                ? hasStock
                                  ? 'bg-emerald-400/25 text-emerald-200 border border-emerald-400/40'
                                  : 'bg-rose-400/20 text-rose-200 border border-rose-400/30'
                                : hasStock
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                              {prod.stockQty} {prod.unit || 'pcs'}
                            </span>
                          </div>

                          {/* Rate & MRP */}
                          <div className="col-span-2 text-right">
                            <div className={`font-mono font-bold text-xs tabular-nums ${isSelected ? 'text-amber-300' : 'text-slate-900'}`}>
                              ₹{(Number(prod.salePricePaise) / 100).toFixed(2)}
                            </div>
                            {prod.mrpPaise && Number(prod.mrpPaise) > 0 ? (
                              <div className={`text-[9px] font-mono tabular-nums ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                MRP: ₹{(Number(prod.mrpPaise) / 100).toFixed(2)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700 mb-1">No stock items match "{searchQuery}"</p>
                    <p className="text-[11px] text-slate-400">
                      Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono">F2</kbd> to add a blank row or try different search tokens.
                    </p>
                  </div>
                )}

                {/* Footer Status Bar */}
                <div className="bg-slate-50 px-3.5 py-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Tally Multi-Token Engine: Token-order agnostic & punctuation-free</span>
                  </div>
                  <div className="font-medium text-slate-600">
                    Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9px]">F3</kbd> anytime to search
                  </div>
                </div>
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
                    <th className="py-2.5 px-3 min-w-[180px]">{t('pos.item_name', 'Item Description & SKU')}</th>
                    <th className="py-2.5 px-2 w-14 text-center">{t('pos.quantity', 'Qty')}</th>
                    <th className="py-2.5 px-2 w-14 text-center">Unit</th>
                    <th className="py-2.5 px-2.5 w-22 text-right">MRP (₹)</th>
                    <th className="py-2.5 px-2 w-20 text-center">Disc (%)</th>
                    <th className="py-2.5 px-2.5 w-22 text-right">{t('pos.rate', 'Rate (₹)')}</th>
                    <th className="py-2.5 px-2 w-16 text-center">GST</th>
                    <th className="py-2.5 px-3 w-26 text-right">{t('pos.amount', 'Amount (₹)')}</th>
                    <th className="py-2.5 px-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
                  {items.map((item, idx) => {
                    const rateNum = parseFloat(item.rateRupees) || 0;
                    const lineTotal = rateNum * (item.qty || 1);
                    const mrpNum = parseFloat(item.mrpRupees) || 0;
                    const hasDiscount = mrpNum > rateNum && rateNum > 0;

                    return (
                      <tr key={item.id} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="py-2 px-2.5 text-center font-mono text-[#94A3B8] text-[11px]">{idx + 1}</td>
                        
                        {/* Name & SKU */}
                        <td className="py-2 px-2.5">
                          <input
                            id={`item-name-${idx}`}
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItemRow(item.id, 'name', e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, idx, 'name')}
                            placeholder="Enter item description..."
                            className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs font-medium text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-2 px-2 text-center">
                          <input
                            id={`item-qty-${idx}`}
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItemRow(item.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleItemKeyDown(e, idx, 'qty')}
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

                        {/* MRP (₹) */}
                        <td className="py-2 px-2 text-right">
                          <input
                            id={`item-mrp-${idx}`}
                            type="text"
                            value={item.mrpRupees || ''}
                            onChange={(e) => handleMrpChange(item.id, e.target.value)}
                            onFocus={(e) => {
                              if (item.mrpRupees === '0' || item.mrpRupees === '0.00') {
                                handleMrpChange(item.id, '');
                              }
                              e.target.select();
                            }}
                            onKeyDown={(e) => handleItemKeyDown(e, idx, 'mrp')}
                            placeholder="0.00"
                            className="w-20 text-right bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 px-2 font-mono tabular-nums font-semibold text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs placeholder:text-slate-400"
                          />
                        </td>

                        {/* Discount (%) Section */}
                        <td className="py-2 px-2 text-center">
                          <div className="relative inline-flex items-center">
                            <input
                              id={`item-disc-${idx}`}
                              type="text"
                              value={item.discountPercent || ''}
                              onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                              onFocus={(e) => {
                                if (item.discountPercent === '0') {
                                  handleDiscountChange(item.id, '');
                                }
                                e.target.select();
                              }}
                              onKeyDown={(e) => handleItemKeyDown(e, idx, 'disc')}
                              placeholder="0"
                              className="w-16 text-right pr-4.5 bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 px-1 font-mono tabular-nums font-semibold text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs placeholder:text-slate-400 text-xs"
                            />
                            <span className="absolute right-1 text-[10px] text-slate-400 font-bold pointer-events-none">%</span>
                          </div>
                        </td>

                        {/* Rate (₹) */}
                        <td className="py-2 px-2.5 text-right">
                          <input
                            id={`item-rate-${idx}`}
                            type="text"
                            value={item.rateRupees}
                            onChange={(e) => handleRateChange(item.id, e.target.value)}
                            onFocus={(e) => {
                              if (item.rateRupees === '0' || item.rateRupees === '0.00' || item.rateRupees === '0.0') {
                                handleRateChange(item.id, '');
                              }
                              e.target.select();
                            }}
                            onKeyDown={(e) => handleItemKeyDown(e, idx, 'rate')}
                            placeholder="0.00"
                            className="w-20 text-right bg-[#F8F9FA] border border-[#CBD5E1] rounded-lg py-1 px-2 font-mono tabular-nums font-semibold text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs placeholder:text-slate-400"
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

                        {/* Line Total & Savings Badge */}
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                          <div className="font-semibold text-[#0F172A]">
                            ₹{lineTotal.toFixed(2)}
                          </div>
                          {hasDiscount && (
                            <div className="text-[9px] text-emerald-600 font-bold tracking-tight">
                              save ₹{((mrpNum - rateNum) * (item.qty || 1)).toFixed(0)}
                            </div>
                          )}
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

            {/* Real-time Available Counter Cash Overview Card */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-xl p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>Available Counter Cash</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                    <div className="text-[10px] text-emerald-700">
                      Float ₹{(Number(counterOpeningFloatPaise) / 100).toFixed(0)} · Sales ₹{(Number(counterCashSalesPaise) / 100).toFixed(0)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-emerald-900 tabular-nums">
                    {formatPaiseToRupees(counterCashPaise)}
                  </div>
                  <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200">
                    In Till
                  </span>
                </div>
              </div>

              {/* If Cash Mode is selected, show projected counter cash after this bill */}
              {(paymentMode === 'FULL_CASH' || (paymentMode === 'SPLIT' && cashAmount && parseFloat(cashAmount) > 0)) && (
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800 font-medium">
                    After this sale (+{formatPaiseToRupees(cashPaise)}):
                  </span>
                  <span className="font-mono font-bold text-emerald-950 tabular-nums">
                    {formatPaiseToRupees(counterCashPaise + cashPaise)}
                  </span>
                </div>
              )}
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
                  onClick={() => {
                    if (isWalkIn) {
                      alert('Walk-in retail customers do not have a credit account. Please select Cash or UPI, or register them as a business client.');
                      return;
                    }
                    setPaymentMode('FULL_KHATA');
                  }}
                  className={`h-9 px-2.5 rounded-md border transition-colors flex items-center justify-center gap-1.5 text-xs shadow-2xs ${
                    isWalkIn 
                       ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' 
                      : paymentMode === 'FULL_KHATA' 
                      ? 'bg-[#D97706] text-white border-[#D97706] font-semibold' 
                      : 'bg-[#F8F9FA] text-[#334155] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  }`}
                  title={isWalkIn ? 'Credit is disabled for Walk-in Retail customers (Cash/UPI only)' : 'Full payment on Credit Ledger'}
                >
                  <span>{isWalkIn ? '🚫 No Credit' : '📖 Credit Ledger'}</span>
                  {paymentMode === 'FULL_KHATA' && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={handleSelectSplitMode}
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

            {/* Cash Mode: Customer Tendered Cash & Return Change Calculator */}
            {paymentMode === 'FULL_CASH' && grandTotalPaise > 0n && (
              <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#CBD5E1] space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    💵 Customer Tendered Cash:
                  </label>
                  {cashTenderedRupees && (
                    <button
                      type="button"
                      onClick={() => setCashTenderedRupees('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
                    <input
                      type="text"
                      value={cashTenderedRupees}
                      onChange={(e) => setCashTenderedRupees(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder={(Number(grandTotalPaise) / 100).toFixed(2)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-lg py-1 pl-6 pr-2 font-mono font-bold text-xs text-[#0F172A] focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCashTenderedRupees((Number(grandTotalPaise) / 100).toFixed(0))}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-[10px] font-semibold text-slate-700 shadow-2xs"
                    >
                      Exact
                    </button>
                    {[500, 1000, 2000]
                      .filter(amt => BigInt(amt * 100) >= grandTotalPaise)
                      .slice(0, 2)
                      .map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashTenderedRupees(amt.toString())}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-[10px] font-mono font-semibold text-slate-700 shadow-2xs"
                        >
                          ₹{amt}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Return Change calculation */}
                {(() => {
                  const tenderedPaise = parseRupeesToPaise(cashTenderedRupees || '0');
                  if (tenderedPaise > grandTotalPaise) {
                    const changePaise = tenderedPaise - grandTotalPaise;
                    return (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-amber-950">
                        <span className="text-[11px] font-bold">Return Change to Buyer:</span>
                        <span className="font-mono font-extrabold text-sm text-amber-900 tabular-nums">
                          {formatPaiseToRupees(changePaise)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

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

            {/* Split: Simple Cash & UPI Inputs */}
            {paymentMode === 'SPLIT' && (
              <div className="bg-[#F8F9FA] p-3 rounded-md border border-[#E2E8F0] space-y-2 text-xs shadow-2xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">
                      💵 Cash Paid (₹)
                    </label>
                    <input
                      type="text"
                      value={cashAmount}
                      onChange={(e) => handleCashAmountChange(e.target.value)}
                      onFocus={(e) => {
                        if (cashAmount === '0' || cashAmount === '0.00' || cashAmount === '0.0') {
                          setCashAmount('');
                        }
                        e.target.select();
                      }}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#CBD5E1] rounded-md p-1.5 font-mono tabular-nums font-semibold text-[#0F172A] focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden text-xs placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">
                      📱 UPI Paid (₹)
                    </label>
                    <input
                      type="text"
                      value={upiAmount}
                      onChange={(e) => handleUpiAmountChange(e.target.value)}
                      onFocus={(e) => {
                        if (upiAmount === '0' || upiAmount === '0.00' || upiAmount === '0.0') {
                          setUpiAmount('');
                        }
                        e.target.select();
                      }}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#CBD5E1] rounded-md p-1.5 font-mono tabular-nums font-semibold text-[#0F172A] focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden text-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                    placeholder="Optional UPI Ref / UTR number..."
                    className="w-full bg-white border border-[#CBD5E1] rounded-md p-1.5 text-[11px] text-[#334155] focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden"
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

              {/* Smart Credit Risk & Limit Check Banner */}
              {balanceOnCreditPaise > 0n && selectedCustomer.id && (() => {
                const curBal = BigInt(selectedCustomer.balancePaise || '0');
                const limit = BigInt(selectedCustomer.creditLimitPaise || '5000000');
                const projected = curBal + balanceOnCreditPaise;
                const isOver = projected > limit;

                return (
                  <div className={`mt-2 p-2.5 rounded-lg border text-xs space-y-1 ${
                    isOver 
                      ? 'bg-red-50 border-red-200 text-red-900' 
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        {isOver ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>Credit Limit Exceeded!</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Within Approved Credit Limit</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono text-[10px]">
                        Limit: {formatPaiseToRupees(limit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-600 pt-0.5">
                      <span>Projected Khata Due:</span>
                      <span className={`font-bold ${isOver ? 'text-red-700' : 'text-slate-900'}`}>
                        {formatPaiseToRupees(projected)}
                      </span>
                    </div>
                    {isOver && (
                      <p className="text-[10px] text-red-700 leading-tight pt-0.5">
                        ⚠️ Over limit by {formatPaiseToRupees(projected - limit)}. Counter staff review required.
                      </p>
                    )}
                  </div>
                );
              })()}
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
                    <span>Issuing Bill & Recording...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Issue Bill & Record Sale</span>
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
          <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden">
            <div className="bg-white border border-[#CBD5E1] rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150 print:hidden">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] flex items-center justify-center font-bold shadow-2xs shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] leading-tight">Sale Bill Issued Successfully</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-mono font-bold text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded">
                        {issuedInvoiceData.invoiceNumber}
                      </span>
                      <span className="text-[10px] text-[#64748B]">· Recorded</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSuccessModal(false)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between text-xs pb-2.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B] font-medium">Customer Account</span>
                  <span className="font-bold text-[#0F172A] truncate max-w-[200px]">
                    {issuedInvoiceData.customer?.shopName || issuedInvoiceData.customer?.name || 'Walk-in Retail Counter'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0]">
                    <div className="text-[10px] uppercase font-bold text-[#64748B]">Grand Total</div>
                    <div className="text-base font-bold font-mono text-[#0F172A] mt-0.5 tabular-nums">
                      {formatPaiseToRupees(issuedInvoiceData?.taxSummary?.grandTotal || issuedInvoiceData?.grandTotalPaise || 0)}
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0]">
                    <div className="text-[10px] uppercase font-bold text-[#15803D]">Paid at Counter</div>
                    <div className="text-base font-bold font-mono text-[#16A34A] mt-0.5 tabular-nums">
                      {formatPaiseToRupees(issuedInvoiceData.paidNowPaise)}
                    </div>
                  </div>
                </div>

                {issuedInvoiceData.creditBalancePaise > 0n && (
                  <div className="flex items-center justify-between p-2.5 bg-[#FFFBEB] border border-[#FEF3C7] rounded-lg text-xs">
                    <span className="text-[#92400E] font-medium">Added to Balance Due:</span>
                    <span className="font-mono tabular-nums font-bold text-[#B45309]">
                      {formatPaiseToRupees(issuedInvoiceData.creditBalancePaise)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handlePrintFromSuccessModal}
                    className="h-9 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / PDF</span>
                  </button>
                  <button
                    onClick={handleWhatsAppFromSuccessModal}
                    className="h-9 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Bill</span>
                  </button>
                </div>

                {issuedInvoiceData.creditBalancePaise > 0n && (
                  <button
                    onClick={() => setIsRazorpayModalOpen(true)}
                    className="w-full h-8.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 border border-[#BFDBFE] transition shadow-2xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Send UPI Payment Link (WhatsApp)</span>
                  </button>
                )}

                <button
                  onClick={startNextBill}
                  className="w-full h-9 bg-[#C81E1E] hover:bg-[#A81818] text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-2xs"
                >
                  <span>Start Next Bill</span>
                  <kbd className="text-[10px] font-mono text-white/80 bg-red-900/50 px-1.5 py-0.5 rounded">F2</kbd>
                </button>
              </div>

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

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <AddCustomerModal
          isOpen={isAddCustomerOpen}
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={(newCust) => {
            refreshCustomers(newCust.id);
          }}
        />
      )}
    </div>
  );
}
