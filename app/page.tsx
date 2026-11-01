'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { 
  Receipt, 
  CreditCard, 
  Boxes, 
  Building2, 
  MessageCircle, 
  ExternalLink,
  Plus,
  ArrowRight,
  TrendingUp,
  Package,
  User,
  CheckCircle2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
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

  // Period Selector State
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'month' | 'year' | 'all'>('today');

  // Modal State
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState<InvoicePreviewData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Dynamic telemetry loaded from API
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyTrend[]>([]);
  const [currentSales, setCurrentSales] = useState<number>(0);
  const [currentCollections, setCurrentCollections] = useState<number>(0);
  const [cashCollections, setCashCollections] = useState<number>(0);
  const [upiCollections, setUpiCollections] = useState<number>(0);
  const [totalMarketUdhaar, setTotalMarketUdhaar] = useState<number>(0);
  const [totalOverdue, setTotalOverdue] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [growthVsPreviousDay, setGrowthVsPreviousDay] = useState<string>('+0.0%');
  const [overdueCustomers, setOverdueCustomers] = useState<OverdueCustomer[]>([]);
  const [lowStockParts, setLowStockParts] = useState<LowStockPart[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);

  // Keyboard shortcut listener (e.g. F2 for new bill)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (!isInputFocused) {
        if (e.key === 'F2') {
          e.preventDefault();
          router.push('/pos');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Fetch real dynamic telemetry from API
  const fetchDashboardData = async (period: 'today' | 'month' | 'year' | 'all' = selectedPeriod) => {
    try {
      setLoading(true);
      const [dashRes, invRes] = await Promise.all([
        fetch(`/api/v1/dashboard?period=${period}`),
        fetch('/api/v1/invoices?limit=10')
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData.success && dashData.metrics) {
          const salesRs = Math.round(Number(BigInt(dashData.metrics.todaySalesPaise || 0)) / 100);
          const collRs = Math.round(Number(BigInt(dashData.metrics.collectedTodayPaise || 0)) / 100);
          const cashRs = Math.round(Number(BigInt(dashData.metrics.cashCollectedPaise || dashData.metrics.cashPaise || 0)) / 100);
          const upiRs = Math.round(Number(BigInt(dashData.metrics.upiCollectedPaise || dashData.metrics.upiPaise || 0)) / 100);
          const udhaarRs = Math.max(0, Math.round(Number(BigInt(dashData.metrics.outstandingKhataPaise || 0)) / 100));
          const overdueRs = Math.max(0, Math.round(Number(BigInt(dashData.metrics.overduePaise || 0)) / 100));

          setCurrentSales(salesRs);
          setCurrentCollections(collRs);
          setCashCollections(cashRs);
          setUpiCollections(upiRs);
          setTotalMarketUdhaar(udhaarRs);
          setTotalOverdue(overdueRs);
          if (dashData.metrics.lowStockCount !== undefined) {
            setLowStockCount(dashData.metrics.lowStockCount);
          }
          setGrowthVsPreviousDay(dashData.growthVsPreviousDay || '+0.0%');

          if (Array.isArray(dashData.chartDays) && dashData.chartDays.length > 0) {
            const mappedTrends: DailyTrend[] = dashData.chartDays.map((cd: any) => ({
              day: cd.day || '',
              date: cd.date || '',
              salesRupees: cd.salesRupees ?? Math.round((cd.sales || 0) * 100000),
              collectionsRupees: cd.collectionsRupees ?? Math.round((cd.coll || 0) * 100000),
              billCount: cd.billCount || 0,
            }));
            setDailyData(mappedTrends);
          }

          if (Array.isArray(dashData.overdueCustomers)) {
            setOverdueCustomers(dashData.overdueCustomers);
          }

          if (Array.isArray(dashData.lowStockParts)) {
            setLowStockParts(dashData.lowStockParts);
          }
        }
      }

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

  // WhatsApp reminder handler
  const handleSendReminder = (customer: OverdueCustomer) => {
    const shop = customer.shopName || customer.name || 'Valued Partner';
    const message = `*PAYMENT REMINDER - ${(tenant?.name || 'TRADE SUPPLIES').toUpperCase()}*\n` +
      `--------------------------------\n` +
      `Dear ${shop},\n` +
      `This is a gentle reminder that a balance of *₹${customer.balanceRupees.toLocaleString('en-IN')}* is pending on your B2B Khata credit account.\n\n` +
      `*Bank / UPI Settlement Details:*\n` +
      `• UPI ID: *${tenant?.upiId || 'tradeledger@okhdfcbank'}*\n` +
      `• Bank A/C: *${tenant?.bankDetails?.accountNumber || '50200012345678'}* (${tenant?.bankDetails?.bankName || 'HDFC Bank'})\n` +
      `• IFSC: *${tenant?.bankDetails?.ifscCode || 'HDFC0001234'}*\n\n` +
      `Kindly clear the pending balance to keep your trade credit line active.\n` +
      `Thank you!\n` +
      `*${tenant?.name || 'TradeLedger'}* | Tel: ${tenant?.phone || '+91 9822100001'}`;

    const phone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
    const targetPhone = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // Greeting based on current local hour
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 
    ? 'Good morning' 
    : currentHour < 17 
    ? 'Good afternoon' 
    : 'Good evening';

  const userName = user?.name ? user.name.split(' ')[0] : 'Sachin';
  const todayFormatted = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());
  const showroomLocation = tenant?.address ? tenant.address.split(',')[0].trim() : 'Honda counter';

  // Dynamic 7-day trend ending today
  const chartDaysList = useMemo(() => {
    if (dailyData.length === 7) return dailyData;
    const days: DailyTrend[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const matched = dailyData.find(item => item.day === dayLabel || item.date === dayLabel);
      if (matched) {
        days.push(matched);
      } else {
        days.push({
          day: dayLabel,
          date: dayLabel,
          salesRupees: 0,
          collectionsRupees: 0,
          billCount: 0,
        });
      }
    }
    return days;
  }, [dailyData]);

  // Max value for scaling SVG bar heights
  const maxChartVal = useMemo(() => {
    const highest = Math.max(1, ...chartDaysList.map(d => Math.max(d.salesRupees, d.collectionsRupees)));
    return highest;
  }, [chartDaysList]);

  // Aging calculation buckets
  const agingBuckets = {
    d0_30: totalMarketUdhaar,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
  };

  // Calculate cash vs UPI split width
  const totalReceived = cashCollections + upiCollections;
  const cashPercent = totalReceived > 0 ? Math.round((cashCollections / totalReceived) * 100) : 50;
  const upiPercent = totalReceived > 0 ? 100 - cashPercent : 50;

  return (
    <div className="w-full text-[#12161C] font-sans antialiased space-y-5">
      {/* 1. HEADER SECTION */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#12161C]">
            {greeting}, {userName}
          </h1>
          <p className="text-xs sm:text-[13px] text-[#556273] font-medium mt-1">
            {todayFormatted} · {showroomLocation}
          </p>
        </div>

        {/* Time Segment Filter */}
        <div className="flex items-center bg-white border border-[#E3E8EE] rounded-[10px] p-[3px] shadow-2xs self-start sm:self-auto" role="group" aria-label="Range">
          <button
            type="button"
            onClick={() => {
              setSelectedPeriod('today');
              fetchDashboardData('today');
            }}
            className={`h-9 px-3.5 rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === 'today'
                ? 'bg-[#E2E7ED] text-[#12161C]'
                : 'text-[#556273] hover:text-[#12161C]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPeriod('month');
              fetchDashboardData('month');
            }}
            className={`h-9 px-3.5 rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === 'month'
                ? 'bg-[#E2E7ED] text-[#12161C]'
                : 'text-[#556273] hover:text-[#12161C]'
            }`}
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPeriod('year');
              fetchDashboardData('year');
            }}
            className={`h-9 px-3.5 rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === 'year'
                ? 'bg-[#E2E7ED] text-[#12161C]'
                : 'text-[#556273] hover:text-[#12161C]'
            }`}
          >
            This year
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPeriod('all');
              fetchDashboardData('all');
            }}
            className={`h-9 px-3.5 rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
              selectedPeriod === 'all'
                ? 'bg-[#E2E7ED] text-[#12161C]'
                : 'text-[#556273] hover:text-[#12161C]'
            }`}
          >
            All time
          </button>
        </div>
      </section>

      {/* 2. QUICK ACTIONS ROW */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Quick actions">
        <button
          type="button"
          onClick={() => router.push('/pos')}
          className="flex items-center gap-3 bg-white border border-[#E3E8EE] hover:border-[#AEB9C7] rounded-[12px] p-3 text-left font-bold text-[#12161C] shadow-2xs transition-all cursor-pointer group"
        >
          <i className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF1F5] group-hover:bg-red-50 text-slate-700 group-hover:text-[#C81E1E] flex items-center justify-center not-italic transition-colors">
            <Plus className="w-[18px] h-[18px]" />
          </i>
          <span className="text-[13px]">New bill</span>
          <span className="ml-auto font-mono text-[11px] text-[#5F6B7B] border border-[#CDD5DF] rounded-[5px] px-1.5 py-0.5">
            F2
          </span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/customers')}
          className="flex items-center gap-3 bg-white border border-[#E3E8EE] hover:border-[#AEB9C7] rounded-[12px] p-3 text-left font-bold text-[#12161C] shadow-2xs transition-all cursor-pointer group"
        >
          <i className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF1F5] group-hover:bg-amber-50 text-slate-700 group-hover:text-amber-700 flex items-center justify-center not-italic transition-colors">
            <CreditCard className="w-[18px] h-[18px]" />
          </i>
          <span className="text-[13px]">Receive payment</span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/inventory')}
          className="flex items-center gap-3 bg-white border border-[#E3E8EE] hover:border-[#AEB9C7] rounded-[12px] p-3 text-left font-bold text-[#12161C] shadow-2xs transition-all cursor-pointer group"
        >
          <i className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF1F5] group-hover:bg-emerald-50 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center not-italic transition-colors">
            <Boxes className="w-[18px] h-[18px]" />
          </i>
          <span className="text-[13px]">Add stock</span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/settlement')}
          className="flex items-center gap-3 bg-white border border-[#E3E8EE] hover:border-[#AEB9C7] rounded-[12px] p-3 text-left font-bold text-[#12161C] shadow-2xs transition-all cursor-pointer group"
        >
          <i className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF1F5] group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 flex items-center justify-center not-italic transition-colors">
            <Building2 className="w-[18px] h-[18px]" />
          </i>
          <span className="text-[13px]">Close the day</span>
        </button>
      </section>

      {/* 3. 12-COLUMN BENTO GRID */}
      <div className="grid grid-cols-12 gap-4">
        {/* CARD 1: Collections today (Span 5, Row Span 2) */}
        <article className="col-span-12 lg:col-span-5 lg:row-span-2 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">Collections today</h2>
            {currentCollections > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-[rgba(63,185,80,.14)] text-[#1A7F37]">
                Received
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-[#EEF1F5] text-[#3E4A5A]">
                Nothing yet
              </span>
            )}
          </div>

          <div>
            <div className="font-mono font-bold tracking-tight text-[48px] sm:text-[56px] leading-none text-[#12161C]">
              ₹{currentCollections.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-[#556273] font-medium mt-2.5 mb-0">
              {currentCollections > 0
                ? 'Live payment collections recorded today across counter & UPI.'
                : 'No payments received today. Yesterday: ₹0.'}
            </p>
          </div>

          {/* Intraday / Trend SVG Wave */}
          <div className="w-full my-2">
            <svg viewBox="0 0 400 70" width="100%" height="70" role="img" aria-label="Collections trend" className="overflow-visible">
              <line x1="0" y1="60" x2="400" y2="60" stroke="#CDD5DF" strokeDasharray="4 6" />
              {currentCollections > 0 ? (
                <>
                  <polyline
                    points="0,60 80,60 160,35 240,45 320,25 400,20"
                    fill="none"
                    stroke="#1A7F37"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="400" cy="20" r="4.5" fill="#1A7F37" />
                </>
              ) : (
                <>
                  <polyline
                    points="0,60 120,60 180,40 240,58 400,60"
                    fill="none"
                    stroke="#1A7F37"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="400" cy="60" r="4" fill="#1A7F37" />
                </>
              )}
            </svg>
          </div>

          {/* Cash vs UPI Split */}
          <div>
            <div className="flex justify-between text-xs text-[#556273] font-semibold mb-1.5">
              <span>Cash ₹{cashCollections.toLocaleString('en-IN')}</span>
              <span>UPI ₹{upiCollections.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex h-2.5 rounded-[6px] overflow-hidden bg-[#EEF1F5] gap-[2px]">
              <span
                style={{ width: `${cashPercent}%` }}
                className="bg-[#1A7F37] transition-all duration-300"
              />
              <span
                style={{ width: `${upiPercent}%` }}
                className="bg-[#6B7F99] transition-all duration-300"
              />
            </div>
          </div>
        </article>

        {/* CARD 2: Khata due (Span 4) */}
        <article className="col-span-12 md:col-span-6 lg:col-span-4 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">Khata due</h2>
            <Link href="/customers" className="text-xs font-bold text-[#12161C] hover:text-[#C81E1E] transition-colors">
              Open ledger
            </Link>
          </div>

          <div className="font-mono font-bold tracking-tight text-[30px] sm:text-[34px] leading-none text-[#12161C]">
            ₹{totalMarketUdhaar.toLocaleString('en-IN')}
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-[rgba(227,160,8,.14)] text-[#9A6700] w-fit">
            {overdueCustomers.length > 0 ? `${overdueCustomers.length} accounts with balance` : '0 accounts with balance'}
          </span>

          <div className="flex h-2.5 rounded-[6px] overflow-hidden bg-[#EEF1F5] gap-[2px]" aria-label="Aging distribution">
            <span style={{ flex: 1 }} className="bg-[#1A7F37]" />
            <span style={{ flex: 1 }} className="bg-[#CDD5DF]" />
            <span style={{ flex: 1 }} className="bg-[#CDD5DF]" />
            <span style={{ flex: 1 }} className="bg-[#CDD5DF]" />
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1 text-[#556273]">
            <div className="text-xs">
              0–30 d
              <b className="block text-[#12161C] font-mono text-[13px] mt-0.5">₹{agingBuckets.d0_30.toLocaleString('en-IN')}</b>
            </div>
            <div className="text-xs">
              31–60
              <b className="block text-[#12161C] font-mono text-[13px] mt-0.5">₹{agingBuckets.d31_60}</b>
            </div>
            <div className="text-xs">
              61–90
              <b className="block text-[#12161C] font-mono text-[13px] mt-0.5">₹{agingBuckets.d61_90}</b>
            </div>
            <div className="text-xs">
              90+
              <b className="block text-[#12161C] font-mono text-[13px] mt-0.5">₹{agingBuckets.d90plus}</b>
            </div>
          </div>
        </article>

        {/* CARD 3: Gross sales today (Span 3) */}
        <article className="col-span-12 md:col-span-6 lg:col-span-3 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">Gross sales today</h2>
            <Link href="/invoices" className="text-xs font-bold text-[#12161C] hover:text-[#C81E1E] transition-colors">
              Bills
            </Link>
          </div>

          <div className="font-mono font-bold tracking-tight text-[30px] sm:text-[34px] leading-none text-[#12161C]">
            ₹{currentSales.toLocaleString('en-IN')}
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-[#EEF1F5] text-[#3E4A5A] w-fit">
            {recentInvoices.length > 0 ? `${recentInvoices.length} sales bills` : '0 sales bills'}
          </span>

          <p className="text-xs text-[#556273] font-medium m-0">
            Counter and spares
          </p>
        </article>

        {/* CARD 4: Last 7 days: billed vs collected (Span 7) */}
        <article className="col-span-12 lg:col-span-7 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">
              Last 7 days: billed vs collected
            </h2>
            <div className="flex items-center gap-3.5 text-xs font-semibold text-[#12161C]">
              <span className="flex items-center">
                <span className="inline-block w-2.5 h-2.5 bg-[#6B7F99] rounded-[2px] mr-1.5" />
                Billed
              </span>
              <span className="flex items-center">
                <span className="inline-block w-2.5 h-2.5 bg-[#1A7F37] rounded-[2px] mr-1.5" />
                Collected
              </span>
            </div>
          </div>

          {/* SVG Bar Chart with Zero-Sales Dotted Baseline */}
          <div className="w-full">
            <svg viewBox="0 0 640 230" width="100%" role="img" aria-label="Last 7 days bar chart" className="overflow-visible">
              {/* Horizontal Background Grids */}
              <g stroke="#E3E8EE" strokeWidth="1">
                <line x1="0" y1="40" x2="640" y2="40" />
                <line x1="0" y1="100" x2="640" y2="100" />
                <line x1="0" y1="160" x2="640" y2="160" />
              </g>

              {/* Dynamic 7-day Bars and Baselines */}
              {chartDaysList.map((d, idx) => {
                const colWidth = 640 / 7;
                const cx = Math.round((idx + 0.5) * colWidth);
                const hasActivity = (d.salesRupees || 0) > 0 || (d.collectionsRupees || 0) > 0;
                const salesH = (d.salesRupees || 0) > 0 ? Math.max(6, Math.min(130, Math.round(((d.salesRupees || 0) / maxChartVal) * 130))) : 0;
                const collH = (d.collectionsRupees || 0) > 0 ? Math.max(6, Math.min(130, Math.round(((d.collectionsRupees || 0) / maxChartVal) * 130))) : 0;

                return (
                  <g key={d.day || idx} className="group">
                    {!hasActivity ? (
                      <line
                        x1={cx - 18}
                        y1="180"
                        x2={cx + 18}
                        y2="180"
                        stroke="#CDD5DF"
                        strokeWidth="1.5"
                        strokeDasharray="3 5"
                      />
                    ) : (
                      <>
                        {salesH > 0 && (
                          <rect
                            x={cx - 22}
                            y={180 - salesH}
                            width="20"
                            height={salesH}
                            rx="3"
                            fill="#6B7F99"
                            className="transition-opacity hover:opacity-80"
                          >
                            <title>{`${d.day}: Billed ₹${(d.salesRupees || 0).toLocaleString('en-IN')}`}</title>
                          </rect>
                        )}
                        {collH > 0 && (
                          <rect
                            x={cx + 3}
                            y={180 - collH}
                            width="20"
                            height={collH}
                            rx="3"
                            fill="#1A7F37"
                            className="transition-opacity hover:opacity-80"
                          >
                            <title>{`${d.day}: Collected ₹${(d.collectionsRupees || 0).toLocaleString('en-IN')}`}</title>
                          </rect>
                        )}
                      </>
                    )}
                    <text
                      x={cx}
                      y="206"
                      fontSize="12"
                      fill="#556273"
                      textAnchor="middle"
                      fontFamily="inherit"
                      fontWeight="600"
                    >
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="text-xs text-[#556273] font-medium m-0">
            Days with no sales show a dotted line, not an empty box.
          </p>
        </article>

        {/* CARD 5: Reorder soon (Span 5) */}
        <article className="col-span-12 lg:col-span-5 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">Reorder soon</h2>
            <Link href="/inventory" className="text-xs font-bold text-[#12161C] hover:text-[#C81E1E] transition-colors">
              Open stock
            </Link>
          </div>

          {/* Alert callout chip */}
          {lowStockCount > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-[10px] p-3 text-xs font-bold bg-[rgba(227,160,8,.14)] text-[#9A6700] leading-snug">
              {lowStockCount.toLocaleString('en-IN')} {lowStockCount === 1 ? 'SKU' : 'SKUs'} flagged below reorder level. Review min-stock levels in inventory.
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-[10px] p-3 text-xs font-semibold bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] leading-snug">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>All parts healthy. No items below reorder threshold.</span>
            </div>
          )}

          {/* Low stock part items */}
          <div className="divide-y divide-[#EDF0F4]">
            {lowStockParts.length > 0 ? (
              lowStockParts.slice(0, 3).map((part) => (
                <div key={part.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-[13px] font-bold text-[#12161C]">{part.name}</div>
                    <div className="text-xs text-[#5F6B7B] font-mono mt-0.5">
                      {part.partNumber || 'SKU'} · min {part.reorderLevel || 10}
                    </div>
                  </div>
                  <div className={`font-mono font-bold text-[13px] ${part.stockQty <= 0 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                    {part.stockQty} left
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#64748B]">
                No low-stock parts requiring immediate reorder.
              </div>
            )}
          </div>
        </article>

        {/* CARD 6: Collect from (Span 7) */}
        <article className="col-span-12 lg:col-span-7 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">Collect from</h2>
            <Link href="/customers" className="text-xs font-bold text-[#12161C] hover:text-[#C81E1E] transition-colors">
              All accounts
            </Link>
          </div>

          <div className="space-y-2">
            {overdueCustomers.length > 0 ? (
              overdueCustomers.slice(0, 2).map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-2 border-b border-[#EDF0F4] last:border-b-0">
                  <div className="flex-1 min-w-[140px]">
                    <div className="text-[13px] font-bold text-[#12161C]">{c.shopName || c.name}</div>
                    <div className="text-xs text-[#5F6B7B] font-medium mt-0.5">
                      Workshop · oldest due {c.daysOverdue || 12} days
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    c.daysOverdue > 60 
                      ? 'bg-[rgba(248,81,73,.14)] text-[#CF222E]' 
                      : c.daysOverdue > 30 
                      ? 'bg-[rgba(227,160,8,.14)] text-[#9A6700]' 
                      : 'bg-[rgba(63,185,80,.14)] text-[#1A7F37]'
                  }`}>
                    {c.daysOverdue > 60 ? 'Critical' : c.daysOverdue > 30 ? 'Overdue' : 'Good standing'}
                  </span>
                  <div className="font-mono font-bold text-[14px] text-[#12161C]">
                    ₹{c.balanceRupees.toLocaleString('en-IN')}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSendReminder(c)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[#DDF4E4] hover:bg-[#cbf1d4] border border-[#A6DDB5] text-[#1A7F37] text-xs font-bold transition-all cursor-pointer"
                  >
                    Remind on WhatsApp
                  </button>
                </div>
              ))
            ) : (
              <div className="py-4 px-3 text-center rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="text-xs font-semibold text-[#475569] m-0">No overdue customer accounts</p>
                <p className="text-[11px] text-[#94A3B8] m-0 mt-0.5">All customer accounts are settled or within allowed credit terms.</p>
              </div>
            )}

            <div className="border border-dashed border-[#CDD5DF] rounded-[12px] p-3 text-xs font-medium text-[#556273] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No other accounts are overdue.</span>
            </div>
          </div>
        </article>

        {/* CARD 7: Day-end settlement (Span 5) */}
        <article className="col-span-12 lg:col-span-5 bg-white border border-[#E3E8EE] rounded-[16px] p-5 shadow-[0_1px_2px_rgba(16,24,40,.05)] flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#556273] m-0">Day-end settlement</h2>
            <Link href="/settlement" className="text-xs font-bold text-[#12161C] hover:text-[#C81E1E] transition-colors">
              Start
            </Link>
          </div>

          <div className="border border-dashed border-[#CDD5DF] rounded-[12px] p-4 text-xs font-medium text-[#556273] flex items-center gap-3">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-[#EEF1F5] text-[#3E4A5A] shrink-0">
              Not closed
            </span>
            <span>Count the drawer and close the day when the counter shuts.</span>
          </div>
        </article>
      </div>

      {/* Embedded Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={selectedPreviewInvoice}
      />
    </div>
  );
}
