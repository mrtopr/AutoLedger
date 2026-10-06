'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Phone, 
  Lock, 
  ArrowRight, 
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  ShieldCheck,
  Store
} from 'lucide-react';
import { HondaWingIcon } from '@/app/components/HondaLogo';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginId.trim() || !password) {
      setError('Please enter your registered phone number/email and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(loginId.trim(), password);
    if (res.success) {
      router.push('/');
    } else {
      setIsSubmitting(false);
      setError(res.error || 'Invalid credentials. Please check your phone number and password.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      
      {/* Outer Curved Container */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#EA580C] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
        
        {/* LEFT BRAND SECTION */}
        <div className="md:col-span-5 p-8 sm:p-10 flex flex-col justify-between items-center text-center text-white relative">
          
          <div className="flex flex-col items-center mt-6">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white/10 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl mb-5 p-2 overflow-hidden">
              <img src="/logo.png" alt="AutoLedger ERP Emblem" className="w-full h-full object-contain drop-shadow" />
            </div>

            <h2 className="text-2xl font-black tracking-wide text-white">
              AutoLedger ERP
            </h2>
            <p className="text-xs text-white/90 mt-2 font-medium">
              Honda Dealership & Workshop Management System
            </p>
            
            <p className="text-xs text-white/75 mt-4 leading-relaxed max-w-[260px]">
              Access your cloud inventory, GST billing, customer khata ledger, and point-of-sale terminal.
            </p>
          </div>

          {/* Bottom Switch Pill Button */}
          <div className="mt-8 mb-2 flex flex-col items-center gap-2">
            <span className="text-[11px] text-white/80">Setting up a new dealership?</span>
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-white text-[#C81E1E] hover:bg-slate-50 text-xs font-bold rounded-full shadow-md transition-transform active:scale-95 inline-flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Register Dealership</span>
            </Link>
          </div>
        </div>

        {/* RIGHT FORM SECTION */}
        <div className="md:col-span-7 bg-white md:rounded-l-[48px] p-8 sm:p-12 flex flex-col justify-between shadow-xl">
          
          {/* Top Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Enterprise Dealership Sign In</span>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] text-emerald-700 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>SSL Secure</span>
            </div>
          </div>

          {/* Heading */}
          <div className="my-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sign In to Your Terminal
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter your registered owner, manager, or counter staff credentials.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields - Completely Empty & Production-Ready */}
          <form className="space-y-4 my-auto pt-2" onSubmit={handleSubmit}>
            
            {/* Field 1: Phone Number / Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Phone Number or Email Address *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. 9822012345 or owner@hondadealer.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none focus:ring-1 focus:ring-[#C81E1E] transition"
                />
              </div>
            </div>

            {/* Field 2: Password / PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Password or Terminal PIN *
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password or PIN"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none focus:ring-1 focus:ring-[#C81E1E] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#C81E1E] focus:ring-[#C81E1E]" 
                />
                <span>Remember this terminal</span>
              </label>
            </div>

            {/* Bottom Row: Submit Button */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link 
                href="/signup" 
                className="text-xs font-semibold text-slate-500 hover:text-[#C81E1E] transition"
              >
                Need an account? Register →
              </Link>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
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
