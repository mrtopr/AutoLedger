'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Wallet, 
  CreditCard, 
  AlertTriangle, 
  Plus, 
  Calendar, 
  ChevronDown, 
  Eye, 
  MessageCircle, 
  Printer, 
  BookOpen, 
  Boxes, 
  FileText,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';

interface DailyTrend {
  day: string;
  date: string;
  salesRupees: number;
  collectionsRupees: number;
  billCount: number;
}

interface OverdueCustomer {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  balanceRupees: number;
  daysOverdue: number;
  status: 'HIGH' | 'MEDIUM' | 'NORMAL';
}

interface LowStockPart {
  id: string;
  name: string;
  partNumber: string;
  stockQty: number;
  reorderLevel: number;
  unit: string;
  category: string;
}

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerShop?: string;
  customerPhone?: string;
  customerGstin?: string | null;
  customerAddress?: string;
  time: string;
  dateStr?: string;
  totalRupees: number;
  paidRupees: number;
  isCredit: boolean;
  status: string;
  cancelReason?: string | null;
  items?: any[];
  taxableValuePaise?: string;
  cgstPaise?: string;
  sgstPaise?: string;
  grandTotalPaise?: string;
  paidNowPaise?: string;
  creditBalancePaise?: string;
}

export default function DealershipDashboardPage() {
  const router = useRouter();
  const { user, tenant } = useAuth();
  const { t, language } = useLanguage();

  // Date Range State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRangePreset, setSelectedRangePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisMonth'>('7days');
  const [rangeLabel, setRangeLabel] = useState('Last 7 Days');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Active hover/selected point on graph
  const [activeDataIndex, setActiveDataIndex] = useState<number>(6);

  // Invoice Preview Modal
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState<InvoicePreviewData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Dynamic state loaded from API
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyTrend[]>([]);
  const [currentSales, setCurrentSales] = useState<number>(0);
  const [currentCollections, setCurrentCollections] = useState<number>(0);
  const [totalMarketUdhaar, setTotalMarketUdhaar] = useState<number>(0);
  const [totalOverdue, setTotalOverdue] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [growthVsPreviousDay, setGrowthVsPreviousDay] = useState<string>('+0.0%');
  const [overdueCustomers, setOverdueCustomers] = useState<OverdueCustomer[]>([]);
  const [lowStockParts, setLowStockParts] = useState<LowStockPart[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);

  // Close date picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real dynamic data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, custRes, prodRes] = await Promise.all([
        fetch('/api/v1/dashboard'),
        fetch('/api/v1/customers'),
        fetch('/api/v1/products')
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData.success && dashData.metrics) {
          const salesRs = Math.round(Number(BigInt(dashData.metrics.todaySalesPaise || 0)) / 100);
          const collRs = Math.round(Number(BigInt(dashData.metrics.collectedTodayPaise || 0)) / 100);
          const udhaarRs = Math.max(0, Math.round(Number(BigInt(dashData.metrics.outstandingKhataPaise || 0)) / 100));
          const overdueRs = Math.max(0, Math.round(Number(BigInt(dashData.metrics.overduePaise || 0)) / 100));

          setCurrentSales(salesRs);
          setCurrentCollections(collRs);
          setTotalMarketUdhaar(udhaarRs);
          setTotalOverdue(overdueRs);
          setLowStockCount(dashData.metrics.lowStockCount || 0);
          setGrowthVsPreviousDay(dashData.growthVsPreviousDay || '+0.0%');

          if (Array.isArray(dashData.chartDays) && dashData.chartDays.length > 0) {
            const mappedTrends: DailyTrend[] = dashData.chartDays.map((cd: any) => ({
              day: cd.day,
              date: cd.date,
              salesRupees: cd.salesRupees ?? Math.round((cd.sales || 0) * 100000),
              collectionsRupees: cd.collectionsRupees ?? Math.round((cd.coll || 0) * 100000),
              billCount: 0,
            }));
            setDailyData(mappedTrends);
            setActiveDataIndex(mappedTrends.length - 1);
          }
        }
      }

      if (custRes.ok) {
        const custData = await custRes.json();
        const list = custData.customers || (Array.isArray(custData) ? custData : []);
        const overdue = list
          .filter((c: any) => BigInt(c.balancePaise || 0) > 0n)
          .map((c: any) => {
            const balPaise = BigInt(c.balancePaise || 0);
            const balRs = Math.round(Number(balPaise) / 100);
            const terms = c.termsDays || 15;
            const daysOvd = c.daysOverdue || (c.createdAt ? Math.max(1, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24))) : terms);
            
            return {
              id: c.id,
              name: c.name || 'Owner',
              shopName: c.shopName || c.name || 'Client',
              phone: c.phone || '',
              balanceRupees: balRs,
              daysOverdue: daysOvd,
              status: c.status === 'RED' ? 'HIGH' : c.status === 'YELLOW' ? 'MEDIUM' : 'NORMAL',
            };
          })
          .sort((a: any, b: any) => b.balanceRupees - a.balanceRupees);
        setOverdueCustomers(overdue);
      }

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const list = prodData.products || (Array.isArray(prodData) ? prodData : []);
        const lowStock = list
          .filter((p: any) => (p.stockQty || 0) <= (p.reorderLevel || 10))
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            partNumber: p.partNumber,
            stockQty: p.stockQty,
            reorderLevel: p.reorderLevel || 10,
            unit: p.unit || 'pcs',
            category: p.category || 'Spares',
          }));
        setLowStockParts(lowStock);
      }

      const invRes = await fetch('/api/v1/invoices?limit=8');
      if (invRes.ok) {
        const invData = await invRes.json();
        const list = invData.invoices || (Array.isArray(invData) ? invData : []);
        const recent: RecentInvoice[] = list.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || 'INV-001',
          customerName: inv.customerName || inv.customerShop || 'Counter Customer',
          customerShop: inv.customerShop || inv.customerName || 'Counter Customer',
          customerPhone: inv.customerPhone || '',
          customerGstin: inv.customerGstin || null,
          customerAddress: inv.customerAddress || '',
          time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Today',
          dateStr: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
          totalRupees: Math.round(Number(BigInt(inv.grandTotalPaise || inv.amountPaise || 0)) / 100),
          paidRupees: Math.round(Number(BigInt(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0))) / 100),
          isCredit: BigInt(inv.creditBalancePaise || 0) > 0n,
          status: inv.status || 'ISSUED',
          cancelReason: inv.cancelReason || null,
          items: Array.isArray(inv.items) ? inv.items : [],
          taxableValuePaise: inv.taxableValuePaise || inv.grandTotalPaise,
          cgstPaise: inv.cgstPaise || '0',
          sgstPaise: inv.sgstPaise || '0',
          grandTotalPaise: inv.grandTotalPaise,
          paidNowPaise: inv.paidNowPaise,
          creditBalancePaise: inv.creditBalancePaise,
        }));
        setRecentInvoices(recent);
      }
    } catch (err) {
      console.error('Error fetching dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle invoice modal preview with actual items and status
  const handleViewInvoice = (inv: RecentInvoice) => {
    const rawItems = (inv.items && inv.items.length > 0) ? inv.items : [
      {
        name: 'Automotive Spares & Consumables',
        partNumber: 'AUTO-GEN-01',
        hsnCode: '8714',
        qty: 1,
        unit: 'set',
        ratePaise: Math.round((inv.totalRupees / 1.18) * 100),
        rateRupees: (inv.totalRupees / 1.18).toFixed(2),
        gstRateBp: 1800,
        totalPaise: Math.round(inv.totalRupees * 100),
      }
    ];

    const previewItems = rawItems.map((it: any) => ({
      name: it.name || it.description || 'Spare Part',
      partNumber: it.partNumber || '',
      hsnCode: it.hsnCode || '8714',
      qty: Number(it.qty) || 1,
      unit: it.unit || 'pcs',
      ratePaise: it.ratePaise ? it.ratePaise.toString() : (it.rateRupees ? Math.round(parseFloat(it.rateRupees) * 100).toString() : '0'),
      rateRupees: it.rateRupees || (it.ratePaise ? (Number(it.ratePaise) / 100).toFixed(2) : '0.00'),
      gstRateBp: it.gstRateBp || 1800,
      totalPaise: it.totalPaise ? it.totalPaise.toString() : (it.lineTotal ? it.lineTotal.toString() : '0'),
    }));

    const previewData: InvoicePreviewData = {
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      cancelReason: inv.cancelReason || undefined,
      date: inv.dateStr || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: inv.time,
      placeOfSupply: tenant?.stateCode || '27 - Maharashtra',
      customer: {
        name: inv.customerName,
        shopName: inv.customerShop || inv.customerName,
        phone: inv.customerPhone || '+91 9822100000',
        address: inv.customerAddress || 'B2B Client / Counter Sales',
        gstin: inv.customerGstin || 'URP',
      },
      items: previewItems,
      taxableValuePaise: inv.taxableValuePaise || Math.round((inv.totalRupees / 1.18) * 100).toString(),
      cgstPaise: inv.cgstPaise || Math.round(((inv.totalRupees - (inv.totalRupees / 1.18)) / 2) * 100).toString(),
      sgstPaise: inv.sgstPaise || Math.round(((inv.totalRupees - (inv.totalRupees / 1.18)) / 2) * 100).toString(),
      grandTotalPaise: inv.grandTotalPaise || Math.round(inv.totalRupees * 100).toString(),
      paidNowPaise: inv.paidNowPaise || Math.round(inv.paidRupees * 100).toString(),
      creditBalancePaise: inv.creditBalancePaise || Math.round((inv.totalRupees - inv.paidRupees) * 100).toString(),
      tenant: {
        name: tenant?.name || 'Apex Trade & Wholesale',
        legalName: tenant?.legalName || 'Apex Trade & Wholesale Pvt Ltd',
        address: tenant?.address || 'Trade Center, Main Commercial Hub',
        gstin: tenant?.gstin || '27ABCDE1234F1Z5',
        phone: tenant?.phone || '+91 9822100001',
        email: tenant?.email || 'billing@tradeledger.app',
        stateCode: tenant?.stateCode || '27 - Maharashtra',
        bankName: tenant?.bankDetails?.bankName || 'HDFC Bank',
        accountNumber: tenant?.bankDetails?.accountNumber || '50200012345678',
        ifscCode: tenant?.bankDetails?.ifscCode || 'HDFC0001234',
        upiId: tenant?.upiId || 'tradeledger@okhdfcbank',
      }
    };

    setSelectedPreviewInvoice(previewData);
    setIsPreviewModalOpen(true);
  };

  // Send WhatsApp Reminder to Overdue Customer
  const handleSendReminder = (customer: OverdueCustomer) => {
    const message = `*PAYMENT REMINDER - ${(tenant?.name || 'TRADE SUPPLIES').toUpperCase()}*\n` +
      `--------------------------------\n` +
      `Dear ${customer.shopName},\n` +
      `This is a gentle reminder that an overdue balance of *₹${customer.balanceRupees.toLocaleString('en-IN')}* is pending on your B2B credit account.\n\n` +
      `*Bank / UPI Settlement Details:*\n` +
      `• UPI ID: *${tenant?.upiId || 'tradeledger@okhdfcbank'}*\n` +
      `• Bank A/C: *${tenant?.bankDetails?.accountNumber || '50200012345678'}* (${tenant?.bankDetails?.bankName || 'HDFC Bank'})\n` +
      `• IFSC: *${tenant?.bankDetails?.ifscCode || 'HDFC0001234'}*\n\n` +
      `Kindly clear the pending balance to keep your trade credit line active.\n` +
      `Thank you!\n` +
      `*${tenant?.name || 'TradeLedger'}* | Tel: ${tenant?.phone || '+91 9822100001'}`;

    const url = `https://api.whatsapp.com/send?phone=91${customer.phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Find max sales for chart scale
  const maxVal = Math.max(...dailyData.map(d => Math.max(d.salesRupees, d.collectionsRupees)), 10000);
  const activePoint = dailyData[activeDataIndex] || dailyData[dailyData.length - 1] || {
    day: 'Today',
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    salesRupees: currentSales,
    collectionsRupees: currentCollections,
    billCount: recentInvoices.length,
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & OPERATIONAL TELEMETRY */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                Executive Operations Dashboard
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {tenant?.name || 'Apex Trade & Wholesale'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Counter POS billing, drawer liquidity, B2B credit ledger, and stock reorder alerts.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchDashboardData}
            title="Refresh metrics"
            className="h-8 px-3 bg-white hover:bg-[#F8F9FA] text-[#475569] hover:text-[#0F172A] rounded-md border border-[#CBD5E1] text-xs font-medium transition flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C81E1E]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. ENTERPRISE 4-STAT METRIC STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Metric 1: Cash & UPI Realized Today */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              {t('dash.cash_upi_realized', 'Collections Realized')}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center border border-[#DCFCE7]">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">
              ₹{currentCollections.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#16A34A] font-medium mt-1">
              <TrendingUp className="w-3 h-3" />
              <span>{growthVsPreviousDay} vs prev day</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#F1F5F9] text-[10px] text-[#64748B] flex justify-between">
            <span>Liquid Drawer & UPI</span>
            <span className="font-semibold text-[#0F172A]">100% Settled</span>
          </div>
        </div>

        {/* Metric 2: Today's Billed Sales */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              {t('dash.today_billed_sales', "Today's Gross Sales")}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#DBEAFE]">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">
              ₹{currentSales.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#2563EB] font-medium mt-1">
              <Receipt className="w-3 h-3" />
              <span>{recentInvoices.length} {t('dash.bills_generated', 'tax invoices')}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#F1F5F9] text-[10px] text-[#64748B] flex justify-between">
            <span>Counter & Spares</span>
            <Link href="/invoices" className="text-[#2563EB] font-semibold hover:underline">
              Register →
            </Link>
          </div>
        </div>

        {/* Metric 3: Total Accounts Receivable */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Total Receivables Due
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FFFBEB] text-[#D97706] flex items-center justify-center border border-[#FEF3C7]">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">
              ₹{Math.max(0, totalMarketUdhaar).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-[#D97706] font-medium mt-1">
              {overdueCustomers.length > 0 ? `${overdueCustomers.length} accounts with balance` : 'All accounts settled'}
            </div>
          </div>
          <div className="pt-2 border-t border-[#F1F5F9] text-[10px] text-[#64748B] flex justify-between">
            <span>Market Outstanding</span>
            <Link href="/customers" className="text-[#D97706] font-semibold hover:underline">
              Accounts →
            </Link>
          </div>
        </div>

        {/* Metric 4: Low Stock Alert */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              {t('dash.low_stock_spares', 'Low Stock Alert')}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center border border-[#FEE2E2]">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A] flex items-baseline gap-1">
              <span>{lowStockCount}</span>
              <span className="text-xs font-normal text-[#64748B]">SKUs below reorder</span>
            </div>
            <div className="text-[11px] text-[#C81E1E] font-medium mt-1">
              Supplier restock needed
            </div>
          </div>
          <div className="pt-2 border-t border-[#F1F5F9] text-[10px] text-[#64748B] flex justify-between">
            <span>Critical Parts</span>
            <Link href="/inventory" className="text-[#C81E1E] font-semibold hover:underline">
              Restock →
            </Link>
          </div>
        </div>

      </div>

      {/* 3. 7-DAY SALES & REALIZED COLLECTIONS CHART */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
          <div>
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#0F172A]" />
              <span>Daily Sales & Collections Trajectory</span>
            </h2>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Comparison of daily billed sales vs realized cash & UPI drawer collections
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-xs bg-[#0F172A]" />
              <span className="text-[#475569] text-[11px]">Gross Billed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-xs bg-[#16A34A]" />
              <span className="text-[#475569] text-[11px]">Realized Cash/UPI</span>
            </div>
          </div>
        </div>

        {/* Active Point Telemetry Inspector */}
        <div className="bg-[#F8F9FA] border border-[#E2E8F0] rounded-md px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            <span>{activePoint.date} ({activePoint.day})</span>
          </div>
          <div className="flex items-center gap-6 font-mono tabular-nums text-xs">
            <div>
              <span className="text-[#64748B] font-sans">Billed: </span>
              <span className="text-[#0F172A] font-bold">₹{activePoint.salesRupees.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[#64748B] font-sans">Collected: </span>
              <span className="text-[#16A34A] font-bold">₹{activePoint.collectionsRupees.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Columns */}
        {dailyData.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-[#94A3B8]">
            <TrendingUp className="w-6 h-6 text-[#CBD5E1] mb-1.5" />
            <p className="text-xs font-medium text-[#475569]">No billing activity recorded in this period</p>
          </div>
        ) : (
          <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 pt-2 px-1">
            {dailyData.map((item, idx) => {
              const salesHeightPct = maxVal > 0 && item.salesRupees > 0 ? Math.max(6, Math.min(100, Math.round((item.salesRupees / maxVal) * 100))) : 0;
              const collectionsHeightPct = maxVal > 0 && item.collectionsRupees > 0 ? Math.max(6, Math.min(100, Math.round((item.collectionsRupees / maxVal) * 100))) : 0;
              const isSelected = activeDataIndex === idx;

              return (
                <div
                  key={item.day + idx}
                  onMouseEnter={() => setActiveDataIndex(idx)}
                  className={`flex-1 flex flex-col items-center cursor-pointer transition-all ${
                    isSelected ? 'opacity-100' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  {/* Bar Pair Container */}
                  <div className={`w-full flex items-end justify-center gap-1.5 h-32 rounded-md p-1.5 transition-all ${
                    isSelected ? 'bg-[#F1F5F9] border border-[#CBD5E1] shadow-2xs' : 'bg-[#F8F9FA] hover:bg-[#F1F5F9]'
                  }`}>
                    {/* Sales Bar */}
                    <div
                      style={{ height: salesHeightPct > 0 ? `${salesHeightPct}%` : '2px' }}
                      className={`w-1/2 rounded-t-sm transition-all duration-300 ${
                        salesHeightPct > 0 
                          ? (isSelected ? 'bg-[#0F172A]' : 'bg-[#334155]') 
                          : 'bg-[#E2E8F0]'
                      }`}
                    />
                    {/* Collections Bar */}
                    <div
                      style={{ height: collectionsHeightPct > 0 ? `${collectionsHeightPct}%` : '2px' }}
                      className={`w-1/2 rounded-t-sm transition-all duration-300 ${
                        collectionsHeightPct > 0 
                          ? (isSelected ? 'bg-[#16A34A]' : 'bg-[#22C55E]') 
                          : 'bg-[#E2E8F0]'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <div className="mt-1.5 text-center">
                    <div className={`text-[11px] ${isSelected ? 'font-bold text-[#0F172A]' : 'font-medium text-[#64748B]'}`}>
                      {item.day}
                    </div>
                    <div className="text-[10px] text-[#94A3B8] font-mono">
                      {item.date}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. OPERATIONAL SPLIT: B2B RECEIVABLES & CRITICAL LOW STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Left (7 Cols): Receivables Follow-up */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
            <div>
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#D97706]" />
                <span>B2B Receivables Follow-up</span>
              </h2>
              <p className="text-[11px] text-[#64748B] mt-0.5">Overdue accounts requiring collection</p>
            </div>
            <Link
              href="/customers"
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition"
            >
              All Accounts →
            </Link>
          </div>

          {overdueCustomers.length === 0 ? (
            <div className="py-6 text-center text-[#94A3B8] space-y-1">
              <CheckCircle2 className="w-6 h-6 text-[#16A34A] mx-auto" />
              <p className="text-xs font-medium text-[#334155]">All customer accounts are settled</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {overdueCustomers.slice(0, 5).map((customer) => (
                <div key={customer.id} className="py-2 flex items-center justify-between gap-2 hover:bg-[#F8F9FA] px-2 rounded-md transition-colors">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F172A] truncate">{customer.shopName}</div>
                    <div className="text-[10px] text-[#64748B] flex items-center gap-1.5 mt-0.5">
                      <span>{customer.name}</span>
                      <span>·</span>
                      <span className="font-mono">{customer.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-right shrink-0">
                    <div>
                      <div className="text-xs font-bold text-[#92400E] font-mono tabular-nums">
                        ₹{customer.balanceRupees.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-[#DC2626] font-medium">
                        {customer.daysOverdue}d overdue
                      </div>
                    </div>

                    <button
                      onClick={() => handleSendReminder(customer)}
                      className="h-7 inline-flex items-center gap-1 px-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-[10px] font-semibold rounded-md shadow-2xs transition"
                      title={t('dash.whatsapp_reminder', 'WhatsApp')}
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (5 Cols): Critical Low Stock */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
            <div>
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-[#C81E1E]" />
                <span>{t('dash.critical_low_stock', 'Low Stock Spares')}</span>
              </h2>
              <p className="text-[11px] text-[#64748B] mt-0.5">{t('dash.critical_low_stock_subtitle', 'Fast-moving parts requiring restock')}</p>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition"
            >
              {t('nav.inventory', 'Stock')} →
            </Link>
          </div>

          {lowStockParts.length === 0 ? (
            <div className="py-6 text-center text-[#94A3B8] space-y-1">
              <CheckCircle2 className="w-6 h-6 text-[#16A34A] mx-auto" />
              <p className="text-xs font-medium text-[#334155]">All spare parts stock levels healthy</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {lowStockParts.slice(0, 5).map((part) => (
                <div key={part.id} className="p-2.5 rounded-md border border-[#E2E8F0] bg-[#F8F9FA] flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0F172A] truncate">
                      {part.name}
                    </div>
                    <div className="text-[10px] font-mono text-[#64748B]">
                      SKU: {part.partNumber} · {part.category}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-[#FEF2F2] text-[#991B1B] font-semibold font-mono text-[10px] rounded border border-[#FEE2E2]">
                      {part.stockQty} {part.unit} (Min: {part.reorderLevel})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. RECENT COUNTER INVOICES REGISTRY */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
          <div>
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#0F172A]" />
              <span>Recent Counter Invoices</span>
            </h2>
            <p className="text-[11px] text-[#64748B] mt-0.5">Live stream of counter sales transactions</p>
          </div>
          <Link
            href="/invoices"
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition"
          >
            {t('nav.invoices', 'All Invoices')} →
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-8 text-center text-[#94A3B8] space-y-1">
            <Receipt className="w-6 h-6 text-[#CBD5E1] mx-auto" />
            <p className="text-xs font-medium text-[#334155]">No invoices generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[#E2E8F0]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3.5">{t('invs.invoice_no', 'Invoice #')}</th>
                  <th className="py-2.5 px-3.5">{t('invs.customer', 'Customer / Workshop')}</th>
                  <th className="py-2.5 px-3.5">{t('invs.date', 'Time')}</th>
                  <th className="py-2.5 px-3.5 text-right">{t('invs.total_amount', 'Amount (₹)')}</th>
                  <th className="py-2.5 px-3.5 text-center">{t('invs.status', 'Status')}</th>
                  <th className="py-2.5 px-3.5 text-right">{t('inv.actions', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className={`hover:bg-[#F8F9FA] transition-colors ${inv.status === 'CANCELLED' ? 'bg-[#FFF1F2]/40 opacity-75' : ''}`}>
                    <td className="py-2.5 px-3.5 font-mono font-semibold text-[#0F172A]">
                      <div className="flex items-center gap-1.5">
                        <span className={inv.status === 'CANCELLED' ? 'line-through text-[#94A3B8]' : ''}>
                          {inv.invoiceNumber}
                        </span>
                        {inv.status === 'CANCELLED' && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-[#FFE4E6] text-[#E11D48] border border-[#FECDD3]">
                            Cancelled
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-[#0F172A]">
                      <span className={inv.status === 'CANCELLED' ? 'line-through text-[#94A3B8]' : ''}>
                        {inv.customerName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-[#64748B] font-mono text-[11px]">
                      {inv.time}
                    </td>
                    <td className={`py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold ${
                      inv.status === 'CANCELLED' ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
                    }`}>
                      ₹{inv.totalRupees.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        inv.status === 'CANCELLED'
                          ? 'bg-[#FFE4E6] text-[#BE123C] border border-[#FECDD3]'
                          : !inv.isCredit 
                            ? 'bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7]' 
                            : 'bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]'
                      }`}>
                        {inv.status === 'CANCELLED' ? '● Cancelled' : (!inv.isCredit ? '● Paid' : '● Due')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => handleViewInvoice(inv)}
                        className="h-6.5 inline-flex items-center gap-1 px-2.5 bg-white hover:bg-[#F1F5F9] text-[#334155] font-medium text-[11px] rounded-md border border-[#CBD5E1] shadow-2xs transition"
                      >
                        <Eye className="w-3 h-3 text-[#64748B]" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={selectedPreviewInvoice}
      />
    </div>
  );
}
