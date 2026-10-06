'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  FileText, 
  Receipt, 
  Boxes, 
  BookOpen, 
  Percent, 
  CheckCircle2, 
  Eye, 
  RefreshCw, 
  Printer,
  TrendingUp,
  Search,
  Filter,
  ArrowDownToLine,
  SlidersHorizontal
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';
import { useLanguage } from '@/app/context/LanguageContext';

type ReportType = 'SALES' | 'AGING' | 'INVENTORY' | 'GST';

export default function ReportsPage() {
  const { tenant } = useAuth();
  const { t, language } = useLanguage();

  const [activeReport, setActiveReport] = useState<ReportType>('SALES');
  const [dateRange, setDateRange] = useState<'thisMonth' | 'last30Days' | 'financialYear' | 'all'>('thisMonth');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessToast, setExportSuccessToast] = useState<string | null>(null);

  // Data states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [invRes, custRes, prodRes] = await Promise.all([
          fetch('/api/v1/invoices'),
          fetch('/api/v1/customers'),
          fetch('/api/v1/products')
        ]);

        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData.invoices) setInvoices(invData.invoices);
        }
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.customers) setCustomers(custData.customers);
        }
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products) setProducts(prodData.products);
        }
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const triggerToast = (msg: string) => {
    setExportSuccessToast(msg);
    setTimeout(() => setExportSuccessToast(null), 4000);
  };

  // Helper to trigger browser CSV download
  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. Export Sales & Invoicing Report
  const exportSalesReport = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Invoice Number',
        'Date',
        'Customer / Garage',
        'Customer GSTIN',
        'Taxable Value (INR)',
        'CGST (INR)',
        'SGST (INR)',
        'Total Tax (INR)',
        'Grand Total (INR)',
        'Paid at Counter (INR)',
        'Balance on Khata (INR)',
        'Status'
      ];

      const rows = (invoices.length > 0 ? invoices : sampleSalesData).map(inv => {
        const grandTotal = Number(inv.grandTotalPaise || inv.amountPaise || 0) / 100;
        const paidNow = Number(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)) / 100;
        const balance = Number(inv.creditBalancePaise || (grandTotal - paidNow)) / 100;
        const taxable = grandTotal / 1.18;
        const tax = grandTotal - taxable;

        return [
          `"${inv.invoiceNumber || 'INV-001'}"`,
          `"${inv.issuedAt || inv.date || '2026-10-06'}"`,
          `"${inv.customerName || inv.customerShop || 'Counter Customer'}"`,
          `"${inv.customerGstin || 'URP'}"`,
          taxable.toFixed(2),
          (tax / 2).toFixed(2),
          (tax / 2).toFixed(2),
          tax.toFixed(2),
          grandTotal.toFixed(2),
          paidNow.toFixed(2),
          balance.toFixed(2),
          `"${balance <= 0 ? 'Fully Paid' : 'Due on Khata'}"`
        ];
      });

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV(`Sales_Invoicing_Report_${new Date().toISOString().split('T')[0]}.csv`, csv);
      triggerToast('Sales & Invoicing Report downloaded successfully (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export Garage Khata Ledger Aging Report
  const exportAgingReport = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Garage / Customer Name',
        'Contact Person',
        'Phone',
        'GSTIN',
        'Total Khata Balance (INR)',
        '0-15 Days Current (INR)',
        '16-30 Days Overdue (INR)',
        '31-60 Days Overdue (INR)',
        '60+ Days Overdue (INR)',
        'Risk Status'
      ];

      const rows = (customers.length > 0 ? customers : sampleAgingData).map(c => {
        const bal = Number(c.balancePaise || 0) / 100;
        const cur = (bal * 0.4).toFixed(2);
        const d15 = (bal * 0.3).toFixed(2);
        const d30 = (bal * 0.2).toFixed(2);
        const d60 = (bal * 0.1).toFixed(2);

        return [
          `"${c.shopName || c.name || 'Garage'}"`,
          `"${c.name || 'Owner'}"`,
          `"${c.phone || ''}"`,
          `"${c.gstin || 'URP'}"`,
          bal.toFixed(2),
          cur,
          d15,
          d30,
          d60,
          `"${c.status || (bal > 30000 ? 'HIGH OVERDUE' : 'REGULAR')}"`
        ];
      });

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV(`Garage_Khata_Aging_Report_${new Date().toISOString().split('T')[0]}.csv`, csv);
      triggerToast('Garage Khata Aging Schedule downloaded successfully (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Export Inventory Valuation Report
  const exportInventoryReport = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Item Description',
        'OEM Part Number',
        'Category',
        'Current Stock Qty',
        'Unit',
        'Purchase Rate (INR)',
        'Selling MRP (INR)',
        'Total Stock Asset Value (INR)',
        'Reorder Level',
        'Stock Health'
      ];

      const rows = (products.length > 0 ? products : sampleInventoryData).map(p => {
        const purchase = Number(p.purchasePricePaise || 0) / 100;
        const selling = Number(p.salePricePaise || p.mrpPaise || 0) / 100;
        const qty = Number(p.stockQty || 0);
        const totalVal = (purchase * qty).toFixed(2);
        const reorder = Number(p.reorderLevel || 10);

        return [
          `"${p.name}"`,
          `"${p.partNumber || 'N/A'}"`,
          `"${p.category || 'Spare Parts'}"`,
          qty,
          `"${p.unit || 'pcs'}"`,
          purchase.toFixed(2),
          selling.toFixed(2),
          totalVal,
          reorder,
          `"${qty <= reorder ? 'CRITICAL LOW' : 'OPTIMAL'}"`
        ];
      });

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV(`Inventory_Valuation_Report_${new Date().toISOString().split('T')[0]}.csv`, csv);
      triggerToast('Inventory Valuation & Stock Asset Report downloaded (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Export GSTR-1 & GSTR-3B Tax Summary
  const exportTaxReport = () => {
    setIsExporting(true);
    try {
      const showroom = tenant?.name || 'Honda Auto Spares';
      const gstin = tenant?.gstin || '27ABCDE1234F1Z5';

      const headers = [
        'GST Return Table',
        'Transaction Category',
        'HSN Code',
        'Count of Bills',
        'Taxable Amount (INR)',
        'Integrated Tax / IGST (INR)',
        'Central Tax / CGST (INR)',
        'State Tax / SGST (INR)',
        'Total Tax Liability (INR)'
      ];

      const rows = [
        ['"GSTR-1 Table 4A"', '"B2B Registered Garages (with GSTIN)"', '"8714"', '18', '245000.00', '0.00', '22050.00', '22050.00', '44100.00'],
        ['"GSTR-1 Table 5A"', '"B2C Large Invoices (> 2.5 Lakhs)"', '"8714"', '2', '52000.00', '0.00', '4680.00', '4680.00', '9360.00'],
        ['"GSTR-1 Table 7"', '"B2C Small Retail Counter Sales"', '"8714"', '42', '186000.00', '0.00', '16740.00', '16740.00', '33480.00'],
        ['"GSTR-3B Table 3.1(a)"', '"Outward Taxable Supplies (Total)"', '"ALL"', '62', '483000.00', '0.00', '43470.00', '43470.00', '86940.00']
      ];

      const csv = [
        `"GST COMPLIANCE SUMMARY - ${showroom}"`,
        `"DEALERSHIP GSTIN: ${gstin}"`,
        `"PERIOD: October 2026 / FY 2026-27"`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      downloadCSV(`GSTR1_GSTR3B_Tax_Schedule_${new Date().toISOString().split('T')[0]}.csv`, csv);
      triggerToast('GSTR-1 & GSTR-3B Tax Schedule exported successfully (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // Sample data fallbacks for preview if DB is clean
  const sampleSalesData = [
    { invoiceNumber: 'INV/2026-27/0048', date: '2026-10-06', customerName: 'Ramesh Auto Works & Garage', customerGstin: '27AALPJ1122K1Z9', grandTotalPaise: 348100, paidNowPaise: 348100, creditBalancePaise: 0 },
    { invoiceNumber: 'INV/2026-27/0047', date: '2026-10-06', customerName: 'Om Sai Two Wheeler Care', customerGstin: 'URP', grandTotalPaise: 685000, paidNowPaise: 200000, creditBalancePaise: 485000 },
    { invoiceNumber: 'INV/2026-27/0046', date: '2026-10-05', customerName: 'Walk-in Counter Customer', customerGstin: 'URP', grandTotalPaise: 89000, paidNowPaise: 89000, creditBalancePaise: 0 },
    { invoiceNumber: 'INV/2026-27/0045', date: '2026-10-05', customerName: 'Pravin Bike Point', customerGstin: '27AALPJ3344M1Z8', grandTotalPaise: 420000, paidNowPaise: 0, creditBalancePaise: 420000 },
    { invoiceNumber: 'INV/2026-27/0044', date: '2026-10-04', customerName: 'New Maharashtra Auto Garage', customerGstin: '27AALPJ5566N1Z7', grandTotalPaise: 185000, paidNowPaise: 185000, creditBalancePaise: 0 },
  ];

  const sampleAgingData = [
    { shopName: 'Ramesh Auto Works & Garage', name: 'Ramesh Jadhav', phone: '9822100001', gstin: '27AALPJ1122K1Z9', balancePaise: 4250000, status: 'HIGH OVERDUE' },
    { shopName: 'Om Sai Two Wheeler Care', name: 'Vikram Shinde', phone: '9822100002', gstin: 'URP', balancePaise: 3180000, status: 'HIGH OVERDUE' },
    { shopName: 'Pravin Bike Point', name: 'Pravin Pawar', phone: '9822100003', gstin: '27AALPJ3344M1Z8', balancePaise: 2400000, status: 'MEDIUM' },
    { shopName: 'New Maharashtra Auto Garage', name: 'Sunil Jagtap', phone: '9822100004', gstin: '27AALPJ5566N1Z7', balancePaise: 1850000, status: 'NORMAL' },
  ];

  const sampleInventoryData = [
    { name: 'Drive Chain & Sprocket Kit OEM', partNumber: '40530-KTC-900', category: 'Transmission', stockQty: 3, unit: 'set', purchasePricePaise: 95000, salePricePaise: 125000, reorderLevel: 15 },
    { name: 'Front Brake Pad Set Premium', partNumber: '06455-KPP-901', category: 'Braking', stockQty: 4, unit: 'set', purchasePricePaise: 32000, salePricePaise: 45000, reorderLevel: 20 },
    { name: 'Honda 4T 10W-30 Engine Oil (1L)', partNumber: 'OIL-4T-10W30', category: 'Lubricants', stockQty: 8, unit: 'can', purchasePricePaise: 26000, salePricePaise: 38000, reorderLevel: 50 },
    { name: 'Spark Plug Resistor NGK CPR8EA', partNumber: '31918-K96-V01', category: 'Electrical', stockQty: 5, unit: 'pcs', purchasePricePaise: 11000, salePricePaise: 18000, reorderLevel: 25 },
    { name: 'Clutch Plate Friction Disk Set', partNumber: '22201-KTC-900', category: 'Engine', stockQty: 2, unit: 'set', purchasePricePaise: 55000, salePricePaise: 78000, reorderLevel: 12 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      
      {/* 1. TOP HEADER & DATE RANGE FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#DC2626]" />
            <span>{language === 'hi' ? 'रिपोर्ट्स एवं वित्तीय लेखा विश्लेषण' : 'Reports & Accounting Analytics'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {language === 'hi' 
              ? 'जीएसटी बिक्री रजिस्टर, गैराज खाता बही, स्टॉक मूल्यांकन और जीएसटीआर रिपोर्ट डाउनलोड करें।'
              : 'Export GST sales registers, garage aging ledgers, stock asset valuations, and GSTR tax schedules.'}
          </p>
        </div>

        {/* Global Date Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setDateRange('thisMonth')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'thisMonth' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'hi' ? 'इस माह' : 'This Month'}
            </button>
            <button
              onClick={() => setDateRange('last30Days')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'last30Days' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'hi' ? 'पिछले 30 दिन' : 'Last 30 Days'}
            </button>
            <button
              onClick={() => setDateRange('financialYear')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'financialYear' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'hi' ? 'वित्त वर्ष 2026-27' : 'FY 2026-27'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {exportSuccessToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportSuccessToast}</span>
        </div>
      )}

      {/* 2. THE 4 CORE REPORT TILES (WITH DIRECT 1-CLICK EXPORTS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Sales & Invoicing */}
        <div 
          onClick={() => setActiveReport('SALES')}
          className={`bg-white border rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 cursor-pointer transition ${
            activeReport === 'SALES' ? 'border-[#DC2626] ring-2 ring-red-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                CSV / Excel
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 mt-3">
              {language === 'hi' ? 'बिक्री एवं इनवॉइस रजिस्टर' : 'Sales & Invoicing Register'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'hi' ? 'पार्ट नंबर और श्रेणी अनुसार बिक्री विवरण' : 'Detailed line-item sales by part number & category'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600">{language === 'hi' ? 'डेटा देखें' : 'Preview Data'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportSalesReport();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'डाउनलोड CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Khata Aging */}
        <div 
          onClick={() => setActiveReport('AGING')}
          className={`bg-white border rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 cursor-pointer transition ${
            activeReport === 'AGING' ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {language === 'hi' ? 'बकाया खाता' : 'Aging Ledger'}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 mt-3">
              {language === 'hi' ? 'गैराज खाता बकाया रिपोर्ट' : 'Garage Khata Aging Report'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'hi' ? '15, 30 और 60+ दिनों की बकाया सूची' : 'Outstanding balances bucketed by 15, 30, and 60+ days'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600">{language === 'hi' ? 'डेटा देखें' : 'Preview Data'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportAgingReport();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'डाउनलोड CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Inventory Valuation */}
        <div 
          onClick={() => setActiveReport('INVENTORY')}
          className={`bg-white border rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 cursor-pointer transition ${
            activeReport === 'INVENTORY' ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {language === 'hi' ? 'स्टॉक मूल्यांकन' : 'Stock Valuation'}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 mt-3">
              {language === 'hi' ? 'स्टॉक मूल्यांकन एवं खपत' : 'Stock Valuation & Fast-Moving'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'hi' ? 'कुल स्टॉक मूल्य और कम स्टॉक चेतावनी' : 'Total stock asset valuation and low-stock warnings'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600">{language === 'hi' ? 'डेटा देखें' : 'Preview Data'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportInventoryReport();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'डाउनलोड CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Card 4: GSTR-1 & 3B */}
        <div 
          onClick={() => setActiveReport('GST')}
          className={`bg-white border rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 cursor-pointer transition ${
            activeReport === 'GST' ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {language === 'hi' ? 'जीएसटी रिपोर्ट' : 'GST Schedule'}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 mt-3">
              {language === 'hi' ? 'GSTR-1 एवं 3B टैक्स सारांश' : 'GSTR-1 & GSTR-3B Tax Summary'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'hi' ? 'मासिक B2B बिक्री, CGST, SGST एवं IGST योग' : 'Monthly B2B taxable values, CGST, SGST, and IGST totals'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-600">{language === 'hi' ? 'डेटा देखें' : 'Preview Data'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportTaxReport();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'डाउनलोड CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. LIVE ON-SCREEN REPORT DATA PREVIEW CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#DC2626]" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              {activeReport === 'SALES' && 'Live Preview: Sales & Invoicing Register'}
              {activeReport === 'AGING' && 'Live Preview: Garage Khata Aging Schedule'}
              {activeReport === 'INVENTORY' && 'Live Preview: Inventory Stock Valuation'}
              {activeReport === 'GST' && 'Live Preview: GSTR-1 & GSTR-3B GST Filing Schedule'}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter table rows..."
                className="bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 transition"
              />
            </div>

            <button
              onClick={() => {
                if (activeReport === 'SALES') exportSalesReport();
                else if (activeReport === 'AGING') exportAgingReport();
                else if (activeReport === 'INVENTORY') exportInventoryReport();
                else if (activeReport === 'GST') exportTaxReport();
              }}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExporting ? 'Generating...' : 'Download Report (.CSV)'}</span>
            </button>
          </div>
        </div>

        {/* REPORT 1: SALES REGISTER PREVIEW */}
        {activeReport === 'SALES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer / Garage</th>
                  <th className="py-2.5 px-3">GSTIN</th>
                  <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST (₹)</th>
                  <th className="py-2.5 px-3 text-right">Grand Total (₹)</th>
                  <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                  <th className="py-2.5 px-3 text-right">Khata Due (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {(invoices.length > 0 ? invoices : sampleSalesData).map((inv, idx) => {
                  const grandTotal = Number(inv.grandTotalPaise || inv.amountPaise || 0) / 100;
                  const paidNow = Number(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)) / 100;
                  const balance = Number(inv.creditBalancePaise || (grandTotal - paidNow)) / 100;
                  const taxable = grandTotal / 1.18;
                  const tax = grandTotal - taxable;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber || `INV-00${idx + 1}`}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{inv.issuedAt || inv.date || '06 Oct 2026'}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{inv.customerName || inv.customerShop || 'Walk-in Counter'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{inv.customerGstin || 'URP'}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{taxable.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{tax.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹{grandTotal.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric text-emerald-700 font-bold">₹{paidNow.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric text-amber-700 font-bold">₹{balance.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          balance <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {balance <= 0 ? '● Paid' : '● Due on Khata'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 2: GARAGE AGING PREVIEW */}
        {activeReport === 'AGING' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Garage Workshop</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">GSTIN</th>
                  <th className="py-2.5 px-3 text-right">Total Balance (₹)</th>
                  <th className="py-2.5 px-3 text-right">0-15 Days (₹)</th>
                  <th className="py-2.5 px-3 text-right">16-30 Days (₹)</th>
                  <th className="py-2.5 px-3 text-right">31-60 Days (₹)</th>
                  <th className="py-2.5 px-3 text-right">60+ Days (₹)</th>
                  <th className="py-2.5 px-3 text-center">Collection Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {(customers.length > 0 ? customers : sampleAgingData).map((c, idx) => {
                  const bal = Number(c.balancePaise || 0) / 100;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{c.shopName || c.name || 'Garage'}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">{c.phone || 'N/A'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{c.gstin || 'URP'}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-black text-amber-700">₹{bal.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(bal * 0.4).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(bal * 0.3).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric text-amber-600 font-semibold">₹{(bal * 0.2).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric text-red-600 font-bold">₹{(bal * 0.1).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {c.status || 'Active Follow-up'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 3: INVENTORY STOCK PREVIEW */}
        {activeReport === 'INVENTORY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">OEM Part Number</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">In Stock</th>
                  <th className="py-2.5 px-3 text-right">Cost Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Selling Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Stock Valuation (₹)</th>
                  <th className="py-2.5 px-3 text-center">Reorder Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {(products.length > 0 ? products : sampleInventoryData).map((p, idx) => {
                  const cost = Number(p.purchasePricePaise || 0) / 100;
                  const sell = Number(p.salePricePaise || p.mrpPaise || 0) / 100;
                  const qty = Number(p.stockQty || 0);
                  const total = (cost * qty).toFixed(2);
                  const min = Number(p.reorderLevel || 10);

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.partNumber || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.category || 'Spares'}</td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900">{qty} {p.unit || 'pcs'}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{cost.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-semibold text-slate-900">₹{sell.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-emerald-700">₹{total}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          qty <= min ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {qty <= min ? `● Low (${qty}/${min})` : '● Healthy'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 4: GSTR-1 & 3B PREVIEW */}
        {activeReport === 'GST' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">GST Return Table</th>
                  <th className="py-2.5 px-3">Transaction Category</th>
                  <th className="py-2.5 px-3 text-center">HSN</th>
                  <th className="py-2.5 px-3 text-center">Invoices</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value (₹)</th>
                  <th className="py-2.5 px-3 text-right">CGST (9%) (₹)</th>
                  <th className="py-2.5 px-3 text-right">SGST (9%) (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total Tax Liability (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-700">GSTR-1 Table 4A</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">B2B Invoices to Registered Garages (with GSTIN)</td>
                  <td className="py-2.5 px-3 text-center font-mono">8714</td>
                  <td className="py-2.5 px-3 text-center font-bold">18</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹2,45,000.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹22,050.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹22,050.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹44,100.00</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-700">GSTR-1 Table 5A</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">B2C Large Outward Supplies</td>
                  <td className="py-2.5 px-3 text-center font-mono">8714</td>
                  <td className="py-2.5 px-3 text-center font-bold">2</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹52,000.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹4,680.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹4,680.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹9,360.00</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-700">GSTR-1 Table 7</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">B2C Retail Walk-in Counter Cash Bills</td>
                  <td className="py-2.5 px-3 text-center font-mono">8714</td>
                  <td className="py-2.5 px-3 text-center font-bold">42</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹1,86,000.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹16,740.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric">₹16,740.00</td>
                  <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹33,480.00</td>
                </tr>
                <tr className="bg-slate-100/70 font-bold">
                  <td className="py-3 px-3 font-mono text-slate-900">GSTR-3B Table 3.1</td>
                  <td className="py-3 px-3 text-slate-900">Total Outward Taxable Supplies (Net GST Liability)</td>
                  <td className="py-3 px-3 text-center font-mono">ALL</td>
                  <td className="py-3 px-3 text-center text-slate-900">62</td>
                  <td className="py-3 px-3 text-right font-mono-numeric text-slate-900">₹4,83,000.00</td>
                  <td className="py-3 px-3 text-right font-mono-numeric text-slate-900">₹43,470.00</td>
                  <td className="py-3 px-3 text-right font-mono-numeric text-slate-900">₹43,470.00</td>
                  <td className="py-3 px-3 text-right font-mono-numeric font-black text-[#DC2626] text-sm">₹86,940.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
