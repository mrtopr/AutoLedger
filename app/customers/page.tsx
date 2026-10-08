'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/app/context/LanguageContext';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert,
  X,
  Store,
  User,
  FileText,
  Zap,
  Receipt,
  ArrowUpRight,
  CreditCard,
  Edit3,
  Trash2,
  MoreVertical,
  BookOpen
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import RazorpayModal from '@/app/components/RazorpayModal';
import ClientPortal from '@/app/components/ClientPortal';
import EditCustomerModal from '@/app/components/EditCustomerModal';
import BulkOpeningBalanceModal from '@/app/components/BulkOpeningBalanceModal';

interface CustomerItem {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  address: string;
  gstin: string | null;
  customerType: string;
  balancePaise: string;
  creditLimitPaise: string;
  status: string;
  termsDays: number;
  overduePaise: string;
}

export default function CustomersPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);

  // Bulk Opening Balance Modal
  const [isBulkOpeningModalOpen, setIsBulkOpeningModalOpen] = useState(false);

  // Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Razorpay Payment Link Modal
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<CustomerItem | null>(null);

  // Row Action Menu Dropdown State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-action-menu')) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const [newCustomer, setNewCustomer] = useState({
    shopName: '',
    name: '',
    phone: '',
    address: '',
    gstin: '',
    creditLimitRupees: '50000',
    paymentTermsDays: '15',
    customerType: 'RETAILER',
    openingBalanceRupees: '',
    openingBalanceType: 'DUE' as 'DUE' | 'ADVANCE',
    openingBalanceNarration: 'Previous register ledger migration',
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);

      const res = await fetch(`/api/v1/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customers) {
          setCustomers(data.customers);
        }
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"? This will remove their record from the active directory.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/customers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchCustomers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete customer');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting customer');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newCustomer.shopName || !newCustomer.phone) {
      setFormError('Shop name and phone number are required');
      return;
    }

    try {
      setSubmitting(true);
      const limitPaise = parseRupeesToPaise(newCustomer.creditLimitRupees || '0');
      const openingPaise = parseRupeesToPaise(newCustomer.openingBalanceRupees || '0');

      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: newCustomer.shopName,
          name: newCustomer.name || newCustomer.shopName,
          phone: newCustomer.phone,
          address: newCustomer.address,
          gstin: newCustomer.gstin || null,
          creditLimitPaise: limitPaise.toString(),
          paymentTermsDays: parseInt(newCustomer.paymentTermsDays, 10) || 15,
          customerType: newCustomer.customerType,
          openingBalancePaise: openingPaise.toString(),
          openingBalanceType: newCustomer.openingBalanceType,
          openingBalanceNarration: newCustomer.openingBalanceNarration || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create customer');
        return;
      }

      setIsAddModalOpen(false);
      setNewCustomer({
        shopName: '',
        name: '',
        phone: '',
        address: '',
        gstin: '',
        creditLimitRupees: '50000',
        paymentTermsDays: '15',
        customerType: 'RETAILER',
        openingBalanceRupees: '',
        openingBalanceType: 'DUE',
        openingBalanceNarration: 'Previous register ledger migration',
      });
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Error creating customer');
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregated Telemetry
  const totalReceivablesPaise = customers.reduce((acc, c) => {
    const b = BigInt(c.balancePaise || 0);
    return b > 0n ? acc + b : acc;
  }, 0n);
  const totalAdvancesPaise = customers.reduce((acc, c) => {
    const b = BigInt(c.balancePaise || 0);
    return b < 0n ? acc + (-b) : acc;
  }, 0n);
  const totalOverduePaise = customers.reduce((acc, c) => acc + BigInt(c.overduePaise || 0), 0n);
  const redCount = customers.filter(c => c.status === 'RED').length;
  const greenCount = customers.filter(c => c.status === 'GREEN').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Action Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#0F172A]">
                Customer Accounts & Credit Directory
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {customers.length} Accounts
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Real-time double-entry credit ledger, payment terms, aging analysis, and settlement dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBulkOpeningModalOpen(true)}
            className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Input all past due / advance balances for multiple customers at once"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Batch Opening Balances</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="h-8 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-semibold rounded-md transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* 4-Stat Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Total Receivables */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              {totalReceivablesPaise > 0n ? 'Total Receivables' : totalAdvancesPaise > 0n ? 'Advance Received' : 'Total Outstanding'}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#DBEAFE]">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className={`text-xl font-bold font-mono tabular-nums ${totalReceivablesPaise > 0n ? 'text-[#0F172A]' : totalAdvancesPaise > 0n ? 'text-[#15803D]' : 'text-[#0F172A]'}`}>
              {totalReceivablesPaise > 0n ? formatPaiseToRupees(totalReceivablesPaise) : totalAdvancesPaise > 0n ? formatPaiseToRupees(totalAdvancesPaise) : '₹0.00'}
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5 truncate">
              {totalReceivablesPaise > 0n 
                ? `Active receivables ${totalAdvancesPaise > 0n ? `(${formatPaiseToRupees(totalAdvancesPaise)} advance)` : ''}`
                : totalAdvancesPaise > 0n
                ? 'Advance credit deposited'
                : 'All accounts settled'}
            </div>
          </div>
        </div>

        {/* Card 2: Overdue Receivables */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#DC2626] uppercase tracking-wider">
              Overdue Receivables
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center border border-[#FEE2E2]">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#DC2626] tabular-nums">
              {formatPaiseToRupees(totalOverduePaise)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              {redCount} accounts in overdue status
            </div>
          </div>
        </div>

        {/* Card 3: Healthy Accounts */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wider">
              Healthy Accounts
            </span>
            <div className="w-7 h-7 rounded-md bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center border border-[#DCFCE7]">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#16A34A] tabular-nums">
              {greenCount}
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              Within credit limit & terms
            </div>
          </div>
        </div>

        {/* Card 4: Total B2B Accounts */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Total B2B Accounts
            </span>
            <div className="w-7 h-7 rounded-md bg-[#F1F5F9] text-[#475569] flex items-center justify-center border border-[#E2E8F0]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#0F172A] tabular-nums">
              {customers.length}
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              Registered business clients
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business name, contact person, or phone..."
            className="w-full h-8 pl-9 pr-3 text-xs bg-[#F8F9FA] border border-[#E2E8F0] rounded-md text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { key: 'ALL', label: 'All Accounts' },
            { key: 'GREEN', label: 'Green (Normal)' },
            { key: 'YELLOW', label: 'Yellow (Warning)' },
            { key: 'RED', label: 'Red (Overdue/Blocked)' },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => setFilterStatus(st.key)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition shrink-0 ${
                filterStatus === st.key 
                  ? 'bg-[#0F172A] text-white shadow-xs' 
                  : 'bg-[#F8F9FA] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* High-Density Customer Registry Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E2E8F0] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-4">Business / Shop Name</th>
                <th className="py-3 px-4">Contact & Phone</th>
                <th className="py-3 px-4">GSTIN / Type</th>
                <th className="py-3 px-4 text-right">Credit Limit (₹)</th>
                <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                <th className="py-3 px-4 text-right">Overdue (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B]">
                    Loading live khata debtor accounts...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                    No customer accounts match criteria. Click "Register Khata" to add one.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const balPaise = BigInt(cust.balancePaise || 0);
                  const limPaise = BigInt(cust.creditLimitPaise || 5000000);
                  const overdue = BigInt(cust.overduePaise || 0);
                  const isCustAdvance = balPaise < 0n;
                  const isCustDue = balPaise > 0n;
                  const absBal = isCustAdvance ? -balPaise : balPaise;
                  const utilizationPct = limPaise > 0n && isCustDue ? Math.min(100, Math.round(Number((balPaise * 100n) / limPaise))) : 0;

                  return (
                    <tr key={cust.id} className="hover:bg-[#F8F9FA] transition">
                      <td className="py-3 px-4">
                        <Link 
                          href={`/customers/${cust.id}`}
                          className="font-semibold text-[#0F172A] hover:text-[#C81E1E] transition flex items-center gap-1 group"
                        >
                          <span>{cust.shopName}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                        <div className="text-[11px] text-[#64748B] truncate max-w-[220px]">{cust.address || 'Address not listed'}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-[#0F172A] font-sans font-medium text-xs">{cust.name}</div>
                        <div className="text-[#64748B] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{cust.phone}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-[11px] text-[#475569]">{cust.gstin || 'URP'}</div>
                        <span className="text-[10px] text-[#64748B] uppercase">
                          {cust.customerType === 'GARAGE' ? 'WORKSHOP' : (cust.customerType || 'RETAILER')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs text-[#64748B] tabular-nums">
                        <div>{formatPaiseToRupees(limPaise)}</div>
                        <span className="text-[10px] text-[#94A3B8]">{cust.termsDays}d terms</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className={`font-bold ${isCustAdvance ? 'text-[#15803D]' : isCustDue ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                          {formatPaiseToRupees(absBal)}
                          {isCustAdvance ? (
                            <span className="ml-1 text-[9px] font-bold text-[#16A34A] bg-[#F0FDF4] px-1 py-0.2 rounded border border-[#BBF7D0]">Cr</span>
                          ) : isCustDue ? (
                            <span className="ml-1 text-[9px] font-bold text-[#DC2626] bg-[#FEF2F2] px-1 py-0.2 rounded border border-[#FECACA]">Dr</span>
                          ) : null}
                        </div>
                        <span className={`text-[10px] ${isCustAdvance ? 'text-[#16A34A] font-semibold' : utilizationPct > 90 ? 'text-[#DC2626] font-semibold' : 'text-[#64748B]'}`}>
                          {isCustAdvance ? 'Advance Credit' : isCustDue ? `${utilizationPct}% limit used` : 'All Settled'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {overdue > 0n ? (
                          <span className="font-bold text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded-full border border-[#FCA5A5]">
                            {formatPaiseToRupees(overdue)}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                          cust.status === 'GREEN' 
                            ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' 
                            : cust.status === 'YELLOW' 
                            ? 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]' 
                            : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            cust.status === 'GREEN' ? 'bg-[#16A34A]' : cust.status === 'YELLOW' ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                          }`} />
                          {cust.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="relative inline-flex items-center gap-1.5 customer-action-menu">
                          {/* 1. Primary Action: Bill */}
                          <Link
                            href={`/pos?customerId=${cust.id}`}
                            className="h-7 px-2.5 bg-[#C81E1E] hover:bg-[#A81818] text-white rounded-md text-[11px] font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                            title="Start POS Bill for this client"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Bill</span>
                          </Link>

                          {/* 2. Secondary Action: Ledger */}
                          <Link
                            href={`/customers/${cust.id}`}
                            className="h-7 px-2.5 bg-white hover:bg-[#F8F9FA] text-[#0F172A] border border-[#CBD5E1] rounded-md text-[11px] font-medium transition inline-flex items-center shadow-2xs"
                            title="View Account Ledger"
                          >
                            <span>Ledger</span>
                          </Link>

                          {/* 3. More Actions Dropdown Toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === cust.id ? null : cust.id);
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded-md border transition cursor-pointer ${
                              activeMenuId === cust.id
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-white hover:bg-[#F8F9FA] text-[#64748B] hover:text-[#0F172A] border-[#CBD5E1]'
                            }`}
                            title="More Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Floating Dropdown Menu */}
                          {activeMenuId === cust.id && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 z-50 w-44 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 text-left animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setEditingCustomer(cust);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8F9FA] flex items-center gap-2 font-medium transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#64748B]" />
                                <span>Edit Profile</span>
                              </button>

                              {balPaise > 0n && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setPaymentModalCustomer(cust);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-[#15803D] hover:bg-[#F0FDF4] flex items-center gap-2 font-medium transition cursor-pointer"
                                >
                                  <Zap className="w-3.5 h-3.5 text-[#16A34A]" />
                                  <span>Send Pay Link / QR</span>
                                </button>
                              )}

                              <div className="my-1 border-t border-[#F1F5F9]" />

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleDeleteCustomer(cust.id, cust.shopName || cust.name);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 font-medium transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                                <span>Delete Customer</span>
                              </button>
                            </div>
                          )}
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

      {/* ----------------- REGISTER CUSTOMER MODAL ----------------- */}
      {isAddModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C81E1E]" />
                  Register Customer / Workshop Khata
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#B91C1C]">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Workshop / Shop Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustomer.shopName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, shopName: e.target.value })}
                      placeholder="e.g. Ramesh Auto Works"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Contact Person / Owner
                    </label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="e.g. Ramesh Jadhav"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Mobile Number <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="9822100001"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={newCustomer.gstin}
                      onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value.toUpperCase() })}
                      placeholder="27AALPJ1122K1Z9"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs font-mono text-[#0F172A] uppercase focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">
                    Shop / Workshop Address
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="e.g. Near Bus Stand, Main Road, Rajauli"
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8F9FA] p-3.5 rounded-xl border border-[#E2E8F0]">
                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Credit Limit (₹)
                    </label>
                    <input
                      type="text"
                      value={newCustomer.creditLimitRupees}
                      onChange={(e) => setNewCustomer({ ...newCustomer, creditLimitRupees: e.target.value })}
                      placeholder="50000"
                      className="w-full h-8.5 px-3 bg-white border border-[#CBD5E1] rounded-xl text-xs font-bold font-mono text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Payment Terms (Days)
                    </label>
                    <input
                      type="number"
                      value={newCustomer.paymentTermsDays}
                      onChange={(e) => setNewCustomer({ ...newCustomer, paymentTermsDays: e.target.value })}
                      className="w-full h-8.5 px-3 bg-white border border-[#CBD5E1] rounded-xl text-xs font-bold text-[#0F172A] focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>
                </div>

                {/* Opening Balance / Previous Udhar Section */}
                <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                      Opening Balance / Previous Udhar (Optional)
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">
                      Sets initial ledger balance
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Balance Type
                      </label>
                      <select
                        value={newCustomer.openingBalanceType}
                        onChange={(e) => setNewCustomer({ ...newCustomer, openingBalanceType: e.target.value as 'DUE' | 'ADVANCE' })}
                        className={`w-full h-8.5 px-2.5 rounded-xl text-xs font-bold border transition ${
                          newCustomer.openingBalanceType === 'DUE'
                            ? 'bg-white text-red-700 border-red-300'
                            : 'bg-white text-emerald-700 border-emerald-300'
                        }`}
                      >
                        <option value="DUE">🔴 Customer Owes (Previous Udhar)</option>
                        <option value="ADVANCE">🟢 Customer Has Advance (Credit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Opening Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newCustomer.openingBalanceRupees}
                        onChange={(e) => setNewCustomer({ ...newCustomer, openingBalanceRupees: e.target.value })}
                        placeholder="0.00"
                        className="w-full h-8.5 px-3 bg-white border border-amber-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:border-[#C81E1E] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={newCustomer.openingBalanceNarration}
                      onChange={(e) => setNewCustomer({ ...newCustomer, openingBalanceNarration: e.target.value })}
                      placeholder="e.g. Previous register ledger migration"
                      className="w-full h-7.5 px-2.5 bg-white/90 border border-amber-200 rounded-lg text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#C81E1E]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 h-8.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#475569] font-medium rounded-xl border border-[#CBD5E1] text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-8.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50"
                  >
                    {submitting ? 'Creating Khata...' : 'Save & Open Khata'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* ----------------- BULK OPENING BALANCE MODAL ----------------- */}
      <BulkOpeningBalanceModal
        isOpen={isBulkOpeningModalOpen}
        onClose={() => setIsBulkOpeningModalOpen(false)}
        onSuccess={fetchCustomers}
        existingCustomers={customers}
      />

      {/* ----------------- RAZORPAY PAYMENT LINK MODAL ----------------- */}
      {paymentModalCustomer && (
        <RazorpayModal
          isOpen={Boolean(paymentModalCustomer)}
          onClose={() => setPaymentModalCustomer(null)}
          customerId={paymentModalCustomer.id}
          customerName={paymentModalCustomer.shopName || paymentModalCustomer.name}
          customerPhone={paymentModalCustomer.phone}
          defaultAmountRupees={(Number(BigInt(paymentModalCustomer.balancePaise || 0)) / 100).toFixed(2)}
          onPaymentSuccess={() => {
            setPaymentModalCustomer(null);
            fetchCustomers();
          }}
        />
      )}

      {/* ----------------- EDIT CUSTOMER MODAL ----------------- */}
      {editingCustomer && (
        <EditCustomerModal
          isOpen={Boolean(editingCustomer)}
          onClose={() => setEditingCustomer(null)}
          customer={editingCustomer}
          onSuccess={() => {
            setEditingCustomer(null);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}
