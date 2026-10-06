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
  FileText
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';

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
  const { t, language } = useLanguage();
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Add Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newCustomer, setNewCustomer] = useState({
    shopName: '',
    name: '',
    phone: '',
    address: '',
    gstin: '',
    creditLimitRupees: '50000',
    paymentTermsDays: '15',
    customerType: 'GARAGE',
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
        customerType: 'GARAGE',
      });
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Error creating customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-800" />
            {t('khata.title', 'Customer Credit Khata Directory')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('khata.subtitle', 'Real-time live ledger balances, payment terms, credit limit controls, and aging tracking.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t('khata.add_customer', '+ Add New Customer')}</span>
          </button>
          <Link
            href="/pos"
            className="px-4 py-2.5 bg-[#C81E1E] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            {t('app.new_bill', 'New Bill')} (N)
          </Link>
        </div>
      </div>

      {/* Filter and Search Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('khata.search_customer', 'Search by shop name, owner, or phone...')}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-800 transition"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'GREEN', 'YELLOW', 'RED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                filterStatus === st 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {st === 'ALL' ? (language === 'hi' ? 'सभी खाते (All)' : 'All Accounts') : st}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Ledger Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {customers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
            {loading ? 'Loading live khata accounts...' : 'No customers found. Click "+ Add New Customer" to register one.'}
          </div>
        ) : (
          customers.map((cust) => {
            const balPaise = BigInt(cust.balancePaise || 0);
            const limPaise = BigInt(cust.creditLimitPaise || 1);
            const utilizationPct = Number((balPaise * 100n) / (limPaise || 1n));
            const overdue = BigInt(cust.overduePaise || 0);

            return (
              <div
                key={cust.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                        cust.status === 'GREEN' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : cust.status === 'YELLOW' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {cust.status} STATUS
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      Terms: {cust.termsDays} days
                    </span>
                  </div>

                  <Link
                    href={`/customers/${cust.id}`}
                    className="font-bold text-base text-slate-900 hover:text-blue-600 transition block mt-3"
                  >
                    {cust.shopName}
                  </Link>
                  <div className="text-xs text-slate-600 mt-0.5 font-medium">{cust.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cust.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{cust.address}</span>
                  </div>
                </div>

                {/* Balance Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-600 font-medium">Outstanding Balance:</span>
                    <span className="font-mono-numeric font-bold text-base text-slate-900">
                      {formatPaiseToRupees(balPaise)}
                    </span>
                  </div>

                  {overdue > 0n && (
                    <div className="flex justify-between items-center text-xs text-rose-600 font-mono font-semibold">
                      <span>Overdue Dues:</span>
                      <span>{formatPaiseToRupees(overdue)}</span>
                    </div>
                  )}

                  {/* Utilization bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                      <span>Limit: {formatPaiseToRupees(limPaise)}</span>
                      <span className="font-semibold">{utilizationPct}% Used</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cust.status === 'GREEN' ? 'bg-emerald-500' : cust.status === 'YELLOW' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, utilizationPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/customers/${cust.id}`}
                    className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg text-center border border-slate-300 shadow-sm transition"
                  >
                    View Khata Ledger
                  </Link>
                  <Link
                    href="/pos"
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    title="Bill This Customer"
                  >
                    Bill
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ----------------- ADD CUSTOMER MODAL ----------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Register Customer / Garage Khata
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Garage / Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomer.shopName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, shopName: e.target.value })}
                    placeholder="e.g. Ramesh Auto Works"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="e.g. Ramesh Jadhav"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phone / Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="9822100001"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCustomer.gstin}
                    onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value })}
                    placeholder="27AALPJ1122K1Z9"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono uppercase focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Garage / Shop Address
                </label>
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="e.g. Rasta Peth, Near Apollo Talkies, Pune"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="text"
                    value={newCustomer.creditLimitRupees}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditLimitRupees: e.target.value })}
                    placeholder="50000"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900 font-mono-numeric focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={newCustomer.paymentTermsDays}
                    onChange={(e) => setNewCustomer({ ...newCustomer, paymentTermsDays: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Creating Customer...' : 'Save & Create Khata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
