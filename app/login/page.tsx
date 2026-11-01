'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Lock, 
  ArrowRight, 
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  User,
  Mail
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

  // Status & Error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams?.get('tab') === 'customer') {
      setLoginMode('CUSTOMER');
    }
  }, [searchParams]);

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
              {loginMode === 'DEALERSHIP' ? 'Sign In to Terminal' : 'Customer Account Login'}
            </h1>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Email + Password Form */}
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
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password *
              </label>
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
