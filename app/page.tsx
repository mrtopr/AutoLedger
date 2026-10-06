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
  CheckCircle2
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

interface OverdueGarage {
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
  time: string;
  totalRupees: number;
  paidRupees: number;
  isCredit: boolean;
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
  const [overdueGarages, setOverdueGarages] = useState<OverdueGarage[]>([]);
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
          const udhaarRs = Math.round(Number(BigInt(dashData.metrics.outstandingKhataPaise || 0)) / 100);
          const overdueRs = Math.round(Number(BigInt(dashData.metrics.overduePaise || 0)) / 100);

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
              salesRupees: Math.round((cd.sales || 0) * 100000),
              collectionsRupees: Math.round((cd.coll || 0) * 100000),
              billCount: 0,
            }));
            setDailyData(mappedTrends);
            setActiveDataIndex(mappedTrends.length - 1);
          }

          if (Array.isArray(dashData.recentTransactions)) {
            const mappedInvoices: RecentInvoice[] = dashData.recentTransactions.map((tx: any) => {
              const totalRs = Math.round(Number(BigInt(tx.amountPaise || 0)) / 100);
              const paidRs = Math.round(Number(BigInt(tx.paidPaise || 0)) / 100);
              return {
                id: tx.id,
                invoiceNumber: tx.invoiceNumber,
                customerName: tx.customer,
                time: tx.date || '',
                totalRupees: totalRs,
                paidRupees: paidRs,
                isCredit: tx.status === 'OVERDUE' || tx.status === 'PARTIAL',
              };
            });
            setRecentInvoices(mappedInvoices);
          }
        }
      }

      // Fetch overdue garages
      if (custRes.ok) {
        const custData = await custRes.json();
        const custList = custData.customers || (Array.isArray(custData) ? custData : []);
        const filteredGarages: OverdueGarage[] = custList
          .filter((c: any) => Number(BigInt(c.balancePaise || 0)) > 0)
          .map((c: any) => {
            const bal = Math.round(Number(BigInt(c.balancePaise || 0)) / 100);
            return {
              id: c.id,
              name: c.name || '',
              shopName: c.shopName || c.name || 'Workshop',
              phone: c.phone || '',
              balanceRupees: bal,
              daysOverdue: c.daysOverdue || 0,
              status: bal > 50000 ? 'HIGH' : bal > 20000 ? 'MEDIUM' : 'NORMAL',
            };
          });
        setOverdueGarages(filteredGarages);
      }

      // Fetch real low stock products
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const prodList = prodData.products || (Array.isArray(prodData) ? prodData : []);
        const filteredLowStock: LowStockPart[] = prodList
          .filter((p: any) => (p.stockQty || 0) <= (p.reorderLevel || 10))
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            partNumber: p.partNumber || '',
            stockQty: p.stockQty || 0,
            reorderLevel: p.reorderLevel || 10,
            unit: p.unit || 'pcs',
            category: p.category || 'General',
          }));
        setLowStockParts(filteredLowStock);
      }

    } catch (err) {
      console.warn('Error loading dashboard live metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle Preset Changes
  const applyPreset = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth') => {
    setSelectedRangePreset(preset);
    setIsDatePickerOpen(false);
    if (preset === 'today') setRangeLabel('Today');
    else if (preset === 'yesterday') setRangeLabel('Yesterday');
    else if (preset === '7days') setRangeLabel('Last 7 Days');
    else if (preset === '30days') setRangeLabel('Last 30 Days');
    else if (preset === 'thisMonth') setRangeLabel('This Month');
  };

  // Open Sample Invoice Preview
  const handleViewInvoice = (inv: RecentInvoice) => {
    const previewData: InvoicePreviewData = {
      invoiceNumber: inv.invoiceNumber,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: inv.time,
      placeOfSupply: tenant?.stateCode || '27 - Maharashtra',
      customer: {
        name: inv.customerName,
        shopName: inv.customerName,
        phone: '+91 98221 00001',
        address: 'Local Auto Market',
        gstin: '27AALPJ1122K1Z9',
      },
      items: [
        {
          name: 'Spare Parts & Services',
          partNumber: 'SPARE-001',
          hsnCode: '8714',
          qty: 1,
          unit: 'pcs',
          rateRupees: (inv.totalRupees / 1.18).toFixed(2),
          gstRateBp: 1800,
          totalPaise: Math.round(inv.totalRupees * 100),
        }
      ],
      taxableValuePaise: Math.round((inv.totalRupees / 1.18) * 100),
      cgstPaise: Math.round((inv.totalRupees - (inv.totalRupees / 1.18)) / 2 * 100),
      sgstPaise: Math.round((inv.totalRupees - (inv.totalRupees / 1.18)) / 2 * 100),
      grandTotalPaise: Math.round(inv.totalRupees * 100),
      paidNowPaise: Math.round(inv.paidRupees * 100),
      creditBalancePaise: Math.round((inv.totalRupees - inv.paidRupees) * 100),
      tenant: {
        name: tenant?.name || 'AutoLedger Dealership',
        legalName: tenant?.legalName || 'AutoLedger Spares Pvt Ltd',
        address: tenant?.address || 'Auto Market, Showroom No. 1',
        gstin: tenant?.gstin || '27ABCDE1234F1Z5',
        phone: tenant?.phone || '+91 9822100001',
        email: tenant?.email || 'billing@autoledger.com',
        stateCode: tenant?.stateCode || '27 - Maharashtra',
        bankName: tenant?.bankDetails?.bankName || 'HDFC Bank',
        accountNumber: tenant?.bankDetails?.accountNumber || '50200012345678',
        ifscCode: tenant?.bankDetails?.ifscCode || 'HDFC0001234',
        upiId: tenant?.upiId || 'autoledger@okhdfcbank',
      }
    };

    setSelectedPreviewInvoice(previewData);
    setIsPreviewModalOpen(true);
  };

  // Send WhatsApp Reminder to Overdue Garage
  const handleSendReminder = (garage: OverdueGarage) => {
    const message = `*PAYMENT REMINDER - ${(tenant?.name || 'AUTOLEDGER SPARES').toUpperCase()}*\n` +
      `--------------------------------\n` +
      `Dear ${garage.shopName},\n` +
      `This is a gentle reminder that an overdue balance of *₹${garage.balanceRupees.toLocaleString('en-IN')}* is pending on your Khata account.\n\n` +
      `*Bank / UPI Settlement Details:*\n` +
      `• UPI ID: *${tenant?.upiId || 'autoledger@okhdfcbank'}*\n` +
      `• Bank A/C: *${tenant?.bankDetails?.accountNumber || '50200012345678'}* (${tenant?.bankDetails?.bankName || 'HDFC Bank'})\n` +
      `• IFSC: *${tenant?.bankDetails?.ifscCode || 'HDFC0001234'}*\n\n` +
      `Kindly clear the pending balance to keep your spare parts credit line active.\n` +
      `Thank you!\n` +
      `*${tenant?.name || 'AutoLedger'}* | Tel: ${tenant?.phone || '+91 9822100001'}`;

    const url = `https://api.whatsapp.com/send?phone=91${garage.phone}&text=${encodeURIComponent(message)}`;
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
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. TOP HEADER & OPERATIONAL DATE CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>{language === 'hi' ? 'डीलरशिप डैशबोर्ड एवं मुख्य कार्य' : 'Dealership Overview & Operations'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {language === 'hi'
              ? 'रियल-टाइम काउंटर बिलिंग, नकद व UPI प्राप्ति, गैराज उधार खाता एवं स्पेयर पार्ट्स स्टॉक'
              : 'Real-time counter billing, liquid collections, garage credit khata, and OEM spare inventory'}
          </p>
        </div>

        {/* Date Selector & Quick New Bill */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            title="Refresh metrics"
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-2xs transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('app.new_bill', 'New Bill')} (N)</span>
          </Link>
        </div>
      </div>

      {/* 2. TOP 4 CORE DEALERSHIP METRICS (PURE INR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Billed Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.today_billed_sales', "Today's Billed Sales")}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono-numeric">
              ₹{currentSales.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{recentInvoices.length} {t('dash.bills_generated', 'bills generated')}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Counter Liquid Collections */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.cash_upi_realized', 'Cash & UPI Realized')}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono-numeric">
              ₹{currentCollections.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              {growthVsPreviousDay} vs previous period
            </div>
          </div>
        </div>

        {/* Metric 3: Total Outstanding Khata Udhaar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.garage_khata_due', 'Garage Khata Due')}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono-numeric">
              ₹{totalMarketUdhaar.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {overdueGarages.length} active khata accounts
            </div>
          </div>
        </div>

        {/* Metric 4: Critical Low Stock Alert */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.low_stock_spares', 'Low Stock Spares')}</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono-numeric">
              {lowStockCount} <span className="text-sm font-sans font-normal text-slate-400">SKUs</span>
            </div>
            <div className="text-[11px] text-red-600 font-medium mt-1">
              {t('dash.parts_below_threshold', 'Below critical reorder threshold')}
            </div>
          </div>
        </div>
      </div>

      {/* 3. CORE BUSINESS GRAPH: 7-DAY SALES & COLLECTIONS TREND */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Daily Sales & Cash/UPI Collections Trend</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hover over any day to inspect daily billing volume vs realized cash & UPI collections
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-600 shadow-2xs" />
              <span className="text-slate-700">Gross Billed Sales</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500 shadow-2xs" />
              <span className="text-slate-700">Collected Cash/UPI</span>
            </div>
          </div>
        </div>

        {/* Active Inspection Card */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{activePoint.date} ({activePoint.day})</span>
          </div>
          <div className="flex items-center gap-6 font-mono font-medium">
            <div>
              <span className="text-slate-500 font-sans font-normal text-[11px]">Billed Sales: </span>
              <span className="text-blue-700 font-semibold">₹{activePoint.salesRupees.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans font-normal text-[11px]">Collected: </span>
              <span className="text-emerald-700 font-semibold">₹{activePoint.collectionsRupees.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Dual Bar / Trend Visualization */}
        {dailyData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No billing activity recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Generate your first invoice to view live daily trends</p>
          </div>
        ) : (
          <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-4 px-2">
            {dailyData.map((item, idx) => {
              const salesHeightPct = maxVal > 0 ? Math.min(100, Math.round((item.salesRupees / maxVal) * 100)) : 0;
              const collectionsHeightPct = maxVal > 0 ? Math.min(100, Math.round((item.collectionsRupees / maxVal) * 100)) : 0;
              const isSelected = activeDataIndex === idx;

              return (
                <div
                  key={item.day + idx}
                  onMouseEnter={() => setActiveDataIndex(idx)}
                  className={`flex-1 flex flex-col items-center cursor-pointer transition group relative ${
                    isSelected ? 'scale-[1.02]' : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* Bar Pair */}
                  <div className={`w-full flex items-end justify-center gap-1.5 h-48 rounded-xl p-1.5 transition-all ${
                    isSelected ? 'bg-blue-50/60 ring-1 ring-blue-200/80 shadow-xs' : 'bg-slate-50/70 hover:bg-slate-100/60'
                  }`}>
                    {/* Sales Bar (Electric Royal Blue) */}
                    <div
                      style={{ height: `${Math.max(salesHeightPct, 3)}%` }}
                      className={`w-1/2 rounded-t-md transition-all duration-300 ${
                        isSelected ? 'bg-blue-600 shadow-sm ring-1 ring-blue-400' : 'bg-blue-500/85 group-hover:bg-blue-600'
                      }`}
                    />
                    {/* Collections Bar (Mint Emerald) */}
                    <div
                      style={{ height: `${Math.max(collectionsHeightPct, 3)}%` }}
                      className={`w-1/2 rounded-t-md transition-all duration-300 ${
                        isSelected ? 'bg-emerald-500 shadow-sm ring-1 ring-emerald-300' : 'bg-emerald-400/90 group-hover:bg-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <div className="mt-2 text-center">
                    <div className={`text-xs ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                      {item.day}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.date}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. SPLIT TWO-COLUMN ROW: GARAGE KHATA DUE & CRITICAL STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left (7 Cols): Garage Khata Due */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>{t('dash.garage_khata_followup', 'Garage Khata Collection Follow-up')}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('dash.garage_khata_subtitle', 'Top overdue garage accounts requiring collection')}</p>
            </div>
            <Link
              href="/customers"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              {t('dash.view_all_khata', 'View All Khata')} →
            </Link>
          </div>

          {overdueGarages.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">All customer khata accounts are clear</p>
              <p className="text-[11px] text-slate-400">No pending or overdue credit balances</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdueGarages.slice(0, 5).map((garage) => (
                <div key={garage.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl transition">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-900">{garage.shopName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{language === 'hi' ? 'संपर्क:' : 'Contact:'} {garage.name}</span>
                      <span>·</span>
                      <span className="font-mono">{garage.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="text-xs font-bold text-amber-700 font-mono-numeric">
                        ₹{garage.balanceRupees.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-red-600 font-medium">
                        {garage.daysOverdue} {t('dash.days_overdue', 'days overdue')}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSendReminder(garage)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-[11px] font-semibold rounded-lg shadow-2xs transition"
                      title={t('dash.whatsapp_reminder', 'WhatsApp')}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('dash.whatsapp_reminder', 'WhatsApp')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (5 Cols): Critical Low Stock Spare Parts */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-[#DC2626]" />
                <span>{t('dash.critical_low_stock', 'Critical Low Stock Spares')}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('dash.critical_low_stock_subtitle', 'Fast-moving parts requiring restock')}</p>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              {t('nav.inventory', 'Inventory')} →
            </Link>
          </div>

          {lowStockParts.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">All inventory levels healthy</p>
              <p className="text-[11px] text-slate-400">No parts currently below reorder levels</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStockParts.slice(0, 5).map((part) => (
                <div key={part.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-[220px]">
                      {part.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      SKU: {part.partNumber} · {part.category}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 font-semibold font-mono text-[10px] rounded border border-red-200">
                      {part.stockQty} {part.unit} {t('dash.left_min', 'left (Min:')} {part.reorderLevel})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. RECENT COUNTER BILLS STREAM */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-700" />
              <span>{language === 'hi' ? 'हालिया काउंटर बिल एवं बिक्री' : 'Recent Counter Bills & Invoices'}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{language === 'hi' ? 'ताज़ा बिक्री और भुगतान का विवरण' : 'Live stream of latest sales transactions'}</p>
          </div>
          <Link
            href="/invoices"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            {t('nav.invoices', 'Billing Register')} →
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-10 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No invoices generated yet</p>
            <p className="text-[11px] text-slate-400">Click &quot;New Bill&quot; above to create your first counter invoice</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2 px-3">{t('invs.invoice_no', 'Invoice #')}</th>
                  <th className="py-2 px-3">{t('invs.customer', 'Customer / Garage')}</th>
                  <th className="py-2 px-3">{t('invs.date', 'Time')}</th>
                  <th className="py-2 px-3 text-right">{t('invs.total_amount', 'Amount (₹)')}</th>
                  <th className="py-2 px-3 text-center">{t('invs.status', 'Status')}</th>
                  <th className="py-2 px-3 text-right">{t('inv.actions', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {inv.customerName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {inv.time}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-numeric font-semibold text-slate-900">
                      ₹{inv.totalRupees.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        !inv.isCredit 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {!inv.isCredit 
                          ? (language === 'hi' ? '● चुकता (Paid)' : '● Paid') 
                          : (language === 'hi' ? '● उधार (Khata)' : '● Due on Khata')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleViewInvoice(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-medium text-[11px] rounded-lg border border-slate-200 shadow-2xs transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>{language === 'hi' ? 'बिल देखें' : 'View Bill'}</span>
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
