'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
  User,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Mail
} from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, refreshAuth } = useAuth();

  // Active Login Mode: 'DEALERSHIP' (Staff/Owner) or 'CUSTOMER' (Garage/Buyer)
  const initialTab = searchParams?.get('tab') === 'customer' ? 'CUSTOMER' : 'DEALERSHIP';
  const [loginMode, setLoginMode] = useState<'DEALERSHIP' | 'CUSTOMER'>(initialTab);

  // Dealership Auth Type: 'PASSWORD' or 'EMAIL_OTP'
  const [dealershipAuthType, setDealershipAuthType] = useState<'PASSWORD' | 'EMAIL_OTP'>('PASSWORD');

  // Dealership Password Login State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Email OTP States (Used by Dealership Email OTP & Customer Portal)
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  // Common submission & error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams?.get('tab') === 'customer') {
      setLoginMode('CUSTOMER');
    }
  }, [searchParams]);

  const resetOtpFlow = () => {
    setError(null);
    setOtpStep('EMAIL');
    setOtpCode('');
    setDemoOtpHint(null);
  };

  // ==========================================
  // DEALERSHIP PASSWORD SUBMIT
  // ==========================================
  const handleDealershipPasswordSubmit = async (e: React.FormEvent) => {
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

  // ==========================================
  // SEND EMAIL OTP (100% Free)
  // ==========================================
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDemoOtpHint(null);

    const clean = otpEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/email-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, mode: loginMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send verification email.');
        return;
      }
      setDemoOtpHint(data.demoOtp || null);
      setOtpStep('OTP');
    } catch (err: any) {
      console.error('Send email OTP error:', err);
      setError(err.message || 'Error sending email verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // VERIFY EMAIL OTP
  // ==========================================
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = otpEmail.trim().toLowerCase();
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clean,
          otp: otpCode.trim(),
          mode: loginMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid verification code.');
        return;
      }

      if (loginMode === 'CUSTOMER') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('autoledger_customer_token', data.token);
          localStorage.setItem('autoledger_customer_phone', data.customer?.phone || clean);
        }
        router.push('/portal');
      } else {
        await refreshAuth();
        router.push('/');
      }
    } catch (err: any) {
      console.error('Verify email OTP error:', err);
      setError(err.message || 'Error verifying code.');
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
            <div className="w-56 sm:w-72 flex items-center justify-center mb-4 drop-shadow-lg">
              <img src="/logo.png" alt="TradeLedger Logo" className="w-full h-auto object-contain" />
            </div>

            <p className="text-xs text-white/90 mt-1.5 font-medium">
              Universal B2B Trade & Billing Platform
            </p>
            
            <p className="text-xs text-white/75 mt-3 leading-relaxed max-w-[260px]">
              {loginMode === 'DEALERSHIP'
                ? 'Access point-of-sale billing, inventory, double-entry ledger, and daily settlements.'
                : 'View your live account balance, billed items, invoices, and 1-click payment settlements.'}
            </p>
          </div>

          {/* Quick Info Pill */}
          <div className="mt-6 mb-2 flex flex-col items-center gap-2">
            <span className="text-[11px] text-white/80">
              {loginMode === 'DEALERSHIP' ? 'Looking for your customer balance?' : 'Are you a business owner or staff?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoginMode(loginMode === 'DEALERSHIP' ? 'CUSTOMER' : 'DEALERSHIP');
                resetOtpFlow();
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
                  <span>Switch to Business Sign In</span>
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
                  resetOtpFlow();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  loginMode === 'DEALERSHIP'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-[#C81E1E]" />
                <span>Business / Staff</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoginMode('CUSTOMER');
                  resetOtpFlow();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  loginMode === 'CUSTOMER'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Customer / Buyer</span>
              </button>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] text-emerald-700 font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Zero-Cost Verified</span>
            </div>
          </div>

          {/* Heading */}
          <div className="my-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {loginMode === 'DEALERSHIP' ? 'Sign In to Terminal' : 'Customer Account Portal'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loginMode === 'DEALERSHIP'
                ? 'Access your wholesale ledger, billing counter, and inventory.'
                : 'Log in with your registered email to view your balance and bills.'}
            </p>
          </div>

          {/* Sub-mode toggle for Dealership */}
          {loginMode === 'DEALERSHIP' && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1">
              <button
                type="button"
                onClick={() => {
                  setDealershipAuthType('PASSWORD');
                  resetOtpFlow();
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                  dealershipAuthType === 'PASSWORD'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Password Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setDealershipAuthType('EMAIL_OTP');
                  resetOtpFlow();
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  dealershipAuthType === 'EMAIL_OTP'
                    ? 'bg-[#B91C1C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email OTP</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* DEALERSHIP TAB: PASSWORD MODE                            */}
          {/* ======================================================== */}
          {loginMode === 'DEALERSHIP' && dealershipAuthType === 'PASSWORD' && (
            <form className="space-y-3.5 my-auto pt-2" onSubmit={handleDealershipPasswordSubmit}>
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
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="e.g. 7488542781 or krsachin7488@gmail.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDealershipAuthType('EMAIL_OTP');
                      resetOtpFlow();
                    }}
                    className="text-[11px] font-semibold text-[#C81E1E] hover:underline"
                  >
                    Forgot? Use Email OTP
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

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

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link 
                  href="/signup" 
                  className="text-xs font-semibold text-slate-500 hover:text-[#C81E1E] transition"
                >
                  Register New Business →
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
          {/* EMAIL OTP FLOW (Used by Dealership & Customer)            */}
          {/* ======================================================== */}
          {((loginMode === 'DEALERSHIP' && dealershipAuthType === 'EMAIL_OTP') || loginMode === 'CUSTOMER') && (
            <div className="my-auto pt-2 space-y-4">
              {otpStep === 'EMAIL' ? (
                <form onSubmit={handleSendEmailOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Registered Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        autoFocus
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder={loginMode === 'DEALERSHIP' ? 'e.g. krsachin7488@gmail.com' : 'Enter registered email'}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>
                        6-digit verification code will be sent to your email.
                      </span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Zero Carrier Charges
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting || !otpEmail.includes('@')}
                      className={`px-7 py-2.5 disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                        loginMode === 'CUSTOMER' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Email OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                  {demoOtpHint && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between font-mono">
                      <span>Instant Verification Code:</span>
                      <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-300 tracking-wider">
                        {demoOtpHint}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Enter 6-Digit Verification Code *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder={demoOtpHint || "123456"}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition text-center"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                      Sent to {otpEmail}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={resetOtpFlow}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      ← Change Email
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || !otpCode}
                      className={`px-7 py-2.5 disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                        loginMode === 'CUSTOMER' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify & Sign In</span>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] animate-pulse" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
