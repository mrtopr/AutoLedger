'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
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
  Smartphone
} from 'lucide-react';
import { 
  isFirebaseConfigured, 
  loadFirebaseConfig,
  initRecaptcha, 
  sendFirebasePhoneOtp, 
  verifyFirebaseOtpCode 
} from '@/app/lib/firebase';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, refreshAuth } = useAuth();

  // Active Login Mode: 'DEALERSHIP' (Staff/Owner) or 'CUSTOMER' (Garage/Buyer)
  const initialTab = searchParams?.get('tab') === 'customer' ? 'CUSTOMER' : 'DEALERSHIP';
  const [loginMode, setLoginMode] = useState<'DEALERSHIP' | 'CUSTOMER'>(initialTab);

  // Dealership Auth Type: 'PASSWORD' or 'OTP'
  const [dealershipAuthType, setDealershipAuthType] = useState<'PASSWORD' | 'OTP'>('PASSWORD');

  // Dealership Password Login State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Phone OTP States (Shared for Dealership OTP & Customer OTP)
  const [otpPhone, setOtpPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [otpCode, setOtpCode] = useState('');
  const [otpSentInfo, setOtpSentInfo] = useState<any>(null);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [firebaseActive, setFirebaseActive] = useState<boolean>(false);

  // Common submission & error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recaptchaVerifierRef = useRef<any>(null);

  useEffect(() => {
    if (searchParams?.get('tab') === 'customer') {
      setLoginMode('CUSTOMER');
    }
    loadFirebaseConfig().then((active) => {
      setFirebaseActive(active);
    });
  }, [searchParams]);

  // Clean reCAPTCHA on unmount or tab switch
  const resetOtpFlow = () => {
    setError(null);
    setOtpStep('PHONE');
    setOtpCode('');
    setConfirmationResult(null);
    setDemoOtpHint(null);
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (e) {}
      recaptchaVerifierRef.current = null;
    }
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
  // SEND MOBILE OTP (Firebase or Local Fallback)
  // ==========================================
  const handleSendMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDemoOtpHint(null);

    const clean = otpPhone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const isConfigured = await loadFirebaseConfig();
      if (isConfigured) {
        // --- LIVE FIREBASE PHONE AUTH ---
        let verifier = recaptchaVerifierRef.current;
        if (!verifier) {
          verifier = initRecaptcha('recaptcha-container');
          recaptchaVerifierRef.current = verifier;
        }

        if (!verifier) {
          throw new Error('Could not initialize reCAPTCHA verifier. Please refresh the page.');
        }

        const confirmRes = await sendFirebasePhoneOtp(clean, verifier);
        setConfirmationResult(confirmRes);
        setOtpStep('OTP');
      } else {
        // --- DEMO / FALLBACK OTP ---
        if (loginMode === 'CUSTOMER') {
          const res = await fetch('/api/v1/portal/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: clean }),
          });
          const data = await res.json();
          if (res.ok) {
            setOtpSentInfo(data.customer);
            setDemoOtpHint(data.demoOtp || '1234');
            setOtpStep('OTP');
          } else {
            setError(data.error || 'Failed to send OTP.');
          }
        } else {
          // Dealership Staff OTP demo
          setDemoOtpHint('1234');
          setOtpStep('OTP');
        }
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      // Reset reCAPTCHA on failure so user can retry immediately
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch (e) {}
        recaptchaVerifierRef.current = null;
      }
      if (typeof window !== 'undefined' && (window as any).grecaptcha) {
        try { (window as any).grecaptcha.reset(); } catch (e) {}
      }
      
      const rawMsg = err?.message || err?.code || '';
      let userMsg = 'Error sending OTP. Please verify your phone number.';

      if (rawMsg.includes('auth/operation-not-allowed') || rawMsg.includes('admin-restricted-operation')) {
        userMsg = 'Phone Authentication is disabled in Firebase Console. Go to Firebase Console > Authentication > Sign-in method and enable "Phone".';
      } else if (rawMsg.includes('auth/unauthorized-domain')) {
        userMsg = 'This domain is not authorized in Firebase. Add your domain (e.g. localhost or your vercel.app URL) to Firebase Console > Authentication > Settings > Authorized domains.';
      } else if (rawMsg.includes('auth/quota-exceeded')) {
        userMsg = 'Firebase SMS daily quota exceeded. Please add a test phone number (e.g. +91 7488542781 with OTP 123456) in Firebase Console > Authentication > Sign-in method > Phone numbers for testing.';
      } else if (rawMsg.includes('auth/invalid-phone-number')) {
        userMsg = 'Invalid phone number format. Please enter a valid 10-digit Indian mobile number.';
      } else if (rawMsg.includes('auth/too-many-requests')) {
        userMsg = 'Too many OTP requests. Please wait a few minutes before trying again or use a test phone number.';
      } else if (rawMsg.includes('auth/captcha-check-failed')) {
        userMsg = 'reCAPTCHA verification failed. Please refresh the page and try again.';
      } else if (err?.message) {
        userMsg = err.message;
      }

      setError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // VERIFY MOBILE OTP
  // ==========================================
  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = otpPhone.replace(/[^0-9]/g, '').slice(-10);
    if (!otpCode.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isFirebaseConfigured() && confirmationResult) {
        // --- 1. Verify code with Firebase ---
        const { idToken } = await verifyFirebaseOtpCode(confirmationResult, otpCode);

        // --- 2. Send Firebase ID token to backend for session cookie creation ---
        const res = await fetch('/api/v1/auth/firebase-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            phone: clean,
            mode: loginMode,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Authentication failed.');
          return;
        }

        if (loginMode === 'CUSTOMER') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('autoledger_customer_token', data.token);
            localStorage.setItem('autoledger_customer_phone', clean);
          }
          router.push('/portal');
        } else {
          await refreshAuth();
          router.push('/');
        }
      } else {
        // --- Fallback / Demo OTP Verification ---
        if (loginMode === 'CUSTOMER') {
          const res = await fetch('/api/v1/portal/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: clean, otp: otpCode.trim() }),
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
        } else {
          // Staff demo verify
          if (otpCode.trim() === '1234') {
            // Log in as default owner
            const res = await login(clean, 'admin123');
            if (res.success) {
              router.push('/');
            } else {
              setError('Could not authenticate demo staff member. Please use password login.');
            }
          } else {
            setError('Invalid OTP code. Please enter 1234.');
          }
        }
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      const rawMsg = err?.message || err?.code || '';
      let userMsg = 'Error verifying OTP code. Please try again.';

      if (rawMsg.includes('auth/invalid-verification-code')) {
        userMsg = 'Incorrect OTP code entered. Please check the code and try again.';
      } else if (rawMsg.includes('auth/code-expired')) {
        userMsg = 'OTP code has expired. Please go back and request a fresh OTP.';
      } else if (rawMsg.includes('auth/session-expired')) {
        userMsg = 'Verification session expired. Please request a new OTP.';
      } else if (err?.message) {
        userMsg = err.message;
      }

      setError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      
      {/* Invisible Firebase reCAPTCHA container */}
      <div id="recaptcha-container"></div>

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
              <span>Firebase Verified</span>
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
                : 'Log in with your registered mobile phone to view your balance and bills.'}
            </p>
          </div>

          {/* Sub-mode toggle for Dealership (Password vs OTP) */}
          {loginMode === 'DEALERSHIP' && (
            <div className="flex items-center gap-2 pt-1 pb-1">
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
                  setDealershipAuthType('OTP');
                  resetOtpFlow();
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  dealershipAuthType === 'OTP'
                    ? 'bg-[#B91C1C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile OTP (Firebase)</span>
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
                    autoComplete="username"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="e.g. 9822012345 or owner@business.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password or Terminal PIN *
                </label>
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
          {/* MOBILE OTP FLOW (Used by Dealership OTP & Customer Portal) */}
          {/* ======================================================== */}
          {((loginMode === 'DEALERSHIP' && dealershipAuthType === 'OTP') || loginMode === 'CUSTOMER') && (
            <div className="my-auto pt-2 space-y-4">
              
              {otpStep === 'PHONE' ? (
                <form onSubmit={handleSendMobileOtp} className="space-y-4">
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
                        value={otpPhone}
                        onChange={(e) => setOtpPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Enter 10-digit mobile (e.g. 9822100001)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 py-2.5 text-xs font-mono font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>
                        {firebaseActive 
                          ? 'Firebase SMS OTP will be sent to your number.'
                          : 'Enter your 10-digit mobile number for instant verification.'}
                      </span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {firebaseActive ? 'Google reCAPTCHA Protected' : 'Fast Demo Mode Active'}
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting || otpPhone.length < 10}
                      className="px-7 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Send OTP Code</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyMobileOtp} className="space-y-4">
                  {/* Customer or Account Badge */}
                  {otpSentInfo && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-emerald-900">{otpSentInfo.shopName}</div>
                        <div className="text-[11px] text-emerald-700">{otpSentInfo.dealership}</div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 font-semibold">+91 {otpPhone}</span>
                    </div>
                  )}

                  {demoOtpHint && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between font-mono">
                      <span>Demo Verification Code:</span>
                      <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-300 tracking-wider">
                        {demoOtpHint}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Enter Verification Code (OTP) *
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
                        placeholder={confirmationResult ? "6-digit OTP from SMS" : "1234"}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-base font-mono font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition text-center"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                      Sent to +91 {otpPhone}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={resetOtpFlow}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      ← Change Phone
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || !otpCode}
                      className="px-7 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
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
