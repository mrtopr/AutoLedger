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
  Crown,
  Shield,
  Zap,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  Sparkles
} from 'lucide-react';
import { HondaWingIcon } from '@/app/components/HondaLogo';

type RoleTab = 'OWNER' | 'MANAGER' | 'COUNTER_STAFF';

const ROLES_MAP = {
  OWNER: {
    label: 'Owner',
    name: 'Sachin',
    phone: '9822012345',
    icon: Crown,
    scope: 'Full P&L, Staff & GST'
  },
  MANAGER: {
    label: 'Manager',
    name: 'Rakesh',
    phone: '9822054321',
    icon: Shield,
    scope: 'Inventory & Credit Approvals'
  },
  COUNTER_STAFF: {
    label: 'Staff POS',
    name: 'Amit',
    phone: '9822098765',
    icon: Zap,
    scope: 'F2 Fast Billing & UPI QR'
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState<RoleTab>('OWNER');
  const [loginId, setLoginId] = useState('9822012345');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleChange = (role: RoleTab) => {
    setSelectedRole(role);
    setError(null);
    setLoginId(ROLES_MAP[role].phone);
    setPassword('admin123');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await login(loginId, password);
    if (res.success) {
      router.push('/');
    } else {
      setIsSubmitting(false);
      setError(res.error || 'Invalid credentials. Please verify your phone or PIN.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-8">
      
      {/* Outer Curved Container (Matches Reference Layout) */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#EA580C] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        
        {/* LEFT BRAND SECTION */}
        <div className="md:col-span-4 p-8 sm:p-10 flex flex-col justify-between items-center text-center text-white relative">
          
          {/* Top Space / Icon */}
          <div className="flex flex-col items-center mt-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg mb-4">
              <HondaWingIcon className="w-8 h-8" color="#FFFFFF" />
            </div>

            <h2 className="text-2xl font-black tracking-wide text-white">
              Welcome
            </h2>
            <p className="text-xs text-white/80 mt-2 leading-relaxed max-w-[220px]">
              You are seconds away from accessing your Honda dealership terminal & Khata OS.
            </p>
          </div>

          {/* Bottom Switch Pill Button */}
          <div className="mt-8 mb-2">
            <Link
              href="/signup"
              className="px-6 py-2 bg-white text-[#C81E1E] hover:bg-slate-50 text-xs font-bold rounded-full shadow-md transition-transform active:scale-95 inline-block"
            >
              New Setup
            </Link>
          </div>
        </div>

        {/* RIGHT FORM SECTION (Smooth Inward Curve) */}
        <div className="md:col-span-8 bg-white md:rounded-l-[48px] p-6 sm:p-10 flex flex-col justify-between shadow-xl">
          
          {/* Top Bar: Role Switcher */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Bhubaneswar Showroom</span>
            </div>

            {/* Top-Right Toggle Pill (Matches Reference) */}
            <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleRoleChange('OWNER')}
                className={`px-3 py-1 rounded-full text-[11px] transition ${
                  selectedRole === 'OWNER'
                    ? 'bg-[#B91C1C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('MANAGER')}
                className={`px-3 py-1 rounded-full text-[11px] transition ${
                  selectedRole === 'MANAGER'
                    ? 'bg-[#B91C1C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('COUNTER_STAFF')}
                className={`px-3 py-1 rounded-full text-[11px] transition ${
                  selectedRole === 'COUNTER_STAFF'
                    ? 'bg-[#B91C1C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Staff POS
              </button>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center my-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Sign In as {ROLES_MAP[selectedRole].label}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {ROLES_MAP[selectedRole].scope}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-2.5 my-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 2-Column Form Fields (Matches Reference Image) */}
          <form className="space-y-4 my-auto" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Field 1: Phone */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="e.g. 9822012345"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Field 2: Role / Profile Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Operator Name *
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${ROLES_MAP[selectedRole].name} (${ROLES_MAP[selectedRole].label})`}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-semibold cursor-default"
                />
              </div>

              {/* Field 3: Password / PIN */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Password / PIN *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#C81E1E] focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Field 4: Terminal Select */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Assigned Terminal
                </label>
                <select
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium cursor-default"
                >
                  <option>Counter Terminal #01 (Active)</option>
                </select>
              </div>
            </div>

            {/* Quick Demo Selector Chips & Remember */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Demo profiles:</span>
                <button
                  type="button"
                  onClick={() => handleRoleChange('OWNER')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${selectedRole === 'OWNER' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Sachin (Owner)
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('MANAGER')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${selectedRole === 'MANAGER' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Rakesh (Mgr)
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('COUNTER_STAFF')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${selectedRole === 'COUNTER_STAFF' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Amit (POS)
                </button>
              </div>

              <span className="text-[10px] font-mono text-slate-400">
                PIN: admin123
              </span>
            </div>

            {/* Bottom Row: Submit Button (Matches Reference Right-Aligned Pill) */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-[#C81E1E] focus:ring-[#C81E1E]" />
                <span>Remember this terminal</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold rounded-full text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
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
