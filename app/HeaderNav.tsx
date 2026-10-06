'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  Package, 
  LogOut, 
  LogIn, 
  UserPlus,
  Crown,
  Shield,
  Zap,
  Calculator,
  UserCheck
} from 'lucide-react';

export default function HeaderNav() {
  const pathname = usePathname();
  const { user, tenant, logout, loading } = useAuth();

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isOwner = user?.role === 'OWNER';
  const isManager = user?.role === 'MANAGER';
  const isManagerOrOwner = isOwner || isManager;

  const brandInitial = tenant?.name ? tenant.name.trim().charAt(0).toUpperCase() : 'B';
  const brandName = tenant?.name || 'B2B Digital Khata';
  const brandSubtext = tenant?.address 
    ? `${tenant.address.split(',')[0]}${tenant.gstin ? ` • GST: ${tenant.gstin}` : ''}`
    : tenant?.gstin 
    ? `GST: ${tenant.gstin}` 
    : 'Motorcycle Spares & Wholesale';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden p-0.5 shadow-sm border border-slate-800">
              <img src="/logo.png" alt="AutoLedger Emblem" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base leading-tight tracking-tight flex items-center gap-2">
                {brandName}
                <span className="text-[10px] bg-blue-50 text-blue-700 font-mono font-bold px-1.5 py-0.5 rounded border border-blue-200">
                  B2B KHATA
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {brandSubtext}
              </div>
            </div>
          </Link>

          {/* Navigation links */}
          {!isAuthPage && user && (
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  pathname === '/' 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-slate-500" />
                Dashboard
              </Link>

              <Link
                href="/pos"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
              >
                <Receipt className="w-4 h-4 text-emerald-100" />
                Quick Bill (F2)
              </Link>

              <Link
                href="/customers"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  pathname.startsWith('/customers') 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4 text-slate-500" />
                Customers / Khata
              </Link>

              <Link
                href="/products"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  pathname.startsWith('/products') 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Package className="w-4 h-4 text-slate-500" />
                Parts Catalog
              </Link>

              {/* Owner & Manager Links */}
              {isManagerOrOwner && (
                <>
                  <Link
                    href="/settlement"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                      pathname === '/settlement' 
                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Calculator className="w-4 h-4 text-indigo-500" />
                    EOD Settlement
                  </Link>

                  <Link
                    href="/staff"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                      pathname === '/staff' 
                        ? 'bg-blue-50 text-blue-700 font-semibold' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    Staff Roles
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        {/* Right Side User Badge & Logout / Login */}
        <div className="flex items-center space-x-3">
          {loading ? (
            <div className="w-24 h-8 bg-slate-100 animate-pulse rounded-lg" />
          ) : user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800">
                {user.role === 'OWNER' && <Crown className="w-3.5 h-3.5 text-blue-600" />}
                {user.role === 'MANAGER' && <Shield className="w-3.5 h-3.5 text-indigo-600" />}
                {user.role === 'COUNTER_STAFF' && <Zap className="w-3.5 h-3.5 text-emerald-600" />}
                <span>
                  {user.role === 'OWNER' ? 'Owner' : user.role === 'MANAGER' ? 'Manager' : 'Staff'}: {user.name}
                </span>
              </div>

              <button
                onClick={() => logout()}
                className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Business</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
