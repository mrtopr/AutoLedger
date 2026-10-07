'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Store,
  User,
  KeyRound,
  CheckCircle2,
  Receipt,
  Sparkles,
  Zap
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  // Active Login Mode: 'DEALERSHIP' (Staff/Owner) or 'CUSTOMER' (Garage/Buyer)
  const initialTab = searchParams?.get('tab') === 'customer' ? 'CUSTOMER' : 'DEALERSHIP';
  const [loginMode, setLoginMode] = useState<'DEALERSHIP' | 'CUSTOMER'>(initialTab);

  // Dealership Login State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Customer OTP Login State
  const [customerPhone, setCustomerPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [customerOtp, setCustomerOtp] = useState('');
  const [otpSentCustomer, setOtpSentCustomer] = useState<any>(null);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  // Common submission & error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams?.get('tab') === 'customer') {
      setLoginMode('CUSTOMER');
    }
  }, [searchParams]);

  // Handle Dealership Staff / Owner Login
  const handleDealershipSubmit = async (e: React.FormEvent) => {
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

  // Handle Customer Step 1: Send OTP
  const handleCustomerSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDemoOtpHint(null);

    const clean = customerPhone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/v1/portal/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpSentCustomer(data.customer);
        setDemoOtpHint(data.demoOtp || '1234');
        setOtpStep('OTP');
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Customer Step 2: Verify OTP
  const handleCustomerVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = customerPhone.replace(/[^0-9]/g, '').slice(-10);
    if (!customerOtp.trim()) {
      setError('Please enter the 4-digit verification code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/v1/portal/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, otp: customerOtp.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('autoledger_customer_token', data.token);
          localStorage.setItem('autoledger_customer_phone', clean);
        }
        router.push('/portal');
      } else {
        setError(data.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      setError(err.message || 'Error verifying OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      
      {/* Outer Container */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#EA580C] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
        
        {/* LEFT BRAND SECTION */}
        <div className="md:col-span-5 p-8 sm:p-10 flex flex-col justify-between items-center text-center text-white relative">
          
          <div className="flex flex-col items-center mt-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl mb-4 p-2 overflow-hidden">
              <img src="/logo.png" alt="AutoLedger ERP Emblem" className="w-full h-full object-contain drop-shadow" />
            </div>

            <h2 className="text-2xl font-black tracking-wide text-white">
              AutoLedger ERP
            </h2>
            <p className="text-xs text-white/90 mt-1.5 font-medium">
              Dealership DMS & Customer Khata Network
            </p>
            
            <p className="text-xs text-white/75 mt-3 leading-relaxed max-w-[260px]">
              {loginMode === 'DEALERSHIP'
                ? 'Access point-of-sale billing, inventory, double-entry khata, and daily settlements.'
                : 'View your live garage Khata ledger, billed parts, receipts, and 1-click UPI payments.'}
            </p>
          </div>

          {/* Quick Info Pill */}
          <div className="mt-6 mb-2 flex flex-col items-center gap-2">
            <span className="text-[11px] text-white/80">
              {loginMode === 'DEALERSHIP' ? 'Looking for your customer balance?' : 'Are you a dealership owner or staff?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoginMode(loginMode === 'DEALERSHIP' ? 'CUSTOMER' : 'DEALERSHIP');
                setOtpStep('PHONE');
              }}
              className="px-5 py-2 bg-white text-[#C81E1E] hover:bg-slate-50 text-xs font-bold rounded-full shadow-md transition-transform active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {loginMode === 'DEALERSHIP' ? (
                <>
                  <User className="w-3.5 h-3.5" />
                  <span>Switch to Customer Portal</span>
                </>
              ) : (
                <>
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Switch to Dealership Sign In</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT FORM SECTION */}
        <div className="md:col-span-7 bg-white md:rounded-l-[44px] p-6 sm:p-10 flex flex-col justify-between shadow-xl">
          
          {/* Top Switcher Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoginMode('DEALERSHIP');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  loginMode === 'DEALERSHIP'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-[#C81E1E]" />
                <span>Dealership Staff</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoginMode('CUSTOMER');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  loginMode === 'CUSTOMER'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Customer / Garage</span>
              </button>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] text-emerald-700 font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>SSL Secure</span>
            </div>
          </div>

          {/* Heading */}
          <div className="my-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {loginMode === 'DEALERSHIP' ? 'Sign In to Terminal' : 'Customer Khata Portal'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loginMode === 'DEALERSHIP'
                ? 'Enter your registered owner, manager, or counter staff credentials.'
                : 'Log in with your registered phone number to view your real-time khata and bills.'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: DEALERSHIP STAFF LOGIN FORM                       */}
          {/* ======================================================== */}
          {loginMode === 'DEALERSHIP' && (
            <form className="space-y-3.5 my-auto pt-2" onSubmit={handleDealershipSubmit}>
              
              {/* Field 1: Phone / Email */}
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
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
                    placeholder="Enter account password or PIN"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
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

              {/* Submit */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link 
                  href="/signup" 
                  className="text-xs font-semibold text-slate-500 hover:text-[#C81E1E] transition"
                >
                  Register Dealership →
                </Link>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
          )}

          {/* ======================================================== */}
          {/* TAB 2: CUSTOMER / GARAGE OTP LOGIN FORM                  */}
          {/* ======================================================== */}
          {loginMode === 'CUSTOMER' && (
            <div className="my-auto pt-2 space-y-4">
              
              {otpStep === 'PHONE' ? (
                <form onSubmit={handleCustomerSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Registered Mobile Number *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        autoFocus
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Enter 10-digit mobile (e.g. 7488542781)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 py-2.5 text-xs font-mono font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Must match the mobile number registered in your dealership's Khata database.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Instant OTP verification</span>
                    <button
                      type="submit"
                      disabled={isSubmitting || customerPhone.length < 10}
                      className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Get OTP Code</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCustomerVerifyOtp} className="space-y-4">
                  {/* Verified Garage Badge */}
                  {otpSentCustomer && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-emerald-900">{otpSentCustomer.shopName}</div>
                        <div className="text-[11px] text-emerald-700">{otpSentCustomer.dealership}</div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 font-semibold">+91 {customerPhone}</span>
                    </div>
                  )}

                  {demoOtpHint && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between font-mono">
                      <span>Verification Code sent:</span>
                      <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-300 tracking-wider">
                        {demoOtpHint}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Enter 4-Digit OTP Code *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={4}
                        required
                        autoFocus
                        value={customerOtp}
                        onChange={(e) => setCustomerOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="1234"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 transition text-center"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setOtpStep('PHONE')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      ← Change Phone
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || !customerOtp}
                      className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify & Enter Portal</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
