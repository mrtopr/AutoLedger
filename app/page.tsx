'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import InvoicePreviewModal, { InvoicePreviewData } from './components/InvoicePreviewModal';
import { 
  Receipt, 
  Wallet, 
  BookOpen, 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  Plus, 
  MessageCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  Package, 
  Printer, 
  Eye, 
  FileText, 
  Users, 
  Boxes, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  Sparkles,
  RefreshCw,
  Search
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';

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
  const [rangeLabel, setRangeLabel] = useState('Last 7 Days (30 Sep - 6 Oct 2026)');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Active hover/selected point on graph
  const [activeDataIndex, setActiveDataIndex] = useState<number>(6); // Default to last day (today)

  // Invoice Preview Modal
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState<InvoicePreviewData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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

  // 7-Day Performance Trend (Sales vs Collections)
  const [dailyData, setDailyData] = useState<DailyTrend[]>([
    { day: 'Wed', date: '30 Sep', salesRupees: 142500, collectionsRupees: 120000, billCount: 28 },
    { day: 'Thu', date: '01 Oct', salesRupees: 185000, collectionsRupees: 160500, billCount: 36 },
    { day: 'Fri', date: '02 Oct', salesRupees: 210000, collectionsRupees: 195000, billCount: 44 },
    { day: 'Sat', date: '03 Oct', salesRupees: 285400, collectionsRupees: 250000, billCount: 58 },
    { day: 'Sun', date: '04 Oct', salesRupees: 95000,  collectionsRupees: 88000,  billCount: 19 },
    { day: 'Mon', date: '05 Oct', salesRupees: 198200, collectionsRupees: 172000, billCount: 39 },
    { day: 'Tue', date: '06 Oct', salesRupees: 248650, collectionsRupees: 215300, billCount: 48 },
  ]);

  // Dealership Metrics based on selection
  const currentSales = 248650;
  const currentCollections = 215300;
  const totalMarketUdhaar = 584200;
  const lowStockCount = 6;

  // Actionable Overdue Garages
  const overdueGarages: OverdueGarage[] = [
    { id: '1', name: 'Ramesh Jadhav', shopName: 'Ramesh Auto Works & Garage', phone: '9822100001', balanceRupees: 42500, daysOverdue: 24, status: 'HIGH' },
    { id: '2', name: 'Vikram Shinde', shopName: 'Om Sai Two Wheeler Care', phone: '9822100002', balanceRupees: 31800, daysOverdue: 18, status: 'HIGH' },
    { id: '3', name: 'Pravin Pawar', shopName: 'Pravin Bike Point', phone: '9822100003', balanceRupees: 24000, daysOverdue: 14, status: 'MEDIUM' },
    { id: '4', name: 'Sunil Jagtap', shopName: 'New Maharashtra Auto Garage', phone: '9822100004', balanceRupees: 18500, daysOverdue: 10, status: 'NORMAL' },
  ];

  // Critical Low Stock Spares
  const lowStockParts: LowStockPart[] = [
    { id: 'p1', name: 'Drive Chain & Sprocket Kit OEM', partNumber: '40530-KTC-900', stockQty: 3, reorderLevel: 15, unit: 'set', category: 'Transmission' },
    { id: 'p2', name: 'Front Brake Pad Set Premium', partNumber: '06455-KPP-901', stockQty: 4, reorderLevel: 20, unit: 'set', category: 'Braking' },
    { id: 'p3', name: 'Honda 4T 10W-30 Engine Oil (1L)', partNumber: 'OIL-4T-10W30', stockQty: 8, reorderLevel: 50, unit: 'can', category: 'Lubricants' },
    { id: 'p4', name: 'Spark Plug Resistor NGK CPR8EA', partNumber: '31918-K96-V01', stockQty: 5, reorderLevel: 25, unit: 'pcs', category: 'Electrical' },
    { id: 'p5', name: 'Clutch Plate Friction Disk Set', partNumber: '22201-KTC-900', stockQty: 2, reorderLevel: 12, unit: 'set', category: 'Engine' },
  ];

  // Recent Counter Invoices
  const recentInvoices: RecentInvoice[] = [
    { id: 'inv-101', invoiceNumber: 'INV/2026-27/0048', customerName: 'Ramesh Auto Works & Garage', time: '10:42 am', totalRupees: 3481, paidRupees: 3481, isCredit: false },
    { id: 'inv-102', invoiceNumber: 'INV/2026-27/0047', customerName: 'Om Sai Two Wheeler Care', time: '10:15 am', totalRupees: 6850, paidRupees: 2000, isCredit: true },
    { id: 'inv-103', invoiceNumber: 'INV/2026-27/0046', customerName: 'Walk-in Customer (MH-12)', time: '09:50 am', totalRupees: 890, paidRupees: 890, isCredit: false },
    { id: 'inv-104', invoiceNumber: 'INV/2026-27/0045', customerName: 'Pravin Bike Point', time: '09:20 am', totalRupees: 4200, paidRupees: 0, isCredit: true },
    { id: 'inv-105', invoiceNumber: 'INV/2026-27/0044', customerName: 'New Maharashtra Auto Garage', time: '08:55 am', totalRupees: 1850, paidRupees: 1850, isCredit: false },
  ];

  // Handle Preset Changes
  const applyPreset = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth') => {
    setSelectedRangePreset(preset);
    setIsDatePickerOpen(false);
    if (preset === 'today') setRangeLabel('Today (6 Oct 2026)');
    else if (preset === 'yesterday') setRangeLabel('Yesterday (5 Oct 2026)');
    else if (preset === '7days') setRangeLabel('Last 7 Days (30 Sep - 6 Oct 2026)');
    else if (preset === '30days') setRangeLabel('Last 30 Days (7 Sep - 6 Oct 2026)');
    else if (preset === 'thisMonth') setRangeLabel('This Month (Oct 2026)');
  };

  // Open Sample Invoice Preview
  const handleViewInvoice = (inv: RecentInvoice) => {
    const previewData: InvoicePreviewData = {
      invoiceNumber: inv.invoiceNumber,
      date: '06 Oct 2026',
      time: inv.time,
      placeOfSupply: tenant?.stateCode || '27 - Maharashtra',
      customer: {
        name: inv.customerName,
        shopName: inv.customerName,
        phone: '+91 98221 00001',
        address: 'Nana Peth Auto Market, Pune',
        gstin: '27AALPJ1122K1Z9',
      },
      items: [
        {
          name: 'Drive Chain & Sprocket Kit OEM',
          partNumber: '40530-KTC-900',
          hsnCode: '8714',
          qty: 1,
          unit: 'set',
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
      }
    };

    setSelectedPreviewInvoice(previewData);
    setIsPreviewModalOpen(true);
  };

  // Send WhatsApp Reminder to Overdue Garage
  const handleSendReminder = (garage: OverdueGarage) => {
    const message = `*PAYMENT REMINDER - ${(tenant?.name || 'ROYAL AUTO SPARES').toUpperCase()}*\n` +
      `--------------------------------\n` +
      `Dear ${garage.shopName},\n` +
      `This is a gentle reminder that an overdue balance of *₹${garage.balanceRupees.toLocaleString('en-IN')}* is pending on your Khata account (${garage.daysOverdue} days overdue).\n\n` +
      `*Bank / UPI Settlement Details:*\n` +
      `• UPI ID: *${tenant?.upiId || 'royalauto@okhdfcbank'}*\n` +
      `• Bank A/C: *${tenant?.bankDetails?.accountNumber || '50200012345678'}* (${tenant?.bankDetails?.bankName || 'HDFC Bank'})\n` +
      `• IFSC: *${tenant?.bankDetails?.ifscCode || 'HDFC0001234'}*\n\n` +
      `Kindly clear the pending balance to keep your spare parts credit line active.\n` +
      `Thank you!\n` +
      `*${tenant?.name || 'Royal Auto Spares'}* | Tel: ${tenant?.phone || '+91 9822100001'}`;

    const url = `https://api.whatsapp.com/send?phone=91${garage.phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Find max sales for chart scale
  const maxVal = Math.max(...dailyData.map(d => Math.max(d.salesRupees, d.collectionsRupees)), 300000);
  const activePoint = dailyData[activeDataIndex] || dailyData[dailyData.length - 1];

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
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 shadow-2xs transition"
            >
              <Calendar className="w-4 h-4 text-[#DC2626]" />
              <span>{rangeLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 space-y-1 animate-in fade-in">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  {language === 'hi' ? 'तारीख का चयन करें' : 'Filter Date Range'}
                </div>
                <button
                  onClick={() => applyPreset('today')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex justify-between ${
                    selectedRangePreset === 'today' ? 'bg-red-50 text-[#DC2626]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{language === 'hi' ? 'आज (Today)' : 'Today'}</span>
                  <span className="text-[10px] text-slate-400">6 Oct</span>
                </button>
                <button
                  onClick={() => applyPreset('yesterday')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex justify-between ${
                    selectedRangePreset === 'yesterday' ? 'bg-red-50 text-[#DC2626]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{language === 'hi' ? 'कल (Yesterday)' : 'Yesterday'}</span>
                  <span className="text-[10px] text-slate-400">5 Oct</span>
                </button>
                <button
                  onClick={() => applyPreset('7days')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex justify-between ${
                    selectedRangePreset === '7days' ? 'bg-red-50 text-[#DC2626]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{language === 'hi' ? 'पिछले 7 दिन (7 Days)' : 'Last 7 Days'}</span>
                  <span className="text-[10px] text-slate-400">This week</span>
                </button>
                <button
                  onClick={() => applyPreset('thisMonth')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex justify-between ${
                    selectedRangePreset === 'thisMonth' ? 'bg-red-50 text-[#DC2626]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{language === 'hi' ? 'इस महीने (This Month)' : 'This Month'}</span>
                  <span className="text-[10px] text-slate-400">Oct 2026</span>
                </button>
                <button
                  onClick={() => applyPreset('30days')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex justify-between ${
                    selectedRangePreset === '30days' ? 'bg-red-50 text-[#DC2626]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{language === 'hi' ? 'पिछले 30 दिन (30 Days)' : 'Last 30 Days'}</span>
                  <span className="text-[10px] text-slate-400">Monthly</span>
                </button>
              </div>
            )}
          </div>

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
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono-numeric">
              ₹{currentSales.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>48 {t('dash.bills_generated', 'bills generated today')}</span>
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
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              ₹1,25,000 {t('dash.cash', 'Cash')} · ₹90,300 {t('dash.upi', 'UPI')}
            </div>
          </div>
        </div>

        {/* Metric 3: Market Udhaar / Khata Due */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.garage_khata_due', 'Garage Khata Due')}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700 font-mono-numeric">
              ₹{totalMarketUdhaar.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {t('dash.across_workshops', 'Across 14 local repair workshops')}
            </div>
          </div>
        </div>

        {/* Metric 4: Low Stock Alert */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.low_stock_spares', 'Low Stock Spares')}</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#DC2626] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#DC2626] font-mono-numeric">
              {lowStockCount} {language === 'hi' ? 'पार्ट्स' : 'Parts'}
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
              <TrendingUp className="w-4 h-4 text-slate-700" />
              <span>Daily Sales & Cash/UPI Collections Trend</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hover over any day to inspect daily billing volume vs realized cash & UPI collections
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-800" />
              <span className="text-slate-700">Gross Billed Sales</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-600" />
              <span className="text-slate-700">Collected Cash/UPI</span>
            </div>
          </div>
        </div>

        {/* Active Inspection Card */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{activePoint.date} ({activePoint.day})</span>
          </div>
          <div className="flex items-center gap-6 font-mono font-medium">
            <div>
              <span className="text-slate-500 font-sans font-normal text-[11px]">Billed Sales: </span>
              <span className="text-slate-900 font-semibold">₹{activePoint.salesRupees.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans font-normal text-[11px]">Collected: </span>
              <span className="text-emerald-700 font-semibold">₹{activePoint.collectionsRupees.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans font-normal text-[11px]">Invoices: </span>
              <span className="text-slate-800 font-semibold">{activePoint.billCount} bills</span>
            </div>
          </div>
        </div>

        {/* Dual Bar / Trend Visualization */}
        <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-4 px-2">
          {dailyData.map((item, idx) => {
            const salesHeightPct = Math.min(100, Math.round((item.salesRupees / maxVal) * 100));
            const collectionsHeightPct = Math.min(100, Math.round((item.collectionsRupees / maxVal) * 100));
            const isSelected = activeDataIndex === idx;

            return (
              <div
                key={item.day}
                onMouseEnter={() => setActiveDataIndex(idx)}
                className={`flex-1 flex flex-col items-center cursor-pointer transition group relative ${
                  isSelected ? 'scale-[1.02]' : 'opacity-85 hover:opacity-100'
                }`}
              >
                {/* Bar Pair */}
                <div className={`w-full flex items-end justify-center gap-1.5 h-48 rounded-xl p-1.5 transition-colors ${
                  isSelected ? 'bg-slate-100/90 ring-1 ring-slate-200' : 'bg-slate-50/70 hover:bg-slate-100/50'
                }`}>
                  {/* Sales Bar */}
                  <div
                    style={{ height: `${salesHeightPct}%` }}
                    className={`w-1/2 rounded-t transition-all duration-300 ${
                      isSelected ? 'bg-slate-900 shadow-sm' : 'bg-slate-700 group-hover:bg-slate-800'
                    }`}
                  />
                  {/* Collections Bar */}
                  <div
                    style={{ height: `${collectionsHeightPct}%` }}
                    className={`w-1/2 rounded-t transition-all duration-300 ${
                      isSelected ? 'bg-emerald-600 shadow-sm' : 'bg-emerald-500 group-hover:bg-emerald-600'
                    }`}
                  />
                </div>

                {/* Day Label */}
                <div className="mt-2 text-center">
                  <div className={`text-xs ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                    {item.day}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {item.date.split(' ')[0]} {item.date.split(' ')[1]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. TWO-COLUMN OPERATIONAL SECTION: OVERDUE KHATA & CRITICAL SPARES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left (7 Cols): Garage Khata Collection Follow-up */}
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

          <div className="divide-y divide-slate-100">
            {overdueGarages.map((garage) => (
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

          <div className="space-y-2.5">
            {lowStockParts.map((part) => (
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
