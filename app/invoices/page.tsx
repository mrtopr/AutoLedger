'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Plus, 
  Search, 
  Receipt, 
  Eye, 
  Printer, 
  MessageCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Filter
} from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';

export default function InvoicesPage() {
  const { tenant } = useAuth();
  const { t, language } = useLanguage();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');

  // Preview Modal State
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<InvoicePreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/invoices');
      if (res.ok) {
        const data = await res.json();
        if (data.invoices) {
          setInvoices(data.invoices);
        }
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const openPreview = (inv: any) => {
    const previewData: InvoicePreviewData = {
      invoiceNumber: inv.invoiceNumber || inv.number || 'INV-DRAFT',
      date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
      time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now',
      placeOfSupply: '27 - Maharashtra',
      customer: {
        id: inv.customerId,
        name: inv.customerName || inv.customer,
        shopName: inv.customerShop || inv.customerName || inv.customer,
        phone: inv.customerPhone || '',
        address: inv.customerAddress || 'Local Counter Customer',
        gstin: inv.customerGstin || null,
      },
      items: inv.items && inv.items.length > 0 ? inv.items.map((it: any) => ({
        name: it.name,
        partNumber: it.partNumber,
        qty: it.qty,
        unit: it.unit || 'pcs',
        ratePaise: it.ratePaise,
        gstRateBp: it.gstRateBp || 1800,
        totalPaise: it.totalPaise,
      })) : [
        {
          name: 'Motorcycle Spare Part',
          partNumber: 'SP-PART',
          qty: 1,
          unit: 'pcs',
          ratePaise: inv.grandTotalPaise || inv.amountPaise || '0',
          gstRateBp: 1800,
          totalPaise: inv.grandTotalPaise || inv.amountPaise || '0',
        }
      ],
      subtotalPaise: inv.taxableValuePaise || inv.grandTotalPaise || inv.amountPaise,
      discountTotalPaise: '0',
      taxableValuePaise: inv.taxableValuePaise || inv.grandTotalPaise || inv.amountPaise,
      cgstPaise: inv.cgstPaise || '0',
      sgstPaise: inv.sgstPaise || '0',
      totalTaxPaise: inv.totalTaxPaise || '0',
      grandTotalPaise: inv.grandTotalPaise || inv.amountPaise || '0',
      paidNowPaise: inv.paidNowPaise || '0',
      creditBalancePaise: inv.creditBalancePaise || '0',
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
      }
    };

    setSelectedInvoiceForPreview(previewData);
    setIsPreviewOpen(true);
  };

  const handleShareWhatsApp = (inv: any) => {
    const invNo = inv.invoiceNumber || inv.number || 'INV-001';
    const total = formatPaiseToRupees(BigInt(inv.grandTotalPaise || inv.amountPaise || 0));
    const paid = formatPaiseToRupees(BigInt(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)));
    const credit = formatPaiseToRupees(BigInt(inv.creditBalancePaise || 0));
    const custName = inv.customerShop || inv.customerName || inv.customer || 'Customer';
    const phone = (inv.customerPhone || '').replace(/\D/g, '');

    const message = `*TAX INVOICE - ${(tenant?.name || 'TRADE SUPPLIES').toUpperCase()}*\n` +
      `--------------------------------\n` +
      `*Invoice No:* ${invNo}\n` +
      `*Client:* ${custName}\n` +
      `*Date:* ${inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : 'Today'}\n` +
      `*Grand Total:* ${total}\n` +
      `*Paid Amount:* ${paid}\n` +
      (BigInt(inv.creditBalancePaise || 0) > 0n ? `*Balance Due:* ${credit}\n` : '') +
      `--------------------------------\n` +
      `*Bank / UPI Settlement Details:*\n` +
      `• UPI ID: *${tenant?.upiId || 'tradeledger@okhdfcbank'}*\n` +
      `• Bank A/C: *${tenant?.bankDetails?.accountNumber || '50200012345678'}* (${tenant?.bankDetails?.bankName || 'HDFC Bank'})\n` +
      `• IFSC: *${tenant?.bankDetails?.ifscCode || 'HDFC0001234'}*\n\n` +
      `Thank you for your business!\n` +
      `*${tenant?.name || 'TradeLedger'}*`;

    const url = phone.length >= 10 
      ? `https://api.whatsapp.com/send?phone=91${phone.slice(-10)}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return filterMode === 'ALL' ||
        (filterMode === 'PAID' && BigInt(inv.creditBalancePaise || 0) === 0n) ||
        (filterMode === 'CREDIT' && BigInt(inv.creditBalancePaise || 0) > 0n);
    }

    const digitQuery = q.replace(/\D/g, '');
    const invNum = (inv.invoiceNumber || inv.number || '').toLowerCase();
    const custName = (inv.customerName || inv.customer || '').toLowerCase();
    const custShop = (inv.customerShop || '').toLowerCase();
    const custPhone = (inv.customerPhone || '').toLowerCase();
    const amountRs = (Number(BigInt(inv.grandTotalPaise || inv.amountPaise || 0)) / 100).toString();

    const matchesSearch =
      invNum.includes(q) ||
      (digitQuery && invNum.includes(digitQuery)) ||
      custName.includes(q) ||
      custShop.includes(q) ||
      custPhone.includes(q) ||
      amountRs.includes(q);

    const matchesFilter = filterMode === 'ALL' ||
      (filterMode === 'PAID' && BigInt(inv.creditBalancePaise || 0) === 0n) ||
      (filterMode === 'CREDIT' && BigInt(inv.creditBalancePaise || 0) > 0n);

    return matchesSearch && matchesFilter;
  });

  // KPI telemetry
  const totalBilledPaise = invoices.reduce((sum, inv) => sum + BigInt(inv.grandTotalPaise || inv.amountPaise || 0), 0n);
  const totalCollectedPaise = invoices.reduce((sum, inv) => sum + BigInt(inv.paidNowPaise || (inv.creditBalancePaise === '0' ? inv.grandTotalPaise : 0)), 0n);
  const totalDuePaise = invoices.reduce((sum, inv) => sum + BigInt(inv.creditBalancePaise || 0), 0n);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER RIBBON */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                {t('invs.title', 'Invoices & Billing History')}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {invoices.length} Invoices
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {t('invs.subtitle', 'GST compliant tax invoices, single-page A4 vector print, and WhatsApp dispatch.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="h-8 px-3 bg-white hover:bg-[#F8F9FA] text-[#475569] hover:text-[#0F172A] rounded-md border border-[#CBD5E1] text-xs font-medium transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Refresh Invoices"
          >
            <span>Refresh</span>
          </button>

          <Link
            href="/pos"
            className="h-8 inline-flex items-center gap-1.5 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-md transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('app.new_bill', 'New Bill')}</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-red-900/60 rounded text-[10px] text-white font-mono">F2</kbd>
          </Link>
        </div>
      </div>

      {/* 2. INVOICE TELEMETRY SUMMARY STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Total Invoiced Volume</span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-0.5">
              {formatPaiseToRupees(totalBilledPaise)}
            </div>
            <span className="text-[10px] text-[#64748B]">{invoices.length} total tax bills</span>
          </div>
          <div className="w-7 h-7 rounded-md bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#DBEAFE]">
            <Receipt className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Realized Collections</span>
            <div className="text-lg font-bold font-mono text-[#16A34A] mt-0.5">
              {formatPaiseToRupees(totalCollectedPaise)}
            </div>
            <span className="text-[10px] text-[#16A34A] font-medium">Cash & UPI Settled</span>
          </div>
          <div className="w-7 h-7 rounded-md bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center border border-[#DCFCE7]">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Invoice Balance Due</span>
            <div className="text-lg font-bold font-mono text-[#D97706] mt-0.5">
              {formatPaiseToRupees(totalDuePaise)}
            </div>
            <span className="text-[10px] text-[#D97706] font-medium">
              {invoices.filter(inv => BigInt(inv.creditBalancePaise || 0) > 0n).length} bills with pending balance
            </span>
          </div>
          <div className="w-7 h-7 rounded-md bg-[#FFFBEB] text-[#D97706] flex items-center justify-center border border-[#FEF3C7]">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 3. FILTER AND SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, customer name, phone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8F9FA] border border-[#CBD5E1] rounded-md focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] text-[#0F172A] placeholder-[#94A3B8] outline-hidden transition"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs">
          {[
            { id: 'ALL', label: 'All Invoices' },
            { id: 'PAID', label: 'Fully Paid' },
            { id: 'CREDIT', label: 'Credit Due' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              className={`h-7 px-3 rounded text-[11px] font-medium transition cursor-pointer ${
                filterMode === id
                  ? 'bg-white text-[#0F172A] shadow-2xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. INVOICES TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] text-[10px] font-semibold uppercase">
                <th className="py-3 px-4">{t('invs.invoice_no', 'Invoice #')}</th>
                <th className="py-3 px-4">{t('invs.customer', 'Customer / Client')}</th>
                <th className="py-3 px-4 text-right">{t('invs.total_amount', 'Grand Total')}</th>
                <th className="py-3 px-4 text-center">{t('invs.status', 'Payment Status')}</th>
                <th className="py-3 px-4 text-right">{t('invs.date', 'Date & Time')}</th>
                <th className="py-3 px-4 text-right">{t('inv.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                    {t('common.loading', 'Loading invoices...')}
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8] space-y-2">
                    <Receipt className="w-8 h-8 text-[#CBD5E1] mx-auto" />
                    <div className="font-medium text-[#334155] text-xs">
                      No invoices found matching current filter
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isPaid = BigInt(inv.creditBalancePaise || 0) === 0n;
                  const formattedDate = inv.createdAt 
                    ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Today';

                  return (
                    <tr key={inv.id} className="hover:bg-[#F8F9FA] transition-colors group">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0F172A]">
                        <button
                          onClick={() => openPreview(inv)}
                          className="hover:text-[#C81E1E] flex items-center gap-1.5 text-[#0F172A] transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#C81E1E]" />
                          <span>{inv.invoiceNumber || inv.number}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0F172A]">
                          {inv.customerShop || inv.customerName || inv.customer || 'Retail Walk-in'}
                        </div>
                        {inv.customerPhone ? (
                          <div className="text-[10px] text-[#64748B] font-mono">
                            {inv.customerPhone}
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#94A3B8]">
                            Counter Sales
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F172A]">
                        {formatPaiseToRupees(BigInt(inv.grandTotalPaise || inv.amountPaise || 0))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          isPaid 
                            ? 'bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7]' 
                            : 'bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-[#16A34A]' : 'bg-[#D97706]'}`} />
                          {isPaid ? 'PAID' : 'DUE ON CREDIT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#64748B] text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openPreview(inv)}
                            className="h-7 px-2.5 bg-white hover:bg-[#F1F5F9] text-[#334155] rounded-md border border-[#CBD5E1] transition flex items-center gap-1.5 text-[11px] shadow-2xs font-medium cursor-pointer"
                            title="Preview and Print Vector Invoice"
                          >
                            <Printer className="w-3 h-3 text-[#64748B]" />
                            <span>Print</span>
                          </button>

                          <button
                            onClick={() => handleShareWhatsApp(inv)}
                            className="h-7 px-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-md transition flex items-center gap-1.5 text-[11px] font-semibold shadow-2xs cursor-pointer"
                            title="Direct WhatsApp Dispatch"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={selectedInvoiceForPreview}
      />
    </div>
  );
}
