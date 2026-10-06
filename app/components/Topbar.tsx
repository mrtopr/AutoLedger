'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import LanguageToggle from './LanguageToggle';
import { 
  Search, 
  Plus, 
  Bell, 
  ChevronDown, 
  Menu, 
  LogOut,
  SlidersHorizontal,
  UserCheck
} from 'lucide-react';
import { HondaWingIcon } from './HondaLogo';

export default function Topbar({ onToggleMobileMenu }: { onToggleMobileMenu?: () => void }) {
  const { user, tenant, logout } = useAuth();
  const { t } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);

  const userName = user?.name || 'Sachin';
  const userRole = user?.role ? (user.role.charAt(0) + user.role.slice(1).toLowerCase()) : 'Owner';
  const showroomLocation = tenant?.address ? tenant.address.split(',')[0] : 'Bhubaneswar';

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Mobile Menu & Brand */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#C81E1E] flex items-center justify-center text-white">
            <HondaWingIcon className="w-3.5 h-3.5" color="#FFFFFF" />
          </div>
          <span className="font-bold text-slate-900 text-xs">AUTOLEDGER</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="hidden sm:flex items-center flex-1 max-w-md">
        <button
          onClick={openSearch}
          type="button"
          className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition text-left group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />
            <span className="text-slate-500 font-normal">{t('app.search_placeholder', 'Search customer, invoice, part number, vehicle...')}</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            {t('app.ctrl_k', 'Ctrl K')}
          </kbd>
        </button>
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <LanguageToggle className="hidden sm:inline-flex" variant="pill" />
        <LanguageToggle className="sm:hidden" variant="compact" />

        {/* Primary CTA: + New Bill (Honda Crimson) */}
        <Link
          href="/pos"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C81E1E] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-lg shadow-2xs transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('app.new_bill', 'New Bill')}</span>
          <kbd className="hidden md:inline-block text-[10px] font-mono text-white/80 bg-red-900/60 px-1 rounded">N</kbd>
        </Link>

        {/* Notifications */}
        <button 
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg relative transition"
          title={t('app.notifications', 'Notifications')}
        >
          <Bell className="w-4 h-4" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#C81E1E] absolute top-1.5 right-1.5 ring-1 ring-white" />
        </button>

        <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-100 transition"
          >
            <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold text-slate-900">{userName}</div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs text-slate-700 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-bold text-slate-900">{userName}</div>
                <div className="text-[11px] text-slate-500 truncate">{tenant?.name || 'Honda Showroom'}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">GST: {tenant?.gstin || '21AAACA9876Q1Z9'}</div>
              </div>

              {/* Mobile Language Switcher inside dropdown */}
              <div className="px-3 py-2 sm:hidden border-b border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Language / भाषा</span>
                <LanguageToggle variant="compact" />
              </div>

              <Link
                href="/staff"
                onClick={() => setShowDropdown(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 font-medium"
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('app.staff_roles', 'Staff & Roles')}</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setShowDropdown(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('app.dealership_settings', 'Dealership Settings')}</span>
              </Link>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-rose-50 text-rose-600 font-semibold border-t border-slate-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('app.sign_out', 'Sign Out')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
