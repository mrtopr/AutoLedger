'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Lock, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  User,
  Mail,
  CheckCircle2,
  KeyRound,
  RefreshCw
} from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  // Active Login Mode: 'DEALERSHIP' (Business/Staff) or 'CUSTOMER' (Customer Portal)
  const initialTab = searchParams?.get('tab') === 'customer' ? 'CUSTOMER' : 'DEALERSHIP';
  const [loginMode, setLoginMode] = useState<'DEALERSHIP' | 'CUSTOMER'>(initialTab);

  // Email & Password State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot Password Flow States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'REQUEST_OTP' | 'VERIFY_AND_SET'>('REQUEST_OTP');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Status & Error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams?.get('tab') === 'customer') {
      setLoginMode('CUSTOMER');
    }
  }, [searchParams]);

  // Resend OTP countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // ==========================================
  // EMAIL + PASSWORD SUBMIT
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(cleanEmail, password);
      if (res.success) {
        if (loginMode === 'CUSTOMER') {
          router.push('/portal');
        } else {
          router.push('/');
        }
      } else {
        setIsSubmitting(false);
        setError(res.error || 'Invalid credentials. Please check your email and password.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Login failed. Please try again.');
    }
  };

  // ==========================================
  // FORGOT PASSWORD: SEND OTP
  // ==========================================
  const handleSendResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResetSuccess(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/v1/auth/email-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          mode: loginMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetStep('VERIFY_AND_SET');
        setResetSuccess(`Verification code sent to ${cleanEmail}`);
        setCountdown(60);
      } else {
        setError(data.error || 'Failed to send verification code. Please check your email.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while requesting verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ==========================================
  // FORGOT PASSWORD: VERIFY OTP & SET PASSWORD
  // ==========================================
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    const cleanOtp = resetOtp.trim();

    if (!cleanOtp || cleanOtp.length < 4) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp,
          newPassword,
          mode: loginMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccess('Password reset successfully! Redirecting...');
        setTimeout(() => {
          if (loginMode === 'CUSTOMER') {
            router.push('/portal');
          } else {
            router.push('/');
          }
        }, 1200);
      } else {
        setError(data.error || 'Failed to reset password. Please check your verification code.');
        setIsResetting(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while resetting password.');
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      {/* Outer Split-Card Container */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#EA580C] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        
        {/* LEFT BRAND PANEL (Clean: Logo Only, No Clutter) */}
        <div className="md:col-span-5 p-8 sm:p-12 flex flex-col justify-center items-center text-center text-white relative">
          <div className="w-56 sm:w-64 flex items-center justify-center drop-shadow-lg">
            <img 
              src="/logo.png" 
              alt="TradeLedger Logo" 
              className="w-full h-auto object-contain" 
            />
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="md:col-span-7 bg-white md:rounded-l-[40px] p-6 sm:p-10 flex flex-col justify-between shadow-xl">
          
          {/* Top Switcher: Business Portal vs Customer Portal */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1 mb-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setResetSuccess(null);
                setLoginMode('DEALERSHIP');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                loginMode === 'DEALERSHIP'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${loginMode === 'DEALERSHIP' ? 'text-[#C81E1E]' : 'text-slate-400'}`} />
              <span>Business Portal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setResetSuccess(null);
                setLoginMode('CUSTOMER');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                loginMode === 'CUSTOMER'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className={`w-3.5 h-3.5 ${loginMode === 'CUSTOMER' ? 'text-[#C81E1E]' : 'text-slate-400'}`} />
              <span>Customer Portal</span>
            </button>
          </div>

          {/* Heading */}
          <div className="mb-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isForgotPassword 
                ? 'Reset Password'
                : loginMode === 'DEALERSHIP' 
                ? 'Sign In to Terminal' 
                : 'Customer Account Login'}
            </h1>
            {isForgotPassword && (
              <p className="text-xs text-slate-500 mt-1">
                {resetStep === 'REQUEST_OTP'
                  ? 'Enter your registered email address to receive a verification code.'
                  : `Enter the code sent to ${resetEmail} and create your new password.`}
              </p>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {resetSuccess && (
            <div className="p-3 my-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{resetSuccess}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* FORGOT PASSWORD FORM FLOW */}
          {/* ======================================================== */}
          {isForgotPassword ? (
            <div className="space-y-4 my-auto pt-1 animate-in fade-in">
              {resetStep === 'REQUEST_OTP' ? (
                /* STEP 1: Enter email to request OTP */
                <form className="space-y-4" onSubmit={handleSendResetOtp}>
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
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setResetSuccess(null);
                        setIsForgotPassword(false);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSendingOtp}
                      className="px-6 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Code</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: Enter OTP + New Password */
                <form className="space-y-3.5" onSubmit={handleResetPasswordSubmit}>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        6-Digit Verification Code *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setResetSuccess(null);
                          setResetStep('REQUEST_OTP');
                        }}
                        className="text-[11px] text-slate-500 hover:text-[#C81E1E] font-medium transition cursor-pointer"
                      >
                        Change email
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        autoFocus
                        maxLength={6}
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs font-mono font-bold tracking-widest text-slate-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      New Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={countdown > 0 || isSendingOtp}
                      onClick={() => handleSendResetOtp()}
                      className="text-xs font-medium text-slate-500 hover:text-[#C81E1E] disabled:opacity-50 transition cursor-pointer"
                    >
                      {countdown > 0 ? `Resend code (${countdown}s)` : 'Resend Code'}
                    </button>

                    <button
                      type="submit"
                      disabled={isResetting}
                      className="px-6 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Resetting...</span>
                        </>
                      ) : (
                        <>
                          <span>Reset & Sign In</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setResetSuccess(null);
                        setIsForgotPassword(false);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* ======================================================== */
            /* STANDARD EMAIL + PASSWORD LOGIN FORM */
            /* ======================================================== */
            <form className="space-y-4 my-auto pt-1" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setResetSuccess(null);
                      setResetEmail(email.trim());
                      setResetStep('REQUEST_OTP');
                      setIsForgotPassword(true);
                    }}
                    className="text-xs font-semibold text-[#C81E1E] hover:text-[#991B1B] transition cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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

              <div className="flex items-center justify-between pt-0.5">
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

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
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
                      <span>Signing in...</span>
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
