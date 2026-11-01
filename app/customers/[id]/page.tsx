'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Sparkles,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Calendar,
  DollarSign,
  Search,
  Filter,
  Check,
  RefreshCw,
  Building2
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

  // Secondary actions menu toggle
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // Credit profile expansion toggle
  const [isCreditProfileExpanded, setIsCreditProfileExpanded] = useState(false);

  // Ledger table search, filter, pagination
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'ALL' | 'INVOICE' | 'PAYMENT' | 'JOURNAL'>('ALL');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState<number>(20);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  // Invoices table search
  const [invoiceSearch, setInvoiceSearch] = useState('');

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

  // Click outside to close secondary actions menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setIsMoreActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // F2 keyboard shortcut for New Bill
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (params.id) {
          router.push(`/pos?customerId=${params.id}`);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [params.id, router]);

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

  // Safe data derivations
  const ledger: LedgerItem[] = customer?.ledger || [];
  const customerInvoices = customer?.invoices || [];

  const aging = customer?.aging || {
    current: customer?.balancePaise || '0',
    days31to60: '0',
    days61to90: '0',
    days90Plus: '0',
  };

  const rawBalance = BigInt(customer?.balancePaise || 0);
  const isAdvance = rawBalance < 0n;
  const isDue = rawBalance > 0n;
  const absBalance = isAdvance ? -rawBalance : rawBalance;
  const creditLimit = BigInt(customer?.creditLimitPaise || 5000000);
  const utilizationPct = creditLimit > 0n && isDue ? Math.min(100, Math.round(Number((rawBalance * 100n) / creditLimit))) : 0;

  const currentAging = isDue ? BigInt(aging.current || 0) : 0n;
  const days31to60 = isDue ? BigInt(aging.days31to60 || 0) : 0n;
  const days61to90 = isDue ? BigInt(aging.days61to90 || 0) : 0n;
  const days90Plus = isDue ? BigInt(aging.days90Plus || 0) : 0n;

  // Calculate Cumulative Totals
  const totalBilledPaise = useMemo(() => {
    return ledger.reduce((acc, it) => acc + BigInt(it.debitPaise || 0), 0n);
  }, [ledger]);

  const totalPaidPaise = useMemo(() => {
    return ledger.reduce((acc, it) => acc + BigInt(it.creditPaise || 0), 0n);
  }, [ledger]);

  // Calculate Comprehensive B2B Credit Score (300 to 900 scale)
  const overduePaise = days31to60 + days61to90 + days90Plus;
  const daysOverdue = days90Plus > 0n ? 90 : days61to90 > 0n ? 60 : days31to60 > 0n ? 30 : 0;
  const creditScore = useMemo(() => {
    return calculateCustomerCreditScore({
      balancePaise: customer?.balancePaise || '0',
      creditLimitPaise: customer?.creditLimitPaise || '5000000',
      overduePaise,
      daysOverdue,
      invoicesCount: customer?.invoices?.length || 1,
      paidOnTimeRate: customer?.onTimeRate ? parseInt(customer.onTimeRate, 10) : 90,
      termsDays: customer?.termsDays || 15,
    });
  }, [customer?.balancePaise, customer?.creditLimitPaise, overduePaise, daysOverdue, customer?.invoices?.length, customer?.onTimeRate, customer?.termsDays]);

  // 3-Tier Dynamic Payment Nurture Messages - Hook must be called unconditionally before early returns
  const reminderText = useMemo(() => {
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

  // Filtered & Paginated Ledger
  const filteredLedger = useMemo(() => {
    return ledger.filter((entry) => {
      const matchesSearch =
        ledgerSearch.trim() === '' ||
        entry.refNo.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        entry.narration.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        entry.date.toLowerCase().includes(ledgerSearch.toLowerCase());

      const matchesType =
        ledgerTypeFilter === 'ALL' ||
        (ledgerTypeFilter === 'INVOICE' && entry.type === 'INVOICE') ||
        (ledgerTypeFilter === 'PAYMENT' && (entry.type === 'PAYMENT' || entry.type === 'RECEIPT')) ||
        (ledgerTypeFilter === 'JOURNAL' && entry.type !== 'INVOICE' && entry.type !== 'PAYMENT' && entry.type !== 'RECEIPT');

      return matchesSearch && matchesType;
    });
  }, [ledger, ledgerSearch, ledgerTypeFilter]);

  const totalLedgerPages = Math.max(1, Math.ceil(filteredLedger.length / ledgerPageSize));
  const paginatedLedger = useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPageSize;
    return filteredLedger.slice(start, start + ledgerPageSize);
  }, [filteredLedger, ledgerPage, ledgerPageSize]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return customerInvoices;
    const term = invoiceSearch.toLowerCase();
    return customerInvoices.filter((inv: any) =>
      (inv.invoiceNumber || '').toLowerCase().includes(term) ||
      (inv.date || '').toLowerCase().includes(term) ||
      (inv.status || '').toLowerCase().includes(term)
    );
  }, [customerInvoices, invoiceSearch]);

  const handleCopyRef = (refNo: string) => {
    if (!refNo) return;
    navigator.clipboard.writeText(refNo);
    setCopiedRefId(refNo);
    setTimeout(() => setCopiedRefId(null), 1800);
  };

  const formatRefDisplay = (ref: string) => {
    if (!ref) return '-';
    if (ref.length > 20 && !ref.includes('/') && !ref.includes(' ')) {
      return `${ref.slice(0, 8)}...${ref.slice(-4)}`;
    }
    return ref;
  };

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
    const phone = (customer?.phone || '').replace(/\D/g, '');

    const text = `*Digital Bill Summary: ${invNo}*\nDear ${customer?.shopName || customer?.name},\nThank you for choosing ${tenant?.name || 'us'}. Here is your bill summary:\n\n*Total Bill:* ${total}\n*Amount Paid:* ${paid}\n*Balance on Khata:* ${due}\n*Date:* ${inv.date}\n\nFor queries or digital receipts, reach out anytime.\nThank you!`;
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

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

  // Safe early return states
  if (loading && !customer) {
    return (
      <div className="py-24 text-center max-w-md mx-auto space-y-3">
        <div className="w-9 h-9 border-2 border-slate-300 border-t-[#C81E1E] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-600">Loading customer financial ledger...</p>
        <p className="text-[11px] text-slate-400 font-mono">Fetching double-entry ledger & aging balance</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4 bg-white border border-slate-200 rounded-xl p-8 shadow-xs">
        <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Customer Account Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">This customer record does not exist or may have been deleted.</p>
        </div>
        <div className="pt-2">
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 h-8.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Customer Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16 px-1 sm:px-2">
      {/* 1. TOP ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-2xs">
        {/* Left: Back Link */}
        <Link
          href="/customers"
          className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 font-medium transition self-start sm:self-auto group"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition group-hover:-translate-x-0.5" />
          <span>Back to Customer Directory</span>
        </Link>

        {/* Right: Actions Group */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* Secondary Actions Dropdown */}
          <div className="relative" ref={moreActionsRef}>
            <button
              type="button"
              onClick={() => setIsMoreActionsOpen(!isMoreActionsOpen)}
              className="h-8.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-300"
              aria-label="More customer actions"
              aria-expanded={isMoreActionsOpen}
            >
              <span>Actions</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isMoreActionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMoreActionsOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreActionsOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-700 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Account Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMoreActionsOpen(false);
                    setIsAddLedgerModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-700 cursor-pointer"
                >
                  <BookPlus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Add Manual Udhar / Entry</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMoreActionsOpen(false);
                    setIsRazorpayModal(true);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-700 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Generate Payment QR / Link</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setIsMoreActionsOpen(false);
                    handleDeleteCustomer();
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2.5 transition text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Customer Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Secondary Primary Action: Record Payment */}
          <button
            type="button"
            onClick={() => setIsPaymentModal(true)}
            className="h-8.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-900/30"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>

          {/* Primary Action: New Bill (F2) */}
          <Link
            href={`/pos?customerId=${customer.id}`}
            className="h-8.5 px-4 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-red-500/40"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>New Bill</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 bg-red-900/40 text-red-100 rounded text-[10px] font-mono font-normal">F2</kbd>
          </Link>
        </div>
      </div>

      {/* 2. CUSTOMER IDENTITY & ACCOUNT BALANCE HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left: Customer Identity */}
          <div className="space-y-3 flex-1 min-w-0">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
                  {customer.shopName || customer.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${
                    customer.status === 'GREEN'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : customer.status === 'YELLOW'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      customer.status === 'GREEN' ? 'bg-emerald-600' : customer.status === 'YELLOW' ? 'bg-amber-600' : 'bg-rose-600'
                    }`}
                  />
                  {customer.status || 'GREEN'} ACCOUNT
                </span>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {customer.termsDays || 15}d Net Terms
                </span>
              </div>

              {customer.shopName && customer.name && customer.shopName !== customer.name && (
                <p className="text-xs text-slate-600 font-medium">
                  Proprietor: <span className="font-semibold text-slate-800">{customer.name}</span>
                </p>
              )}
            </div>

            {/* Contact & Tax Identification Strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 font-sans pt-1">
              {customer.phone && (
                <div className="inline-flex items-center gap-1.5 font-mono text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}

              {customer.address && (
                <div className="inline-flex items-center gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate max-w-sm sm:max-w-md">{customer.address}</span>
                </div>
              )}

              <div className="inline-flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>GSTIN: <strong className="text-slate-700 font-medium">{customer.gstin || 'Unregistered / Counter Buyer'}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Distinct Financial Overview Block */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 sm:p-5 lg:min-w-[300px] text-left lg:text-right shadow-2xs">
            <div className="flex items-center justify-between lg:justify-end gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
                {isAdvance ? 'Advance Credit Surplus' : 'Account Balance (Khata)'}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isAdvance
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isDue
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isAdvance ? 'ADVANCE (Cr)' : isDue ? 'PENDING (Dr)' : 'SETTLED'}
              </span>
            </div>

            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums ${
                isAdvance ? 'text-emerald-700' : isDue ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatPaiseToRupees(absBalance)}{' '}
              <span className="text-xs font-bold font-sans">
                {isAdvance ? 'Cr' : isDue ? 'Dr' : ''}
              </span>
            </div>

            {/* Credit Limit & Utilization Indicator */}
            <div className="mt-2.5 pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                <span>Credit Limit: <strong className="text-slate-700 font-semibold">{formatPaiseToRupees(creditLimit)}</strong></span>
                <span className={isAdvance ? 'text-emerald-700 font-medium' : utilizationPct > 80 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                  {isAdvance ? '0% Used' : `${utilizationPct}% Used`}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isAdvance
                      ? 'bg-emerald-500 w-0'
                      : utilizationPct > 90
                        ? 'bg-rose-600'
                        : utilizationPct > 70
                          ? 'bg-amber-500'
                          : 'bg-slate-700'
                  }`}
                  style={{ width: `${isAdvance ? 0 : Math.min(utilizationPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. COMPACT EXPANDABLE CREDIT PROFILE */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl overflow-hidden transition-all duration-200">
            {/* Header / Summary Strip (Always Visible) */}
            <div
              onClick={() => setIsCreditProfileExpanded(!isCreditProfileExpanded)}
              className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition select-none"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1 shadow-2xs font-mono">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">B2B Score</span>
                  <span className="text-sm font-bold text-slate-900">{creditScore.score}</span>
                  <span className="text-[10px] text-slate-400">/900</span>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    creditScore.color === 'emerald'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : creditScore.color === 'blue'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : creditScore.color === 'amber'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  ★ {creditScore.ratingLabel} ({creditScore.rating})
                </span>

                <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                  <span>•</span>
                  <span>On-Time Rate: <strong className="text-slate-700 font-semibold">{customer.onTimeRate ? customer.onTimeRate : '90'}%</strong></span>
                  <span>•</span>
                  <span>Payment Terms: <strong className="text-slate-700 font-semibold">{customer.termsDays || 15} Days</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 self-end sm:self-auto">
                <span className="text-[11px] text-slate-500">{isCreditProfileExpanded ? 'Hide Details' : 'View Full Credit Profile'}</span>
                {isCreditProfileExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </div>

            {/* Expandable Details Drawer */}
            {isCreditProfileExpanded && (
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-white space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">Allowable Credit Limit</div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{formatPaiseToRupees(creditLimit)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Configured max counter credit allowance</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">Current Limit Utilization</div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                      {isAdvance ? '0% (Advance Deposit)' : `${creditScore.utilizationPct}%`}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {isAdvance ? 'Surplus funds in account' : `${formatPaiseToRupees(absBalance)} active khata balance`}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">Billing & Khata Invoices</div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{customerInvoices.length} Bills Issued</div>
                    <div className="text-[11px] text-slate-500 mt-1">Double-entry recorded transactions</div>
                  </div>
                </div>

                {/* Risk Drivers Pills */}
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">Algorithm Credit Evaluation Factors:</div>
                  <div className="flex flex-wrap gap-2">
                    {creditScore.drivers.map((driver, idx) => (
                      <span
                        key={idx}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                          driver.type === 'POSITIVE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : driver.type === 'NEUTRAL'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {driver.type === 'POSITIVE' ? '✓ ' : driver.type === 'NEGATIVE' ? '⚠ ' : '• '}
                        {driver.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. BALANCED FINANCIAL OVERVIEW & AGING VISUALIZATION */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3.5">
          {/* 4 Balanced KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold font-mono">Total Billed</div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                {formatPaiseToRupees(totalBilledPaise)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Cumulative Debits</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold font-mono">Total Paid</div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 mt-0.5 tabular-nums">
                {formatPaiseToRupees(totalPaidPaise)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Settled Payments</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold font-mono">Current Balance</div>
              <div className={`text-base sm:text-lg font-bold font-mono mt-0.5 tabular-nums ${isAdvance ? 'text-emerald-700' : isDue ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatPaiseToRupees(absBalance)} {isAdvance ? '(Cr)' : isDue ? '(Dr)' : ''}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{isAdvance ? 'Credit Surplus' : 'Outstanding'}</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold font-mono">Overdue Balance</div>
              <div className={`text-base sm:text-lg font-bold font-mono mt-0.5 tabular-nums ${overduePaise > 0n ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatPaiseToRupees(overduePaise)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{overduePaise > 0n ? `${daysOverdue}d Past Terms` : 'No Overdue Dues'}</div>
            </div>
          </div>

          {/* Aging Buckets: Horizontal Clean Presentation */}
          <div>
            {isAdvance ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Zero Overdue Dues:</strong> Account has an advance credit surplus of{' '}
                    <strong className="font-mono font-bold text-emerald-700">
                      {formatPaiseToRupees(absBalance)} (Cr)
                    </strong>
                    . Aging debt buckets are ₹0.00.
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider font-mono">
                  100% Current Health
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 px-0.5">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 font-mono">Account Debt Aging Analysis</span>
                  <span className="text-[11px] text-slate-500 font-mono">Terms: {customer.termsDays || 15} Days Net</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">0-30 Days (Current)</div>
                    <div className="text-sm font-bold font-mono text-slate-900 mt-1 tabular-nums">
                      {formatPaiseToRupees(currentAging)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">31-60 Days</div>
                    <div className={`text-sm font-bold font-mono mt-1 tabular-nums ${days31to60 > 0n ? 'text-amber-700' : 'text-slate-900'}`}>
                      {formatPaiseToRupees(days31to60)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">61-90 Days</div>
                    <div className={`text-sm font-bold font-mono mt-1 tabular-nums ${days61to90 > 0n ? 'text-amber-800' : 'text-slate-900'}`}>
                      {formatPaiseToRupees(days61to90)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">90+ Days (Critical)</div>
                    <div className={`text-sm font-bold font-mono mt-1 tabular-nums ${days90Plus > 0n ? 'text-rose-700' : 'text-slate-900'}`}>
                      {formatPaiseToRupees(days90Plus)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. LEDGER NAVIGATION TABS */}
      <div className="border-b border-slate-200 flex items-center gap-2 sm:gap-4 text-xs font-medium overflow-x-auto scrollbar-none" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'LEDGER'}
          onClick={() => setActiveTab('LEDGER')}
          className={`py-3 px-3.5 border-b-2 transition cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'LEDGER'
              ? 'border-[#C81E1E] text-[#C81E1E] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <span>Khata Ledger</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${activeTab === 'LEDGER' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            {ledger.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'INVOICES'}
          onClick={() => setActiveTab('INVOICES')}
          className={`py-3 px-3.5 border-b-2 transition cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'INVOICES'
              ? 'border-[#C81E1E] text-[#C81E1E] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <span>Billed Invoices History</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${activeTab === 'INVOICES' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            {customerInvoices.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'REMINDERS'}
          onClick={() => setActiveTab('REMINDERS')}
          className={`py-3 px-3.5 border-b-2 transition cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'REMINDERS'
              ? 'border-[#C81E1E] text-[#C81E1E] font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <span>WhatsApp Payment Reminders</span>
          {isDue && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 font-mono">
              Due
            </span>
          )}
        </button>
      </div>

      {/* 6. TAB 1: KHATA LEDGER TABLE */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-0">
          {/* Table Header Filter Toolbar */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Double-Entry Chronological Ledger
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">({filteredLedger.length} Records)</span>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Type Filter */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
                {(['ALL', 'INVOICE', 'PAYMENT', 'JOURNAL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setLedgerTypeFilter(t);
                      setLedgerPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      ledgerTypeFilter === t
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'ALL' ? 'All' : t === 'INVOICE' ? 'Billed' : t === 'PAYMENT' ? 'Payments' : 'Journals'}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter ref, note, date..."
                  value={ledgerSearch}
                  onChange={(e) => {
                    setLedgerSearch(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-300 w-44 sm:w-56"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 w-28 whitespace-nowrap">Date</th>
                  <th className="py-3 px-3 w-24 whitespace-nowrap">Type</th>
                  <th className="py-3 px-4 w-36 whitespace-nowrap">Reference</th>
                  <th className="py-3 px-4 min-w-[200px]">Narration / Description</th>
                  <th className="py-3 px-4 w-32 text-right whitespace-nowrap">Debit / Billed (₹)</th>
                  <th className="py-3 px-4 w-32 text-right whitespace-nowrap">Credit / Paid (₹)</th>
                  <th className="py-3 px-4 w-36 text-right whitespace-nowrap">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {paginatedLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400 font-sans">
                      {ledgerSearch || ledgerTypeFilter !== 'ALL' ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-600 text-xs">No matching ledger records found</p>
                          <p className="text-[11px] text-slate-400">Try clearing or adjusting your search filter.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="font-semibold text-slate-700 text-xs">No ledger transactions recorded yet</p>
                          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                            Transactions will automatically appear here when sales bills or payments are recorded.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedLedger.map((entry) => {
                    const runBal = BigInt(entry.runningBalancePaise || 0);
                    const isEntryAdvance = runBal < 0n;
                    const absRunBal = isEntryAdvance ? -runBal : runBal;
                    const debitAmt = BigInt(entry.debitPaise || 0);
                    const creditAmt = BigInt(entry.creditPaise || 0);

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition group">
                        {/* Date */}
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {entry.date}
                        </td>

                        {/* Type Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              entry.type === 'INVOICE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : entry.type === 'PAYMENT' || entry.type === 'RECEIPT'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>

                        {/* Reference No with Copy Action */}
                        <td className="py-3 px-4 text-slate-800 font-semibold whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span title={entry.refNo}>{formatRefDisplay(entry.refNo)}</span>
                            {entry.refNo && entry.refNo !== '-' && (
                              <button
                                type="button"
                                onClick={() => handleCopyRef(entry.refNo)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition p-0.5 rounded cursor-pointer"
                                title="Copy reference"
                              >
                                {copiedRefId === entry.refNo ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Description / Narration */}
                        <td className="py-3 px-4 text-slate-600 font-sans text-xs">
                          {entry.narration || '-'}
                        </td>

                        {/* Debit Amount */}
                        <td className="py-3 px-4 text-right font-semibold text-rose-600 tabular-nums whitespace-nowrap">
                          {debitAmt > 0n ? formatPaiseToRupees(debitAmt) : '-'}
                        </td>

                        {/* Credit Amount */}
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                          {creditAmt > 0n ? formatPaiseToRupees(creditAmt) : '-'}
                        </td>

                        {/* Running Balance */}
                        <td className={`py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap ${isEntryAdvance ? 'text-emerald-700' : runBal > 0n ? 'text-rose-700' : 'text-slate-800'}`}>
                          {formatPaiseToRupees(absRunBal)}
                          {isEntryAdvance ? (
                            <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">Cr</span>
                          ) : runBal > 0n ? (
                            <span className="ml-1 text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">Dr</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredLedger.length > 0 && (
            <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={ledgerPageSize}
                  onChange={(e) => {
                    setLedgerPageSize(Number(e.target.value));
                    setLedgerPage(1);
                  }}
                  className="h-7 px-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-hidden"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-400">|</span>
                <span>
                  Showing {Math.min((ledgerPage - 1) * ledgerPageSize + 1, filteredLedger.length)}–
                  {Math.min(ledgerPage * ledgerPageSize, filteredLedger.length)} of {filteredLedger.length} entries
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="px-2 font-mono text-[11px] text-slate-500">
                  {ledgerPage} / {totalLedgerPages}
                </span>
                <button
                  type="button"
                  disabled={ledgerPage >= totalLedgerPages}
                  onClick={() => setLedgerPage((p) => Math.min(totalLedgerPages, p + 1))}
                  className="h-7 px-2.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 2: BILLED INVOICES HISTORY */}
      {activeTab === 'INVOICES' && (
        <div>
          {customerInvoices.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
              <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-3.5 text-slate-400">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Billed Invoices Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                No invoices have been billed for {customer.shopName || customer.name} yet. All POS bills created for this account will appear here with vector print and WhatsApp dispatch.
              </p>
              <Link
                href={`/pos?customerId=${customer.id}`}
                className="inline-flex items-center gap-2 h-8.5 px-4 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-lg shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Sales Bill (F2)</span>
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-0">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                    Sales Bills & Cash Receipts
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">({customerInvoices.length} Bills)</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search bill number or date..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-300 w-52 sm:w-60"
                    />
                  </div>

                  <Link
                    href={`/pos?customerId=${customer.id}`}
                    className="h-8 px-3 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Bill</span>
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-600 border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {filteredInvoices.map((inv: any) => {
                      const total = BigInt(inv.grandTotalPaise || 0);
                      const paid = BigInt(inv.paidNowPaise || 0);
                      const due = BigInt(inv.creditBalancePaise || 0);
                      const isCancelled = inv.status === 'CANCELLED';
                      const isPaid = !isCancelled && due === 0n;
                      const isPartial = !isCancelled && due > 0n && paid > 0n;

                      return (
                        <tr key={inv.id} className={`transition ${isCancelled ? 'bg-rose-50/25 opacity-70' : 'hover:bg-slate-50/80'}`}>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handlePreviewInvoice(inv)}
                              className={`hover:text-[#C81E1E] hover:underline text-left inline-flex items-center gap-1.5 cursor-pointer ${isCancelled ? 'line-through text-slate-500' : ''}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>{inv.invoiceNumber}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{inv.date}</td>
                          <td className="py-3 px-4 text-slate-600 font-sans">{inv.itemsCount || 1} items</td>
                          <td className={`py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {formatPaiseToRupees(total)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                            {formatPaiseToRupees(paid)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600 tabular-nums whitespace-nowrap">
                            {formatPaiseToRupees(due)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isCancelled ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                CANCELLED
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isPartial
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => handlePreviewInvoice(inv)}
                                className="h-7 px-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] rounded border border-slate-300 transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="View Sales Bill"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>View Bill</span>
                              </button>
                              {!isCancelled && (
                                <button
                                  type="button"
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
                                  type="button"
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

      {/* 8. TAB 3: WHATSAPP PAYMENT REMINDERS */}
      {activeTab === 'REMINDERS' && (
        <div>
          {isDue ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left Column: Live WhatsApp Message Simulator */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#25D366]/15 flex items-center justify-center text-[#128C7E]">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Smart Payment Nurture Dispatcher</h3>
                      <p className="text-[11px] text-slate-500">Auto-formatted with khata balance, payment terms, UPI & Bank details</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 self-start sm:self-auto font-mono">
                    {formatPaiseToRupees(absBalance)} Outstanding
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
                          ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Gentle Statement
                    </button>
                    <button
                      type="button"
                      onClick={() => setNurtureStage('DUE')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer text-center ${
                        nurtureStage === 'DUE'
                          ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Due Date Notice
                    </button>
                    <button
                      type="button"
                      onClick={() => setNurtureStage('URGENT')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer text-center ${
                        nurtureStage === 'URGENT'
                          ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Urgent Recovery
                    </button>
                  </div>
                </div>

                {/* WhatsApp Chat Preview Bubble */}
                <div className="bg-[#EFEAE2] p-4 rounded-xl border border-[#D1D7DB] space-y-3 font-sans">
                  <div className="bg-white rounded-lg p-3.5 shadow-xs text-xs text-slate-800 whitespace-pre-line border border-slate-200 leading-relaxed font-sans">
                    {reminderText}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleSendReminderWhatsApp}
                    className="h-8.5 px-4 bg-[#25D366] hover:bg-[#1eb857] text-white font-bold text-xs rounded-lg shadow-2xs transition inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyReminder}
                    className="h-8.5 px-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
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
                    type="button"
                    onClick={() => setIsRazorpayModal(true)}
                    className="h-8.5 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg border border-emerald-300 transition inline-flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant UPI / QR Modal</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Account Summary & Payment Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">Counter Collection Bank Details</h4>
                <div className="space-y-2.5 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold font-mono">Recipient Contact</div>
                    <div className="font-bold text-slate-900 mt-0.5">{customer.shopName || customer.name}</div>
                    <div className="text-slate-600 font-mono text-[11px] mt-0.5">{customer.phone || 'No phone registered'}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold font-mono">Settlement Bank Account</div>
                    <div className="font-bold text-slate-900 mt-0.5">{tenant?.bankDetails?.bankName || 'HDFC Bank'}</div>
                    <div className="text-slate-600 font-mono text-[11px] mt-0.5">A/C: {tenant?.bankDetails?.accountNumber || '50200012345678'}</div>
                    <div className="text-slate-600 font-mono text-[11px]">IFSC: {tenant?.bankDetails?.ifscCode || 'HDFC0001234'}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold font-mono">Default UPI VPA</div>
                    <div className="font-bold text-slate-900 mt-0.5 font-mono">{tenant?.upiId || 'tradeledger@okhdfcbank'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-3.5 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAdvance ? 'Customer Has Advance Credit Balance' : 'Account is 100% Settled'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                {isAdvance
                  ? `This account currently holds ${formatPaiseToRupees(absBalance)} in advance credit. No payment reminders required.`
                  : `There are zero outstanding dues for ${customer.shopName || customer.name}. All invoices and ledger entries are fully paid.`
                }
              </p>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendReminderWhatsApp}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-slate-600" />
                  <span>Send Statement of Account via WhatsApp</span>
                </button>
                <Link
                  href={`/pos?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold text-xs rounded-lg transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Bill (F2)</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9. RECORD PAYMENT MODAL */}
      {isPaymentModal && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Record Customer Payment (Jama Entry)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPaymentModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-slate-600 block mb-1 font-medium">Customer Account</label>
                  <div className="font-semibold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {customer.shopName} ({customer.name})
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-medium">Payment Amount (₹)</label>
                  <input
                    type="text"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] transition"
                    >
                      <option value="UPI">UPI / PhonePe / GPay</option>
                      <option value="CASH">Cash at Counter</option>
                      <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Reference / UTR</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. 40291048291"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModal(false)}
                    className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-300 text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50"
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
