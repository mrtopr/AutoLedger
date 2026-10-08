'use client';

import React, { useState } from 'react';
import { 
  X, 
  Store, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  ShieldAlert, 
  IndianRupee, 
  Calendar, 
  CreditCard,
  Building2
} from 'lucide-react';
import ClientPortal from '@/app/components/ClientPortal';
import { parseRupeesToPaise } from '@/server/lib/tax';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCustomer: any) => void;
}

export default function AddCustomerModal({ isOpen, onClose, onSuccess }: AddCustomerModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
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
    openingBalanceNarration: 'Initial account setup opening balance',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.shopName.trim() && !form.name.trim()) {
      setFormError('Please enter a Business / Shop Name or Contact Person Name.');
      return;
    }
    const cleanPhone = form.phone.replace(/[^0-9]/g, '');
    if (!form.phone.trim() || cleanPhone.length < 10) {
      setFormError('Please provide a valid 10-digit mobile phone number.');
      return;
    }

    try {
      setSubmitting(true);
      const creditLimitPaise = parseRupeesToPaise(form.creditLimitRupees || '0');
      const openingBalancePaise = form.openingBalanceRupees ? parseRupeesToPaise(form.openingBalanceRupees) : 0n;

      const payload = {
        shopName: form.shopName.trim() || form.name.trim(),
        name: form.name.trim() || form.shopName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || 'Local Trade Market',
        gstin: form.gstin.trim() ? form.gstin.trim().toUpperCase() : undefined,
        creditLimitPaise: creditLimitPaise.toString(),
        paymentTermsDays: parseInt(form.paymentTermsDays, 10) || 15,
        customerType: form.customerType,
        openingBalancePaise: openingBalancePaise.toString(),
        openingBalanceType: form.openingBalanceType,
        openingBalanceNarration: form.openingBalanceNarration,
        openingBalanceDate: new Date().toISOString().split('T')[0],
      };

      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create customer account');
        return;
      }

      onSuccess(data.customer);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error communicating with server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-[#C81E1E] flex items-center justify-center font-bold border border-red-100 shadow-2xs shrink-0">
                <Store className="w-4.5 h-4.5 text-[#C81E1E]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Add New Customer Account</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Register client, wholesale buyer, or retailer into trade directory</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: IDENTITY & CONTACT */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Business & Contact Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Store className="w-3 h-3 text-slate-400" />
                    <span>Business / Shop Name</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                    placeholder="e.g. Apex Auto Works"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] transition outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Contact Person Name</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] transition outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Mobile Phone Number</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit mobile (e.g. 9822100001)"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] transition outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>GSTIN (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="15-digit GST Number"
                    maxLength={15}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold uppercase text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] transition outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Shop Address / Location</span>
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Plot 14, Commercial Market, Pune"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] transition outline-hidden"
                />
              </div>
            </div>

            {/* SECTION 2: CREDIT POLICY */}
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Credit Terms & Limits</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    value={form.creditLimitRupees}
                    onChange={(e) => setForm({ ...form, creditLimitRupees: e.target.value })}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] transition outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={form.paymentTermsDays}
                    onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] transition outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: OPENING BALANCE / PREVIOUS OUTSTANDING */}
            <div className="p-3.5 bg-amber-50/75 border border-amber-200/90 rounded-xl space-y-2.5">
              <div className="text-[11px] font-bold text-amber-950 flex items-center justify-between">
                <span>Previous Balance / Opening Migration (Optional)</span>
                <span className="text-[10px] font-normal text-amber-800">For onboarding existing ledger</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-amber-900 mb-1 text-[10px]">
                    Balance Type
                  </label>
                  <select
                    value={form.openingBalanceType}
                    onChange={(e) => setForm({ ...form, openingBalanceType: e.target.value as any })}
                    className="w-full h-8.5 px-2.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 outline-hidden focus:border-[#C81E1E] cursor-pointer"
                  >
                    <option value="DUE">Past Due / Receivable (Customer Owes You)</option>
                    <option value="ADVANCE">Advance Payment (Credit Balance)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1 text-[10px]">
                    Opening Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.openingBalanceRupees}
                    onChange={(e) => setForm({ ...form, openingBalanceRupees: e.target.value })}
                    placeholder="0.00"
                    className="w-full h-8.5 px-3 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-hidden focus:border-[#C81E1E]"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-9 bg-[#C81E1E] hover:bg-[#A81818] text-white font-bold rounded-xl text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Creating Account...' : 'Save & Select Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ClientPortal>
  );
}
