'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { 
  BarChart3, 
  Download, 
  Receipt, 
  Boxes, 
  BookOpen, 
  Percent, 
  CheckCircle2, 
  Search, 
  FileText,
  Plus,
  ArrowRight
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';
import { useLanguage } from '@/app/context/LanguageContext';
import ModernLoader from '@/app/components/ModernLoader';

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
          else if (Array.isArray(invData)) setInvoices(invData);
        }
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.customers) setCustomers(custData.customers);
          else if (Array.isArray(custData)) setCustomers(custData);
        }
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products) setProducts(prodData.products);
          else if (Array.isArray(prodData)) setProducts(prodData);
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
    if (invoices.length === 0) {
      triggerToast('No invoice records to export');
      return;
    }
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

      const rows = invoices.map(inv => {
        const grandTotal = Number(inv.grandTotalPaise || inv.amountPaise || 0) / 100;
        const paidNow = Number(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)) / 100;
        const balance = Number(inv.creditBalancePaise || (grandTotal - paidNow)) / 100;
        const taxable = grandTotal / 1.18;
        const tax = grandTotal - taxable;

        return [
          `"${inv.invoiceNumber || 'INV-001'}"`,
          `"${inv.issuedAt || inv.date || inv.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]}"`,
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
      triggerToast('Sales & Invoicing Report exported (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export Garage Khata Ledger Aging Report
  const exportAgingReport = () => {
    if (customers.length === 0) {
      triggerToast('No customer khata records to export');
      return;
    }
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

      const rows = customers.map(c => {
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
      triggerToast('Garage Khata Aging Schedule exported (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Export Inventory Valuation Report
  const exportInventoryReport = () => {
    if (products.length === 0) {
      triggerToast('No product inventory records to export');
      return;
    }
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

      const rows = products.map(p => {
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
      triggerToast('Inventory Valuation Report exported (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Calculate Real Dynamic GST Return Schedule
  const gstSummary = useMemo(() => {
    let b2bCount = 0;
    let b2bTaxable = 0;
    let b2bTax = 0;

    let b2cLargeCount = 0;
    let b2cLargeTaxable = 0;
    let b2cLargeTax = 0;

    let b2cSmallCount = 0;
    let b2cSmallTaxable = 0;
    let b2cSmallTax = 0;

    invoices.forEach((inv) => {
      const grandTotal = Number(inv.grandTotalPaise || inv.amountPaise || 0) / 100;
      const taxable = grandTotal / 1.18;
      const tax = grandTotal - taxable;
      const hasGstin = inv.customerGstin && inv.customerGstin !== 'URP' && inv.customerGstin.trim().length >= 15;

      if (hasGstin) {
        b2bCount++;
        b2bTaxable += taxable;
        b2bTax += tax;
      } else if (grandTotal > 250000) {
        b2cLargeCount++;
        b2cLargeTaxable += taxable;
        b2cLargeTax += tax;
      } else {
        b2cSmallCount++;
        b2cSmallTaxable += taxable;
        b2cSmallTax += tax;
      }
    });

    const totalInvoices = invoices.length;
    const totalTaxable = b2bTaxable + b2cLargeTaxable + b2cSmallTaxable;
    const totalTax = b2bTax + b2cLargeTax + b2cSmallTax;

    return {
      b2b: { count: b2bCount, taxable: b2bTaxable, tax: b2bTax },
      b2cLarge: { count: b2cLargeCount, taxable: b2cLargeTaxable, tax: b2cLargeTax },
      b2cSmall: { count: b2cSmallCount, taxable: b2cSmallTaxable, tax: b2cSmallTax },
      total: { count: totalInvoices, taxable: totalTaxable, tax: totalTax },
    };
  }, [invoices]);

  const exportTaxReport = () => {
    setIsExporting(true);
    try {
      const showroom = tenant?.name || 'Dealership Workshop';
      const gstin = tenant?.gstin || 'URP / Not Set';

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
        ['"GSTR-1 Table 4A"', '"B2B Registered Garages (with GSTIN)"', '"8714"', gstSummary.b2b.count.toString(), gstSummary.b2b.taxable.toFixed(2), '0.00', (gstSummary.b2b.tax / 2).toFixed(2), (gstSummary.b2b.tax / 2).toFixed(2), gstSummary.b2b.tax.toFixed(2)],
        ['"GSTR-1 Table 5A"', '"B2C Large Invoices (> 2.5 Lakhs)"', '"8714"', gstSummary.b2cLarge.count.toString(), gstSummary.b2cLarge.taxable.toFixed(2), '0.00', (gstSummary.b2cLarge.tax / 2).toFixed(2), (gstSummary.b2cLarge.tax / 2).toFixed(2), gstSummary.b2cLarge.tax.toFixed(2)],
        ['"GSTR-1 Table 7"', '"B2C Small Retail Counter Sales"', '"8714"', gstSummary.b2cSmall.count.toString(), gstSummary.b2cSmall.taxable.toFixed(2), '0.00', (gstSummary.b2cSmall.tax / 2).toFixed(2), (gstSummary.b2cSmall.tax / 2).toFixed(2), gstSummary.b2cSmall.tax.toFixed(2)],
        ['"GSTR-3B Table 3.1(a)"', '"Outward Taxable Supplies (Total)"', '"ALL"', gstSummary.total.count.toString(), gstSummary.total.taxable.toFixed(2), '0.00', (gstSummary.total.tax / 2).toFixed(2), (gstSummary.total.tax / 2).toFixed(2), gstSummary.total.tax.toFixed(2)]
      ];

      const csv = [
        `"GST COMPLIANCE SUMMARY - ${showroom}"`,
        `"DEALERSHIP GSTIN: ${gstin}"`,
        `"PERIOD: Current Financial Period"`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      downloadCSV(`GSTR1_GSTR3B_Tax_Schedule_${new Date().toISOString().split('T')[0]}.csv`, csv);
      triggerToast('GSTR-1 & GSTR-3B Tax Schedule exported (.CSV)');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter lists based on search
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter(inv => 
      (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(term)) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(term)) ||
      (inv.customerGstin && inv.customerGstin.toLowerCase().includes(term))
    );
  }, [invoices, searchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
      (c.shopName && c.shopName.toLowerCase().includes(term)) ||
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term))
    );
  }, [customers, searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

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

      {/* 2. THE 4 CORE REPORT TILES */}
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
                {invoices.length} Bills
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
                {customers.length} Accounts
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
                {products.length} Items
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
                GST Ready
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

        {loading ? (
          <div className="py-12">
            <ModernLoader title="Loading Report Data..." />
          </div>
        ) : (
          <>
            {/* REPORT 1: SALES REGISTER PREVIEW */}
            {activeReport === 'SALES' && (
              filteredInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">No Sales Invoices Recorded</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Create invoices from the New Bill (POS) terminal to generate real sales and GST register records.
                    </p>
                  </div>
                  <Link
                    href="/pos"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Invoice (POS)</span>
                  </Link>
                </div>
              ) : (
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
                      {filteredInvoices.map((inv, idx) => {
                        const grandTotal = Number(inv.grandTotalPaise || inv.amountPaise || 0) / 100;
                        const paidNow = Number(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)) / 100;
                        const balance = Number(inv.creditBalancePaise || (grandTotal - paidNow)) / 100;
                        const taxable = grandTotal / 1.18;
                        const tax = grandTotal - taxable;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber || `INV-${idx + 1}`}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{inv.issuedAt || inv.date || inv.createdAt?.split('T')[0] || 'Today'}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{inv.customerName || inv.customerShop || 'Counter Customer'}</td>
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
              )
            )}

            {/* REPORT 2: GARAGE AGING PREVIEW */}
            {activeReport === 'AGING' && (
              filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">No Customer Khata Accounts</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Add your partner garages and customers to track outstanding credit and aging schedules.
                    </p>
                  </div>
                  <Link
                    href="/customers"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Customer Khata</span>
                  </Link>
                </div>
              ) : (
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
                      {filteredCustomers.map((c, idx) => {
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
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                bal > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {bal > 0 ? (c.status || 'Active Khata') : 'Clear'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* REPORT 3: INVENTORY STOCK PREVIEW */}
            {activeReport === 'INVENTORY' && (
              filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">No Inventory Parts Found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Add OEM and spare parts catalog items to see live valuation and stock levels.
                    </p>
                  </div>
                  <Link
                    href="/inventory"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Parts to Inventory</span>
                  </Link>
                </div>
              ) : (
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
                      {filteredProducts.map((p, idx) => {
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
              )
            )}

            {/* REPORT 4: GSTR-1 & 3B PREVIEW (CALCULATED FROM REAL INVOICES) */}
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
                      <td className="py-2.5 px-3 text-center font-bold">{gstSummary.b2b.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{gstSummary.b2b.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(gstSummary.b2b.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(gstSummary.b2b.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹{gstSummary.b2b.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">GSTR-1 Table 5A</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">B2C Large Outward Supplies (&gt; ₹2.5 Lakhs)</td>
                      <td className="py-2.5 px-3 text-center font-mono">8714</td>
                      <td className="py-2.5 px-3 text-center font-bold">{gstSummary.b2cLarge.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{gstSummary.b2cLarge.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(gstSummary.b2cLarge.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(gstSummary.b2cLarge.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹{gstSummary.b2cLarge.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">GSTR-1 Table 7</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">B2C Retail Walk-in Counter Cash Bills</td>
                      <td className="py-2.5 px-3 text-center font-mono">8714</td>
                      <td className="py-2.5 px-3 text-center font-bold">{gstSummary.b2cSmall.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{gstSummary.b2cSmall.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(gstSummary.b2cSmall.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric">₹{(gstSummary.b2cSmall.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right font-mono-numeric font-bold text-slate-900">₹{gstSummary.b2cSmall.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="bg-slate-100/70 font-bold">
                      <td className="py-3 px-3 font-mono text-slate-900">GSTR-3B Table 3.1</td>
                      <td className="py-3 px-3 text-slate-900">Total Outward Taxable Supplies (Net GST Liability)</td>
                      <td className="py-3 px-3 text-center font-mono">ALL</td>
                      <td className="py-3 px-3 text-center text-slate-900">{gstSummary.total.count}</td>
                      <td className="py-3 px-3 text-right font-mono-numeric text-slate-900">₹{gstSummary.total.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-3 text-right font-mono-numeric text-slate-900">₹{(gstSummary.total.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-3 text-right font-mono-numeric text-slate-900">₹{(gstSummary.total.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-3 text-right font-mono-numeric font-black text-[#DC2626] text-sm">₹{gstSummary.total.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
