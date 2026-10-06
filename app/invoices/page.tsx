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

    setSelectedInvoiceForPreview(previewData);
    setIsPreviewOpen(true);
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return filterMode === 'ALL' ||
        (filterMode === 'PAID' && BigInt(inv.creditBalancePaise || 0) === 0n) ||
        (filterMode === 'KHATA' && BigInt(inv.creditBalancePaise || 0) > 0n);
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
      (filterMode === 'KHATA' && BigInt(inv.creditBalancePaise || 0) > 0n);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Title & New Bill Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#DC2626]" />
            <span>{t('invs.title', 'Invoices & Billing History')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t('invs.subtitle', 'GST compliant tax invoices, single-page A4 print, and WhatsApp sharing.')}
          </p>
        </div>

        <Link
          href="/pos"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-xl shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('app.new_bill', 'New Bill')}</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E4E7EC] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'hi' ? 'बिल नंबर या ग्राहक खोजें...' : 'Search by invoice # or customer...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E4E7EC] rounded-lg focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'PAID', 'KHATA'].map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterMode === mode
                  ? 'bg-[#1570EF] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-[#E4E7EC]'
              }`}
            >
              {mode === 'ALL' 
                ? (language === 'hi' ? 'सभी बिल' : 'All Invoices') 
                : mode === 'PAID' 
                  ? (language === 'hi' ? 'पूर्ण भुगतान' : 'Fully Paid') 
                  : (language === 'hi' ? 'बकाया खाता' : 'Pending Khata')}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-[#E4E7EC] bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
            {language === 'hi' ? `जारी किए गए बिल (${filteredInvoices.length})` : `All Issued Bills (${filteredInvoices.length})`}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F7F8FA] text-[#667085] font-semibold">
                <th className="py-2.5 px-4">{t('invs.invoice_no', 'Invoice #')}</th>
                <th className="py-2.5 px-3">{t('invs.customer', 'Customer / Shop')}</th>
                <th className="py-2.5 px-3 text-right">{t('invs.total_amount', 'Grand Total')}</th>
                <th className="py-2.5 px-3 text-center">{t('invs.status', 'Payment')}</th>
                <th className="py-2.5 px-3 text-right">{t('invs.date', 'Date & Time')}</th>
                <th className="py-2.5 px-4 text-center">{t('inv.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#667085]">
                    {t('common.loading', 'Loading invoices...')}
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#667085] space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="font-semibold text-slate-800">
                      {language === 'hi' ? 'अभी तक कोई बिल दर्ज नहीं हुआ' : 'No invoices recorded yet'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {language === 'hi' ? 'नया बिल बनाने के लिए "नया बिल" पर क्लिक करें।' : 'Press F2 or click "New Bill" to generate your first tax invoice.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isPaid = BigInt(inv.creditBalancePaise || 0) === 0n;
                  const formattedDate = inv.createdAt 
                    ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : (language === 'hi' ? 'आज' : 'Today');

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-4 font-mono font-bold text-[#1570EF]">
                        <button
                          onClick={() => openPreview(inv)}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#1570EF] group-hover:scale-110 transition" />
                          <span>{inv.invoiceNumber || inv.number}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#172033]">
                          {inv.customerShop || inv.customerName || inv.customer}
                        </div>
                        {inv.customerPhone && (
                          <div className="text-[10px] text-[#667085] font-mono">
                            {inv.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numeric font-bold text-[#172033]">
                        {formatPaiseToRupees(BigInt(inv.grandTotalPaise || inv.amountPaise || 0))}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPaid 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isPaid ? (language === 'hi' ? 'भुगतान पूर्ण' : 'PAID') : (language === 'hi' ? 'बकाया खाता' : 'KHATA DUE')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#667085]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View / Print Button */}
                          <button
                            onClick={() => openPreview(inv)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#1570EF] rounded-lg border border-blue-200 transition"
                            title={language === 'hi' ? 'बिल देखें व प्रिंट करें' : 'Preview and Print Invoice'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* WhatsApp Share Button */}
                          <button
                            onClick={() => openPreview(inv)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition"
                            title={language === 'hi' ? 'व्हाट्सएप पर भेजें' : 'Share on WhatsApp'}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
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
