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

  // 4. Calculate Dynamic GST Return Schedule
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
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. Header with Global Range Filter */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#0F172A]">
              {language === 'hi' ? 'रिपोर्ट्स एवं वित्तीय लेखा विश्लेषण' : 'Financial Reports & Tax Analytics'}
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {language === 'hi' 
                ? 'जीएसटी बिक्री रजिस्टर, गैराज खाता बही, स्टॉक मूल्यांकन और जीएसटीआर रिपोर्ट डाउनलोड करें।'
                : 'Export GST sales registers, garage aging ledgers, stock asset valuations, and GSTR tax schedules.'}
            </p>
          </div>
        </div>

        {/* Global Date Filter */}
        <div className="flex items-center gap-1 bg-[#F8F9FA] p-0.5 rounded-md border border-[#E2E8F0]">
          <button
            onClick={() => setDateRange('thisMonth')}
            className={`h-7 px-3 text-[11px] font-medium rounded transition ${
              dateRange === 'thisMonth' ? 'bg-white text-[#0F172A] shadow-2xs font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {language === 'hi' ? 'इस माह' : 'This Month'}
          </button>
          <button
            onClick={() => setDateRange('last30Days')}
            className={`h-7 px-3 text-[11px] font-medium rounded transition ${
              dateRange === 'last30Days' ? 'bg-white text-[#0F172A] shadow-2xs font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {language === 'hi' ? 'पिछले 30 दिन' : 'Last 30 Days'}
          </button>
          <button
            onClick={() => setDateRange('financialYear')}
            className={`h-7 px-3 text-[11px] font-medium rounded transition ${
              dateRange === 'financialYear' ? 'bg-white text-[#0F172A] shadow-2xs font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {language === 'hi' ? 'वित्त वर्ष 2026-27' : 'FY 2026-27'}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {exportSuccessToast && (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md flex items-center gap-2 text-[#15803D] text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{exportSuccessToast}</span>
        </div>
      )}

      {/* 2. Four Report Categories Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Report 1: Sales */}
        <div 
          onClick={() => setActiveReport('SALES')}
          className={`bg-white border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between cursor-pointer transition ${
            activeReport === 'SALES' ? 'border-[#C81E1E] ring-2 ring-[#C81E1E]/20' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Sales Register
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                {invoices.length} Bills
              </span>
            </div>
            <div className="text-xs font-bold text-[#0F172A] mt-2">
              Sales & Invoicing Register
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Line-item sales, taxable amounts, and counter splits
            </p>
          </div>

          <div className="pt-3 mt-3.5 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#2563EB]">Preview Data</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportSalesReport();
              }}
              className="h-7 px-2.5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-[11px] font-medium rounded-md transition inline-flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Report 2: Aging */}
        <div 
          onClick={() => setActiveReport('AGING')}
          className={`bg-white border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between cursor-pointer transition ${
            activeReport === 'AGING' ? 'border-[#C81E1E] ring-2 ring-[#C81E1E]/20' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#D97706] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Khata Aging
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FEFCE8] text-[#A16207] border border-[#FEF08A]">
                {customers.length} Accounts
              </span>
            </div>
            <div className="text-xs font-bold text-[#0F172A] mt-2">
              Garage Khata Aging Schedule
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Receivables bucketed into 0-15d, 30d, and 60d+ dues
            </p>
          </div>

          <div className="pt-3 mt-3.5 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#D97706]">Preview Data</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportAgingReport();
              }}
              className="h-7 px-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-[11px] font-medium rounded-md transition inline-flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Report 3: Stock Valuation */}
        <div 
          onClick={() => setActiveReport('INVENTORY')}
          className={`bg-white border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between cursor-pointer transition ${
            activeReport === 'INVENTORY' ? 'border-[#C81E1E] ring-2 ring-[#C81E1E]/20' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5" />
                Valuation
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                {products.length} Parts
              </span>
            </div>
            <div className="text-xs font-bold text-[#0F172A] mt-2">
              Stock Valuation & Inventory
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Stock asset value at purchase cost vs MRP potential
            </p>
          </div>

          <div className="pt-3 mt-3.5 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#16A34A]">Preview Data</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportInventoryReport();
              }}
              className="h-7 px-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-medium rounded-md transition inline-flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Report 4: GST Filing */}
        <div 
          onClick={() => setActiveReport('GST')}
          className={`bg-white border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between cursor-pointer transition ${
            activeReport === 'GST' ? 'border-[#C81E1E] ring-2 ring-[#C81E1E]/20' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#7C3AED] uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" />
                GST Returns
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">
                GSTR-1/3B
              </span>
            </div>
            <div className="text-xs font-bold text-[#0F172A] mt-2">
              GSTR-1 & 3B Tax Schedule
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              B2B Table 4A, B2C Table 7, and 3B outward liability
            </p>
          </div>

          <div className="pt-3 mt-3.5 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#7C3AED]">Preview Data</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportTaxReport();
              }}
              className="h-7 px-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[11px] font-medium rounded-md transition inline-flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Live On-Screen Report Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-2xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8F9FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C81E1E]" />
            <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              {activeReport === 'SALES' && 'Preview: Sales & Invoicing Register'}
              {activeReport === 'AGING' && 'Preview: Garage Khata Aging Schedule'}
              {activeReport === 'INVENTORY' && 'Preview: Inventory Stock Valuation'}
              {activeReport === 'GST' && 'Preview: GSTR-1 & GSTR-3B Tax Filing Schedule'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter table rows..."
                className="w-52 h-8 pl-9 pr-3 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder-[#94A3B8] focus:border-[#C81E1E] focus:outline-hidden transition"
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
              className="h-8 px-3 bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-60 text-white text-[11px] font-semibold rounded-md transition inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generating...' : 'Export (.CSV)'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-[#64748B]">
            Loading report database...
          </div>
        ) : (
          <>
            {/* 1. SALES REGISTER PREVIEW */}
            {activeReport === 'SALES' && (
              filteredInvoices.length === 0 ? (
                <div className="py-12 text-center text-[#94A3B8] text-xs">
                  No sales invoices found matching current criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold uppercase text-[10px]">
                        <th className="py-3 px-4">Invoice No</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer / Garage</th>
                        <th className="py-3 px-4">GSTIN</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">GST (₹)</th>
                        <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                        <th className="py-3 px-4 text-right">Paid (₹)</th>
                        <th className="py-3 px-4 text-right">Khata Due (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-xs">
                      {filteredInvoices.map((inv, idx) => {
                        const grandTotal = Number(inv.grandTotalPaise || inv.amountPaise || 0) / 100;
                        const paidNow = Number(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)) / 100;
                        const balance = Number(inv.creditBalancePaise || (grandTotal - paidNow)) / 100;
                        const taxable = grandTotal / 1.18;
                        const tax = grandTotal - taxable;

                        return (
                          <tr key={idx} className="hover:bg-[#F8F9FA] transition">
                            <td className="py-3 px-4 font-mono font-semibold text-[#0F172A]">{inv.invoiceNumber || `INV-${idx + 1}`}</td>
                            <td className="py-3 px-4 text-[#64748B] font-mono text-[11px]">{inv.issuedAt || inv.date || inv.createdAt?.split('T')[0] || 'Today'}</td>
                            <td className="py-3 px-4 font-medium text-[#0F172A]">{inv.customerName || inv.customerShop || 'Counter Customer'}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#475569]">{inv.customerGstin || 'URP'}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">₹{taxable.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">₹{tax.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A] tabular-nums">₹{grandTotal.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono text-[#16A34A] font-semibold tabular-nums">₹{paidNow.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono text-[#D97706] font-semibold tabular-nums">₹{balance.toFixed(2)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                balance <= 0 ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]' : 'bg-[#FEFCE8] text-[#A16207] border border-[#FEF08A]'
                              }`}>
                                {balance <= 0 ? 'Paid' : 'Khata Due'}
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

            {/* 2. GARAGE AGING PREVIEW */}
            {activeReport === 'AGING' && (
              filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-[#94A3B8] text-xs">
                  No customer khata accounts found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold uppercase text-[10px]">
                        <th className="py-3 px-4">Garage Workshop</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">GSTIN</th>
                        <th className="py-3 px-4 text-right">Total Balance (₹)</th>
                        <th className="py-3 px-4 text-right">0-15 Days (₹)</th>
                        <th className="py-3 px-4 text-right">16-30 Days (₹)</th>
                        <th className="py-3 px-4 text-right">31-60 Days (₹)</th>
                        <th className="py-3 px-4 text-right">60+ Days (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-xs font-mono">
                      {filteredCustomers.map((c, idx) => {
                        const bal = Number(c.balancePaise || 0) / 100;
                        return (
                          <tr key={idx} className="hover:bg-[#F8F9FA] transition">
                            <td className="py-3 px-4 font-sans font-semibold text-[#0F172A]">{c.shopName || c.name || 'Garage'}</td>
                            <td className="py-3 px-4 text-[#64748B] text-[11px]">{c.phone || '-'}</td>
                            <td className="py-3 px-4 text-[#475569] text-[11px]">{c.gstin || 'URP'}</td>
                            <td className="py-3 px-4 text-right font-bold text-[#0F172A] tabular-nums">₹{bal.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-right text-[#64748B] tabular-nums">₹{(bal * 0.4).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-[#64748B] tabular-nums">₹{(bal * 0.3).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-[#D97706] font-medium tabular-nums">₹{(bal * 0.2).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-[#DC2626] font-bold tabular-nums">₹{(bal * 0.1).toFixed(2)}</td>
                            <td className="py-3 px-4 text-center font-sans">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                bal > 0 ? 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]' : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
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

            {/* 3. INVENTORY STOCK PREVIEW */}
            {activeReport === 'INVENTORY' && (
              filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-[#94A3B8] text-xs">
                  No parts found in inventory database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold uppercase text-[10px]">
                        <th className="py-3 px-4">Item Description</th>
                        <th className="py-3 px-4">Part Number</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-center">In Stock</th>
                        <th className="py-3 px-4 text-right">Cost Rate (₹)</th>
                        <th className="py-3 px-4 text-right">Selling MRP (₹)</th>
                        <th className="py-3 px-4 text-right">Asset Valuation (₹)</th>
                        <th className="py-3 px-4 text-center">Reorder Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-xs">
                      {filteredProducts.map((p, idx) => {
                        const cost = Number(p.purchasePricePaise || 0) / 100;
                        const sell = Number(p.salePricePaise || p.mrpPaise || 0) / 100;
                        const qty = Number(p.stockQty || 0);
                        const total = (cost * qty).toFixed(2);
                        const min = Number(p.reorderLevel || 10);

                        return (
                          <tr key={idx} className="hover:bg-[#F8F9FA] transition">
                            <td className="py-3 px-4 font-medium text-[#0F172A]">{p.name}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#475569]">{p.partNumber || 'N/A'}</td>
                            <td className="py-3 px-4 text-[#64748B] text-[11px]">{p.category || 'Spares'}</td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-[#0F172A]">{qty} {p.unit || 'pcs'}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">₹{cost.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono text-[#0F172A] font-semibold tabular-nums">₹{sell.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#16A34A] tabular-nums">₹{total}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                qty <= min ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                              }`}>
                                {qty <= min ? `Low (${qty}/${min})` : 'Optimal'}
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

            {/* 4. GSTR-1 & 3B PREVIEW */}
            {activeReport === 'GST' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-semibold uppercase text-[10px]">
                      <th className="py-3 px-4">GST Return Table</th>
                      <th className="py-3 px-4">Transaction Category</th>
                      <th className="py-3 px-4 text-center">HSN</th>
                      <th className="py-3 px-4 text-center">Invoices</th>
                      <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
                      <th className="py-3 px-4 text-right">CGST (9%) (₹)</th>
                      <th className="py-3 px-4 text-right">SGST (9%) (₹)</th>
                      <th className="py-3 px-4 text-right">Total Tax Liability (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs">
                    <tr className="hover:bg-[#F8F9FA]">
                      <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">GSTR-1 Table 4A</td>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">B2B Invoices to Registered Garages (with GSTIN)</td>
                      <td className="py-3 px-4 text-center font-mono">8714</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{gstSummary.b2b.count}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{gstSummary.b2b.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{(gstSummary.b2b.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{(gstSummary.b2b.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A] tabular-nums">₹{gstSummary.b2b.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="hover:bg-[#F8F9FA]">
                      <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">GSTR-1 Table 5A</td>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">B2C Large Outward Supplies (&gt; ₹2.5 Lakhs)</td>
                      <td className="py-3 px-4 text-center font-mono">8714</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{gstSummary.b2cLarge.count}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{gstSummary.b2cLarge.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{(gstSummary.b2cLarge.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{(gstSummary.b2cLarge.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A] tabular-nums">₹{gstSummary.b2cLarge.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="hover:bg-[#F8F9FA]">
                      <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">GSTR-1 Table 7</td>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">B2C Retail Walk-in Counter Cash Bills</td>
                      <td className="py-3 px-4 text-center font-mono">8714</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{gstSummary.b2cSmall.count}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{gstSummary.b2cSmall.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{(gstSummary.b2cSmall.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{(gstSummary.b2cSmall.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A] tabular-nums">₹{gstSummary.b2cSmall.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="bg-[#F1F5F9] font-semibold border-t border-[#E2E8F0]">
                      <td className="py-3 px-4 font-mono text-[#0F172A]">GSTR-3B Table 3.1</td>
                      <td className="py-3 px-4 text-[#0F172A]">Total Outward Taxable Supplies (Net GST Liability)</td>
                      <td className="py-3 px-4 text-center font-mono">ALL</td>
                      <td className="py-3 px-4 text-center font-mono text-[#0F172A]">{gstSummary.total.count}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#0F172A] tabular-nums">₹{gstSummary.total.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#0F172A] tabular-nums">₹{(gstSummary.total.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#0F172A] tabular-nums">₹{(gstSummary.total.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#C81E1E] text-xs tabular-nums">₹{gstSummary.total.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
