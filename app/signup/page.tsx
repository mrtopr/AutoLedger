'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { Store, User, Phone, Mail, Lock, FileText, MapPin, ArrowRight, AlertCircle, Loader2, ShieldCheck, Building2 } from 'lucide-react';
import { HondaWingIcon } from '@/app/components/HondaLogo';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    gstin: '',
    address: '',
    stateCode: '21', // Default 21 - Odisha / 27 - Maharashtra
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);
    const res = await signup(formData);
    setIsSubmitting(false);

    if (res.success) {
      router.push('/');
    } else {
      setError(res.error || 'Failed to create account. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      
      {/* Outer Curved Container */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#EA580C] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* LEFT BRAND SECTION */}
        <div className="md:col-span-4 p-8 sm:p-10 flex flex-col justify-between items-center text-center text-white relative">
          
          <div className="flex flex-col items-center mt-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl mb-4 text-white font-black text-3xl sm:text-4xl tracking-tighter drop-shadow">
              TL
            </div>

            <h2 className="text-2xl font-black tracking-wide text-white">
              TradeLedger ERP
            </h2>
            <p className="text-xs text-white/90 mt-2 font-medium">
              Universal B2B Trade & Billing Platform
            </p>
            
            <p className="text-xs text-white/75 mt-4 leading-relaxed max-w-[220px]">
              Set up your catalog, client credit limits, GST invoices, and POS billing terminal in minutes.
            </p>
          </div>

          <div className="mt-8 mb-2 flex flex-col items-center gap-2">
            <span className="text-[11px] text-white/80">Already have an account?</span>
            <Link
              href="/login"
              className="px-6 py-2 bg-white text-[#C81E1E] hover:bg-slate-50 text-xs font-bold rounded-full shadow-md transition-transform active:scale-95 inline-block"
            >
              Sign In Instead
            </Link>
          </div>
        </div>

        {/* RIGHT FORM SECTION */}
        <div className="md:col-span-8 bg-white md:rounded-l-[48px] p-6 sm:p-10 flex flex-col justify-between shadow-xl">
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>New Business Registration</span>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] text-emerald-700 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Production Ready</span>
            </div>
          </div>

          <div className="my-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Create Business Account
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in your business details. You can configure inventory, staff & bank QR codes next.
            </p>
          </div>

          {error && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-3 my-auto pt-1" onSubmit={handleSubmit}>
            {/* Row 1: Business Name & Owner Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Business / Company Name *
                </label>
                <div className="relative">
                  <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    placeholder="e.g. Apex Trade & Supplies Pvt Ltd"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Owner / Proprietor Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Primary Mobile Number (Login ID) *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. 9822012345"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@dealership.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Account Master Password / PIN (Min 6 chars) *
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium"
                />
              </div>
            </div>

            {/* Row 4: GSTIN & State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  GSTIN (Optional)
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    placeholder="21ABCDE1234F1Z5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  State of Registration
                </label>
                <select
                  name="stateCode"
                  value={formData.stateCode}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                >
                  <option value="21">21 - Odisha</option>
                  <option value="27">27 - Maharashtra</option>
                  <option value="24">24 - Gujarat</option>
                  <option value="29">29 - Karnataka</option>
                  <option value="07">07 - Delhi</option>
                  <option value="09">09 - Uttar Pradesh</option>
                  <option value="33">33 - Tamil Nadu</option>
                  <option value="19">19 - West Bengal</option>
                  <option value="10">10 - Bihar</option>
                </select>
              </div>
            </div>

            {/* Row 5: Address */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Business / Office / Shop Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. Main Commercial Market, Pune"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition font-medium"
                />
              </div>
            </div>

            {/* Bottom Row */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link 
                href="/login" 
                className="text-xs font-semibold text-slate-500 hover:text-[#C81E1E] transition"
              >
                ← Back to Login
              </Link>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Setup</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
