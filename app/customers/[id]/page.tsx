'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  Printer,
  FileText,
  Edit3,
  Trash2,
  BookPlus,
  MessageCircle,
  Send,
  Eye,
  Plus,
  Copy,
  ExternalLink,
  ShieldCheck,
  Award,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import { calculateCustomerCreditScore } from '@/app/lib/creditScore';
import RazorpayModal from '@/app/components/RazorpayModal';
import ClientPortal from '@/app/components/ClientPortal';
import EditCustomerModal from '@/app/components/EditCustomerModal';
import AddLedgerEntryModal from '@/app/components/AddLedgerEntryModal';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';

interface LedgerItem {
  id: string;
  date: string;
  type: string;
  refNo: string;
  narration: string;
  debitPaise: string;
  creditPaise: string;
  runningBalancePaise: string;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { tenant } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'INVOICES' | 'REMINDERS'>('LEDGER');

  // Preview Modal
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState<InvoicePreviewData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [copiedReminder, setCopiedReminder] = useState<boolean>(false);
  const [nurtureStage, setNurtureStage] = useState<'GENTLE' | 'DUE' | 'URGENT'>('GENTLE');

  // Edit customer modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAddLedgerModalOpen, setIsAddLedgerModalOpen] = useState<boolean>(false);

  // Payment modal state
  const [isPaymentModal, setIsPaymentModal] = useState<boolean>(false);
  const [isRazorpayModal, setIsRazorpayModal] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('5000.00');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [paymentRef, setPaymentRef] = useState<string>('UPI/392019481023');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/customers/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customer) {
          setCustomer(data.customer);
        }
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
  }, [params.id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount) return;

    try {
      setSubmittingPayment(true);
      const amtPaise = parseRupeesToPaise(paymentAmount);

      const res = await fetch(`/api/v1/customers/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: amtPaise.toString(),
          mode: paymentMode,
          referenceNumber: paymentRef,
        }),
      });

      if (res.ok) {
        setIsPaymentModal(false);
        fetchCustomerDetail();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    if (!confirm(`Are you sure you want to delete customer "${customer.shopName || customer.name}"? This will remove the account from the active directory.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/customers/${params.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/customers');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete customer');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting customer');
    }
  };

  if (loading && !customer) {
    return (
      <div className="py-20 text-center text-[#64748B] text-xs font-mono">
        Loading customer double-entry ledger...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-20 text-center text-[#DC2626] text-xs">
        Customer account not found in registry.
      </div>
    );
  }

  const ledger: LedgerItem[] = customer.ledger || [];
  const aging = customer.aging || {
    current: customer.balancePaise,
    days31to60: '0',
    days61to90: '0',
    days90Plus: '0',
  };

  const rawBalance = BigInt(customer.balancePaise || 0);
  const isAdvance = rawBalance < 0n;
  const isDue = rawBalance > 0n;
  const absBalance = isAdvance ? -rawBalance : rawBalance;
  const creditLimit = BigInt(customer.creditLimitPaise || 5000000);
  const utilizationPct = creditLimit > 0n && isDue ? Math.min(100, Math.round(Number((rawBalance * 100n) / creditLimit))) : 0;

  const currentAging = isDue ? BigInt(aging.current || 0) : 0n;
  const days31to60 = isDue ? BigInt(aging.days31to60 || 0) : 0n;
  const days61to90 = isDue ? BigInt(aging.days61to90 || 0) : 0n;
  const days90Plus = isDue ? BigInt(aging.days90Plus || 0) : 0n;
  const customerInvoices = customer.invoices || [];

  // Calculate Comprehensive B2B Credit Score (300 to 900 scale)
  const overduePaise = days31to60 + days61to90 + days90Plus;
  const daysOverdue = days90Plus > 0n ? 90 : days61to90 > 0n ? 60 : days31to60 > 0n ? 30 : 0;
  const creditScore = calculateCustomerCreditScore({
    balancePaise: customer.balancePaise,
    creditLimitPaise: customer.creditLimitPaise,
    overduePaise,
    daysOverdue,
    invoicesCount: customer.invoices?.length || 1,
    paidOnTimeRate: customer.onTimeRate ? parseInt(customer.onTimeRate, 10) : 90,
    termsDays: customer.termsDays || 15,
  });

  const handlePreviewInvoice = (inv: any) => {
    const previewData: InvoicePreviewData = {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber || `INV-${inv.id?.slice(0, 6)}`,
      status: inv.status,
      cancelReason: inv.cancelReason,
      date: inv.date || (inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : 'Today'),
      time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now',
      placeOfSupply: '27 - Maharashtra',
      customer: {
        id: customer.id,
        name: customer.name,
        shopName: customer.shopName || customer.name,
        phone: customer.phone,
        address: customer.address || 'Local Counter Customer',
        gstin: customer.gstin || null,
      },
      items: inv.items && inv.items.length > 0 ? inv.items.map((it: any) => ({
        name: it.name,
        partNumber: it.partNumber,
        qty: it.qty,
        unit: it.unit || 'pcs',
        ratePaise: it.ratePaise,
        gstRateBp: 0,
        totalPaise: it.totalPaise,
      })) : [
        {
          name: 'Automotive Genuine Spare Parts & Components',
          partNumber: 'SP-PART',
          qty: inv.itemsCount || 1,
          unit: 'pcs',
          ratePaise: inv.grandTotalPaise || '0',
          gstRateBp: 0,
          totalPaise: inv.grandTotalPaise || '0',
        }
      ],
      subtotalPaise: inv.grandTotalPaise || '0',
      discountTotalPaise: '0',
      taxableValuePaise: inv.grandTotalPaise || '0',
      cgstPaise: '0',
      sgstPaise: '0',
      totalTaxPaise: '0',
      grandTotalPaise: inv.grandTotalPaise || '0',
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

    setSelectedPreviewInvoice(previewData);
    setIsPreviewModalOpen(true);
  };

  const handleShareInvoiceWhatsApp = (inv: any) => {
    const invNo = inv.invoiceNumber || `INV-${inv.id?.slice(0, 6)}`;
    const total = formatPaiseToRupees(BigInt(inv.grandTotalPaise || 0));
    const paid = formatPaiseToRupees(BigInt(inv.paidNowPaise || 0));
    const due = formatPaiseToRupees(BigInt(inv.creditBalancePaise || 0));
    const phone = (customer.phone || '').replace(/\D/g, '');

    const text = `*Digital Bill Summary: ${invNo}*\nDear ${customer.shopName || customer.name},\nThank you for choosing ${tenant?.name || 'us'}. Here is your bill summary:\n\n*Total Bill:* ${total}\n*Amount Paid:* ${paid}\n*Balance on Khata:* ${due}\n*Date:* ${inv.date}\n\nFor queries or digital receipts, reach out anytime.\nThank you!`;
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 3-Tier Dynamic Payment Nurture Messages
  const reminderText = React.useMemo(() => {
    const custName = customer?.shopName || customer?.name || 'Valued Customer';
    const storeName = tenant?.name || 'Apex Trade & Wholesale';
    const bank = tenant?.bankDetails?.bankName || 'HDFC Bank';
    const ac = tenant?.bankDetails?.accountNumber || '50200012345678';
    const ifsc = tenant?.bankDetails?.ifscCode || 'HDFC0001234';
    const upi = tenant?.upiId || 'tradeledger@okhdfcbank';

    if (nurtureStage === 'GENTLE') {
      return `*Friendly Payment Update - ${storeName}*\n\n` +
        `Dear ${custName},\n` +
        `Greetings from ${storeName}! Here is a friendly statement of your khata ledger.\n\n` +
        `*Current Outstanding Balance:* ${formatPaiseToRupees(absBalance)}\n` +
        `*Credit Limit:* ${formatPaiseToRupees(creditLimit)}\n\n` +
        `*Instant Settlement Details:*\n` +
        `• UPI ID: ${upi}\n` +
        `• Bank: ${bank} | A/C: ${ac} | IFSC: ${ifsc}\n\n` +
        `Kindly clear this at your earliest convenience or share transaction details if already settled.\nThank you for your business!`;
    }

    if (nurtureStage === 'DUE') {
      return `*Payment Reminder: Pending Khata Due - ${storeName}*\n\n` +
        `Dear ${custName},\n` +
        `This is a reminder that your pending balance of *${formatPaiseToRupees(absBalance)}* is due under your credit terms (${customer?.termsDays || 15} days).\n\n` +
        `To ensure uninterrupted spare parts billing and protect your credit score (${creditScore.score}/900), please settle the amount:\n\n` +
        `*Pay via UPI / NetBanking:*\n` +
        `• UPI ID: ${upi}\n` +
        `• Bank: ${bank} (A/C: ${ac}, IFSC: ${ifsc})\n\n` +
        `If payment was made today, please reply with the screenshot. Thank you!`;
    }

    // URGENT Stage
    return `*URGENT: Overdue Account Notice - ${storeName}*\n\n` +
      `ATTN: ${custName},\n` +
      `Your account has an overdue khata balance of *${formatPaiseToRupees(absBalance)}* exceeding allowable payment terms.\n\n` +
      `⚠️ *Action Required:* Please clear the overdue balance immediately to prevent temporary hold on credit purchases.\n\n` +
      `*Settlement Account Details:*\n` +
      `• UPI ID: ${upi}\n` +
      `• Bank A/C: ${ac} (${bank}, IFSC: ${ifsc})\n\n` +
      `For any billing assistance, reach our counter directly at ${tenant?.phone || 'our helpline'}.\n` +
      `Sincerely,\n${storeName}`;
  }, [customer, tenant, absBalance, creditLimit, nurtureStage, creditScore.score]);

  const handleSendReminderWhatsApp = () => {
    const phone = (customer?.phone || '').replace(/\D/g, '');
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(reminderText)}`;
    window.open(url, '_blank');
  };

  const handleCopyReminder = () => {
    navigator.clipboard.writeText(reminderText);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-lg px-4 py-2.5 shadow-2xs">
        <Link
          href="/customers"
          className="text-xs text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1.5 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Customer Directory</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-md border border-slate-300 transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Customer</span>
          </button>
          <button
            onClick={handleDeleteCustomer}
            className="h-8 px-3 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs rounded-md border border-rose-200 transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Delete Customer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Delete</span>
          </button>
          <button
            onClick={() => setIsAddLedgerModalOpen(true)}
            className="h-8 px-3 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] font-semibold text-xs rounded-md border border-[#FECACA] transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <BookPlus className="w-3.5 h-3.5 text-[#DC2626]" />
            <span>+ Add Ledger Entry</span>
          </button>
          <button
            onClick={() => setIsRazorpayModal(true)}
            className="h-8 px-3 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#15803D] font-semibold text-xs rounded-md border border-[#86EFAC] transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Send Payment Link / QR</span>
          </button>
          <button
            onClick={() => setIsPaymentModal(true)}
            className="h-8 px-3 bg-[#0F172A] hover:bg-[#1E293B] text-white font-medium text-xs rounded-md transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
          <Link
            href={`/pos?customerId=${customer.id}`}
            className="h-8 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-md transition inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>New Bill (F2)</span>
          </Link>
        </div>
      </div>

      {/* Account Master Summary Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">{customer.shopName}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${customer.status === 'GREEN'
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                  : customer.status === 'YELLOW'
                    ? 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${customer.status === 'GREEN' ? 'bg-[#16A34A]' : customer.status === 'YELLOW' ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                  }`} />
                {customer.status} HEALTH
              </span>
            </div>
            <div className="text-xs text-[#475569] mt-0.5">
              Proprietor: <span className="font-semibold text-[#0F172A]">{customer.name}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] mt-2 font-mono">
              <span className="flex items-center gap-1 text-[#0F172A]">
                <Phone className="w-3 h-3 text-[#94A3B8]" />
                {customer.phone}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-sans text-[#475569]">
                <MapPin className="w-3 h-3 text-[#94A3B8]" />
                {customer.address}
              </span>
              <span>•</span>
              <span>GSTIN: {customer.gstin || 'URP (Unregistered)'}</span>
            </div>
          </div>

          {/* Balance & Limit Box */}
          <div className="flex items-center gap-4 bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isAdvance
                    ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                    : isDue
                      ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                      : 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]'
                  }`}>
                  {isAdvance ? 'ADVANCE CREDIT' : isDue ? 'OUTSTANDING BALANCE' : 'SETTLED'}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
                  {isAdvance ? 'Advance Credit' : 'Account Balance'}
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono tabular-nums ${isAdvance ? 'text-[#15803D]' : isDue ? 'text-[#DC2626]' : 'text-[#0F172A]'
                }`}>
                {formatPaiseToRupees(absBalance)} {isAdvance && <span className="text-xs font-bold text-[#16A34A] font-sans">(Cr)</span>}
              </div>
              <div className="text-[11px] text-[#64748B] font-mono mt-1">
                Limit: {formatPaiseToRupees(creditLimit)} ({customer.termsDays}d terms) • {isAdvance ? <span className="text-[#15803D] font-semibold">0% used (Advance Credit)</span> : <span>{utilizationPct}% limit used</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Credit Score & Risk Assessment Strip */}
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
            <div className="flex items-center gap-3.5">
              <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
                <span className="text-[10px] uppercase font-semibold text-slate-500 font-mono">B2B Score</span>
                <span className="text-xl font-bold font-mono text-slate-900 leading-tight">
                  {creditScore.score}
                  <span className="text-[11px] font-normal text-slate-400">/900</span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                    creditScore.color === 'emerald'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : creditScore.color === 'blue'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : creditScore.color === 'amber'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    ★ {creditScore.ratingLabel}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    Credit Rating: {creditScore.rating}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Limit Utilization: <strong className="text-slate-700">{creditScore.utilizationPct}%</strong></span>
                  <span>•</span>
                  <span>Max Credit Allowed: <strong className="text-slate-700 font-mono">₹{formatPaiseToRupees(creditLimit)}</strong></span>
                  <span>•</span>
                  <span>Repayment Terms: <strong className="text-slate-700">{customer.termsDays || 15} Days</strong></span>
                </div>
              </div>
            </div>

            {/* Drivers Pills */}
            <div className="flex flex-wrap items-center gap-1.5 self-stretch md:self-auto">
              {creditScore.drivers.map((driver, idx) => (
                <span
                  key={idx}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                    driver.type === 'POSITIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : driver.type === 'NEUTRAL'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {driver.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Aging Buckets Strip */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          {isAdvance ? (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-[#15803D]">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>
                  <strong>Zero Overdue Dues:</strong> Customer has an advance deposit surplus of{' '}
                  <strong className="font-mono font-bold text-[#15803D]">
                    ₹{formatPaiseToRupees(absBalance)} (Cr)
                  </strong>
                  . Aging debt buckets are ₹0.00.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] uppercase tracking-wider font-mono">
                100% On-Time Credit Health
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
              <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
                <div className="text-[10px] uppercase text-[#64748B] font-semibold">0-30 Days (Current)</div>
                <div className="text-xs font-bold font-mono text-[#0F172A] mt-1 tabular-nums">
                  {formatPaiseToRupees(currentAging)}
                </div>
              </div>
              <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
                <div className="text-[10px] uppercase text-[#64748B] font-semibold">31-60 Days</div>
                <div className="text-xs font-bold font-mono text-[#0F172A] mt-1 tabular-nums">
                  {formatPaiseToRupees(days31to60)}
                </div>
              </div>
              <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
                <div className="text-[10px] uppercase text-[#64748B] font-semibold">61-90 Days</div>
                <div className="text-xs font-bold font-mono text-[#D97706] mt-1 tabular-nums">
                  {formatPaiseToRupees(days61to90)}
                </div>
              </div>
              <div className="bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
                <div className="text-[10px] uppercase text-[#64748B] font-semibold">90+ Days (Critical)</div>
                <div className="text-xs font-bold font-mono text-[#DC2626] mt-1 tabular-nums">
                  {formatPaiseToRupees(days90Plus)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E2E8F0] flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-2.5 font-medium border-b-2 transition cursor-pointer ${activeTab === 'LEDGER' ? 'border-[#C81E1E] text-[#C81E1E] font-semibold' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          Append-Only Khata Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-2.5 font-medium border-b-2 transition cursor-pointer ${activeTab === 'INVOICES' ? 'border-[#C81E1E] text-[#C81E1E] font-semibold' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          Billed Invoices History ({customerInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab('REMINDERS')}
          className={`pb-2.5 font-medium border-b-2 transition cursor-pointer ${activeTab === 'REMINDERS' ? 'border-[#C81E1E] text-[#C81E1E] font-semibold' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          WhatsApp Payment Reminders {isDue && <span className="ml-1 px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">Due</span>}
        </button>
      </div>

      {/* 1. Live Ledger Table */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Chronological Debit / Credit Double-Entry Ledger
            </h3>
            <span className="text-[11px] text-[#64748B] font-mono">Immutable Double-Entry Entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F9FA] text-[10px] font-semibold uppercase text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 w-24">Type</th>
                  <th className="py-3 px-4 w-36">Reference No.</th>
                  <th className="py-3 px-4">Narration / Description</th>
                  <th className="py-3 px-4 w-32 text-right">Debit / Billed (₹)</th>
                  <th className="py-3 px-4 w-32 text-right">Credit / Paid (₹)</th>
                  <th className="py-3 px-4 w-36 text-right">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#94A3B8] font-sans">
                      No ledger transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry) => {
                    const runBal = BigInt(entry.runningBalancePaise || 0);
                    const isEntryAdvance = runBal < 0n;
                    const absRunBal = isEntryAdvance ? -runBal : runBal;

                    return (
                      <tr key={entry.id} className="hover:bg-[#F8F9FA] transition">
                        <td className="py-3 px-4 text-[#64748B]">{entry.date}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${entry.type === 'INVOICE'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                              : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                            }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#0F172A] font-semibold">{entry.refNo}</td>
                        <td className="py-3 px-4 text-[#475569] font-sans">{entry.narration}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#DC2626] tabular-nums">
                          {BigInt(entry.debitPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.debitPaise)) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#16A34A] tabular-nums">
                          {BigInt(entry.creditPaise || 0) > 0n ? formatPaiseToRupees(BigInt(entry.creditPaise)) : '-'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold tabular-nums ${isEntryAdvance ? 'text-[#15803D]' : runBal > 0n ? 'text-[#DC2626]' : 'text-[#0F172A]'
                          }`}>
                          {formatPaiseToRupees(absRunBal)}
                          {isEntryAdvance ? (
                            <span className="ml-1 text-[9px] font-bold text-[#16A34A] bg-[#F0FDF4] px-1 py-0.2 rounded border border-[#BBF7D0]">Cr</span>
                          ) : runBal > 0n ? (
                            <span className="ml-1 text-[9px] font-bold text-[#DC2626] bg-[#FEF2F2] px-1 py-0.2 rounded border border-[#FECACA]">Dr</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Billed Invoices History */}
      {activeTab === 'INVOICES' && (
        <div>
          {customerInvoices.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center shadow-2xs">
              <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 shadow-2xs">
                <Receipt className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Billed Invoices Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                No tax or cash invoices have been generated for {customer.shopName || customer.name} yet. All POS bills created for this account will appear here with instant vector print and WhatsApp dispatch.
              </p>
              <Link
                href={`/pos?customerId=${customer.id}`}
                className="inline-flex items-center gap-2 h-9 px-4 bg-[#C81E1E] hover:bg-[#991B1B] text-white font-semibold text-xs rounded-lg shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Bill (F2)</span>
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Tax & Cash Invoices Generated ({customerInvoices.length})
                </h3>
                <Link
                  href={`/pos?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C81E1E] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Bill (F2)
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] text-[10px] font-semibold uppercase text-[#64748B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                      <th className="py-3 px-4 text-right">Paid (₹)</th>
                      <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs">
                    {customerInvoices.map((inv: any) => {
                      const total = BigInt(inv.grandTotalPaise || 0);
                      const paid = BigInt(inv.paidNowPaise || 0);
                      const due = BigInt(inv.creditBalancePaise || 0);
                      const isCancelled = inv.status === 'CANCELLED';
                      const isPaid = !isCancelled && due === 0n;
                      const isPartial = !isCancelled && due > 0n && paid > 0n;

                      return (
                        <tr key={inv.id} className={`transition ${isCancelled ? 'bg-rose-50/30 opacity-75' : 'hover:bg-[#F8F9FA]'}`}>
                          <td className="py-3 px-4 font-bold text-[#0F172A]">
                            <button
                              onClick={() => handlePreviewInvoice(inv)}
                              className={`hover:text-[#C81E1E] hover:underline text-left inline-flex items-center gap-1.5 cursor-pointer ${isCancelled ? 'line-through text-slate-500' : ''}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-[#64748B]" />
                              <span>{inv.invoiceNumber}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-[#64748B]">{inv.date}</td>
                          <td className="py-3 px-4 text-[#475569] font-sans">{inv.itemsCount || 1} items</td>
                          <td className={`py-3 px-4 text-right font-bold tabular-nums ${isCancelled ? 'line-through text-slate-400' : 'text-[#0F172A]'}`}>
                            {formatPaiseToRupees(total)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#16A34A] tabular-nums">
                            {formatPaiseToRupees(paid)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#DC2626] tabular-nums">
                            {formatPaiseToRupees(due)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
                                CANCELLED
                              </span>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${isPaid
                                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                                  : isPartial
                                    ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                                    : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                                }`}>
                                {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5 font-sans">
                              <button
                                onClick={() => handlePreviewInvoice(inv)}
                                className="h-7 px-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] rounded border border-slate-300 transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="View Paperless Digital Bill"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>View Bill</span>
                              </button>
                              {!isCancelled && (
                                <button
                                  onClick={() => handleShareInvoiceWhatsApp(inv)}
                                  className="h-7 px-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-[11px] rounded border border-[#25D366]/30 transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Share Invoice on WhatsApp"
                                >
                                  <MessageCircle className="w-3 h-3 text-[#128C7E]" />
                                  <span>WhatsApp</span>
                                </button>
                              )}
                              {!isCancelled && (
                                <button
                                  onClick={async () => {
                                    const reason = prompt(`Reason for cancelling invoice #${inv.invoiceNumber}:`, 'Customer Cancellation / Billing Error');
                                    if (!reason) return;
                                    try {
                                      const res = await fetch('/api/v1/invoices', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: inv.id, reason }),
                                      });
                                      if (res.ok) {
                                        fetchCustomerDetail();
                                      } else {
                                        const err = await res.json().catch(() => ({}));
                                        alert(err.error || 'Failed to cancel invoice');
                                      }
                                    } catch (e: any) {
                                      alert(e.message || 'Error cancelling invoice');
                                    }
                                  }}
                                  className="h-7 px-2 bg-white hover:bg-rose-50 text-rose-600 rounded border border-rose-200 transition inline-flex items-center gap-1 text-[11px] shadow-2xs cursor-pointer"
                                  title="Cancel & Reverse Invoice"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-500" />
                                  <span className="hidden sm:inline">Cancel</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. WhatsApp Payment Reminders */}
      {activeTab === 'REMINDERS' && (
        <div>
          {isDue ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left Column: Live WhatsApp Message Simulator */}
              <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[#128C7E]">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Smart Payment Nurture Dispatcher</h3>
                      <p className="text-[11px] text-slate-500">Auto-formatted with balance, payment terms, UPI & Bank details</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 self-start sm:self-auto">
                    ₹{formatPaiseToRupees(absBalance)} Outstanding
                  </span>
                </div>

                {/* 3-Tier Nurture Stage Selector */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-600">Select Reminder Tone & Urgency:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNurtureStage('GENTLE')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer text-center ${
                        nurtureStage === 'GENTLE'
                          ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🌱 Gentle Khata Update
                    </button>
                    <button
                      type="button"
                      onClick={() => setNurtureStage('DUE')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer text-center ${
                        nurtureStage === 'DUE'
                          ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ⏳ Due Date Notice
                    </button>
                    <button
                      type="button"
                      onClick={() => setNurtureStage('URGENT')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer text-center ${
                        nurtureStage === 'URGENT'
                          ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🚨 Urgent Recovery
                    </button>
                  </div>
                </div>

                {/* WhatsApp Chat Preview Bubble */}
                <div className="bg-[#EFEAE2] p-4 rounded-xl border border-[#D1D7DB] space-y-3 font-sans">
                  <div className="bg-white rounded-lg p-3.5 shadow-xs text-xs text-slate-800 whitespace-pre-line border border-slate-200 leading-relaxed">
                    {reminderText}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    onClick={handleSendReminderWhatsApp}
                    className="h-9 px-4 bg-[#25D366] hover:bg-[#1eb857] text-white font-bold text-xs rounded-lg shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Live WhatsApp Reminder</span>
                  </button>
                  <button
                    onClick={handleCopyReminder}
                    className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    {copiedReminder ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Message Text</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsRazorpayModal(true)}
                    className="h-9 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg border border-emerald-300 transition inline-flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant UPI / QR Modal</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Account Summary & Payment Details */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Collection Details</h4>
                <div className="space-y-2.5 text-xs">
                  <div className="bg-[#F8FAFC] p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Recipient Contact</div>
                    <div className="font-bold text-slate-800 mt-0.5">{customer.shopName || customer.name}</div>
                    <div className="text-slate-600 font-mono text-[11px]">{customer.phone || 'No phone registered'}</div>
                  </div>
                  <div className="bg-[#F8FAFC] p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Settlement Bank Account</div>
                    <div className="font-bold text-slate-800 mt-0.5">{tenant?.bankDetails?.bankName || 'HDFC Bank'}</div>
                    <div className="text-slate-600 font-mono text-[11px]">A/C: {tenant?.bankDetails?.accountNumber || '50200012345678'}</div>
                    <div className="text-slate-600 font-mono text-[11px]">IFSC: {tenant?.bankDetails?.ifscCode || 'HDFC0001234'}</div>
                  </div>
                  <div className="bg-[#F8FAFC] p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Default UPI VPA</div>
                    <div className="font-bold text-slate-800 mt-0.5 font-mono">{tenant?.upiId || 'tradeledger@okhdfcbank'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center shadow-2xs">
              <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-2xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAdvance ? 'Customer Has Advance Credit Balance' : 'Account is 100% Settled'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                {isAdvance
                  ? `This account currently holds ₹${formatPaiseToRupees(absBalance)} in advance credit. No payment reminders required.`
                  : `There are zero outstanding dues for ${customer.shopName || customer.name}. All invoices and ledger entries are fully paid.`
                }
              </p>
              <div className="inline-flex items-center gap-2">
                <button
                  onClick={handleSendReminderWhatsApp}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-slate-600" />
                  <span>Send Statement of Account via WhatsApp</span>
                </button>
                <Link
                  href={`/pos?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3.5 bg-[#C81E1E] hover:bg-[#991B1B] text-white font-semibold text-xs rounded-lg transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Bill (F2)</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModal && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#16A34A]" />
                  Record Payment (Jama Entry)
                </h3>
                <button
                  onClick={() => setIsPaymentModal(false)}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[#475569] block mb-1 font-medium">Customer Account</label>
                  <div className="font-semibold text-[#0F172A] bg-[#F8F9FA] p-2.5 rounded-xl border border-[#E2E8F0]">
                    {customer.shopName} ({customer.name})
                  </div>
                </div>

                <div>
                  <label className="text-[#475569] block mb-1 font-medium">Payment Amount (₹)</label>
                  <input
                    type="text"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-sm font-bold font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#475569] block mb-1 font-medium">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                    >
                      <option value="UPI">UPI / PhonePe / GPay</option>
                      <option value="CASH">Cash at Counter</option>
                      <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#475569] block mb-1 font-medium">Reference / UTR</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. 40291048291"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModal(false)}
                    className="flex-1 h-8.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#475569] font-medium rounded-xl border border-[#CBD5E1] text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="flex-1 h-8.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50"
                  >
                    {submittingPayment ? 'Saving Entry...' : 'Confirm & Add to Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Razorpay Instant Link & QR Modal */}
      {isRazorpayModal && customer && (
        <RazorpayModal
          isOpen={isRazorpayModal}
          onClose={() => setIsRazorpayModal(false)}
          customerId={customer.id}
          customerName={customer.shopName || customer.name}
          customerPhone={customer.phone}
          defaultAmountRupees={(Number(BigInt(customer.balancePaise || 0)) / 100).toFixed(2)}
          onPaymentSuccess={() => {
            setIsRazorpayModal(false);
            fetchCustomerDetail();
          }}
        />
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && customer && (
        <EditCustomerModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          customer={customer}
          onSuccess={(updatedCustomer) => {
            setCustomer((prev: any) => ({ ...prev, ...updatedCustomer }));
            fetchCustomerDetail();
          }}
        />
      )}

      {/* Add Udhar / Ledger Entry Modal */}
      {isAddLedgerModalOpen && customer && (
        <AddLedgerEntryModal
          isOpen={isAddLedgerModalOpen}
          onClose={() => setIsAddLedgerModalOpen(false)}
          customer={customer}
          onSuccess={() => {
            fetchCustomerDetail();
          }}
        />
      )}

      {/* Vector Print & PDF Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={selectedPreviewInvoice}
      />
    </div>
  );
}
