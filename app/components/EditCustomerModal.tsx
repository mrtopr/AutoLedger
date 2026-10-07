'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Store, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle,
  Clock,
  IndianRupee,
  Save,
  CheckCircle2
} from 'lucide-react';
import { parseRupeesToPaise, formatPaiseToRupees } from '@/server/lib/tax';
import ClientPortal from '@/app/components/ClientPortal';
import ModernLoader from '@/app/components/ModernLoader';
import { useLanguage } from '@/app/context/LanguageContext';

export interface EditableCustomer {
  id: string;
  name: string;
  shopName?: string;
  phone: string;
  address?: string;
  gstin?: string | null;
  customerType?: string;
  balancePaise?: string;
  creditLimitPaise?: string;
  status?: string;
  termsDays?: number;
}

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: EditableCustomer | null;
  onSuccess: (updatedCustomer: any) => void;
}

export default function EditCustomerModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: EditCustomerModalProps) {
  const { language } = useLanguage();

  const [formData, setFormData] = useState({
    shopName: '',
    name: '',
    phone: '',
    address: '',
    gstin: '',
    creditLimitRupees: '50000',
    termsDays: '15',
    status: 'GREEN',
    customerType: 'GARAGE',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      const limitRupees = customer.creditLimitPaise
        ? (Number(BigInt(customer.creditLimitPaise)) / 100).toString()
        : '50000';

      setFormData({
        shopName: customer.shopName || customer.name || '',
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        gstin: customer.gstin || '',
        creditLimitRupees: limitRupees,
        termsDays: String(customer.termsDays ?? 15),
        status: customer.status || 'GREEN',
        customerType: customer.customerType || 'GARAGE',
      });
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shopName.trim() && !formData.name.trim()) {
      setErrorMsg('Please provide a Shop Name or Proprietor Name.');
      return;
    }

    if (!formData.phone.trim()) {
      setErrorMsg('Please provide a valid Mobile Phone Number.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const limitPaise = parseRupeesToPaise(formData.creditLimitRupees || '0');

      const payload = {
        name: formData.name.trim() || formData.shopName.trim(),
        shopName: formData.shopName.trim() || formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        gstin: formData.gstin.trim() ? formData.gstin.trim().toUpperCase() : null,
        creditLimitPaise: limitPaise.toString(),
        termsDays: parseInt(formData.termsDays, 10) || 15,
        status: formData.status,
        customerType: formData.customerType,
      };

      const res = await fetch(`/api/v1/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update customer account.');
        return;
      }

      setSuccessMsg('Customer details updated successfully!');
      setTimeout(() => {
        onSuccess(data.customer || { ...customer, ...payload });
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Customer update error:', err);
      setErrorMsg(err.message || 'Error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
        <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative flex flex-col">
          
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-red-50 text-[#C81E1E] flex items-center justify-center border border-red-100 shadow-2xs">
                <Store className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {language === 'hi' ? 'ग्राहक विवरण संपादित करें' : 'Edit Customer Account'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono font-semibold text-slate-600">
                    {customer.shopName || customer.name}
                  </span>
                  {customer.balancePaise && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Bal: {formatPaiseToRupees(BigInt(customer.balancePaise))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 flex-1">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Shop Name & Contact Person */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Store className="w-3 h-3 text-slate-400" />
                  <span>Workshop / Shop Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  placeholder="e.g. Sai Auto Garage"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Proprietor / Contact Name</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Jadhav"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
                />
              </div>
            </div>

            {/* Mobile Number & GSTIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>Mobile (Calling / WhatsApp)</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="9822100001"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span>GSTIN (15 Digits)</span>
                </label>
                <input
                  type="text"
                  value={formData.gstin}
                  maxLength={15}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  placeholder="27AALPJ1122K1Z9"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono font-semibold uppercase text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>Shop Address / Landmark</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Shop No. 4, Opposite Bus Depot, Shivaji Nagar, Pune"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden transition"
              />
            </div>

            {/* Financial Parameters: Credit Limit, Terms, Health */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 space-y-3">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
                <span>Khata & Credit Terms</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="text"
                    value={formData.creditLimitRupees}
                    onChange={(e) => setFormData({ ...formData, creditLimitRupees: e.target.value })}
                    placeholder="50000"
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-mono font-bold text-slate-900 focus:border-[#C81E1E] focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Terms (Days)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.termsDays}
                    onChange={(e) => setFormData({ ...formData, termsDays: e.target.value })}
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-900 focus:border-[#C81E1E] focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-400" />
                    <span>Khata Health</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-8.5 px-2 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:border-[#C81E1E] focus:outline-hidden transition"
                  >
                    <option value="GREEN">🟢 GREEN (Healthy)</option>
                    <option value="YELLOW">🟡 YELLOW (Caution)</option>
                    <option value="RED">🔴 RED (Overdue/Blocked)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                  Customer Segment
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'GARAGE', label: 'Garage' },
                    { id: 'RETAILER', label: 'Retailer' },
                    { id: 'FLEET', label: 'Fleet / Commercial' },
                    { id: 'INDIVIDUAL', label: 'Walk-in / Retail' },
                  ].map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, customerType: seg.id })}
                      className={`h-7.5 px-2 rounded-md text-[11px] font-semibold border transition text-center ${
                        formData.customerType === seg.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {seg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-9 bg-[#C81E1E] hover:bg-[#A81818] text-white font-bold rounded-md text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <ModernLoader size="xs" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Customer Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ClientPortal>
  );
}
