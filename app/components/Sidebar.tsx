'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import LanguageToggle from './LanguageToggle';
import { 
  LayoutDashboard, 
  Receipt, 
  FileText, 
  Users, 
  Boxes, 
  Package, 
  Landmark, 
  BarChart3, 
  UserCheck, 
  Settings, 
  LogOut
} from 'lucide-react';
import { HondaWingIcon } from './HondaLogo';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuth();
  const { t } = useLanguage();

  const showroomName = tenant?.name || 'Bhubaneswar Honda';
  const showroomLocation = tenant?.address ? tenant.address.split(',')[0] : 'Bhubaneswar';
  const userName = user?.name || 'Sachin';
  const userRole = user?.role || 'OWNER';

  const navGroups = [
    {
      titleKey: 'nav.overview',
      fallbackTitle: 'OVERVIEW',
      items: [
        { labelKey: 'nav.dashboard', fallbackLabel: 'Dashboard', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      titleKey: 'nav.operations',
      fallbackTitle: 'OPERATIONS',
      items: [
        { labelKey: 'app.new_bill', fallbackLabel: 'New Bill', href: '/pos', icon: Receipt, shortcut: 'N' },
        { labelKey: 'nav.invoices', fallbackLabel: 'Invoices', href: '/invoices', icon: FileText },
        { labelKey: 'nav.customers_khata', fallbackLabel: 'Customers & Khata', href: '/customers', icon: Users, shortcut: 'C' },
        { labelKey: 'nav.inventory', fallbackLabel: 'Inventory', href: '/inventory', icon: Boxes, shortcut: 'I' },
        { labelKey: 'nav.products', fallbackLabel: 'Products', href: '/products', icon: Package },
      ],
    },
    {
      titleKey: 'nav.finance',
      fallbackTitle: 'FINANCE',
      items: [
        { labelKey: 'nav.finance', fallbackLabel: 'Finance', href: '/finance', icon: Landmark },
        { labelKey: 'nav.reports', fallbackLabel: 'Reports', href: '/reports', icon: BarChart3 },
      ],
    },
    {
      titleKey: 'nav.management',
      fallbackTitle: 'MANAGEMENT',
      items: [
        { labelKey: 'nav.staff', fallbackLabel: 'Staff', href: '/staff', icon: UserCheck },
        { labelKey: 'nav.settings', fallbackLabel: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-[240px] bg-[#090D16] text-slate-300 border-r border-slate-800/80 fixed inset-y-0 left-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center border-b border-slate-800/70 bg-[#060910]">
        <div className="flex items-center gap-2.5 w-full">
          <div className="w-7 h-7 rounded-lg bg-[#C81E1E] flex items-center justify-center shrink-0 shadow-sm">
            <HondaWingIcon className="w-4 h-4" color="#FFFFFF" />
          </div>
          <div className="truncate flex-1">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-white font-bold text-xs tracking-wider">AUTOLEDGER</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
              Honda · {showroomLocation}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Groupings */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4 scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.fallbackTitle} className="space-y-1">
            <div className="px-2.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {t(group.titleKey, group.fallbackTitle)}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === '/' 
                  ? pathname === '/' 
                  : pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/');
                const Icon = item.icon;
                const label = t(item.labelKey, item.fallbackLabel);

                return (
                  <Link
                    key={item.fallbackLabel}
                    href={item.href}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors group ${
                      isActive
                        ? 'bg-[#1E293B] text-white font-semibold border-l-2 border-[#C81E1E]'
                        : 'text-slate-400 hover:bg-[#131B2E] hover:text-slate-200 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#C81E1E]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span className="truncate">{label}</span>
                    </div>

                    {item.shortcut && !isActive && (
                      <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400">
                        {item.shortcut}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Area: System Status, Language Switcher & User Card */}
      <div className="p-3 border-t border-slate-800/70 bg-[#060910] space-y-2">
        {/* Language Switcher in Sidebar */}
        <LanguageToggle variant="sidebar" />

        {/* System Online Status */}
        <div className="px-2.5 py-1.5 rounded-md bg-[#0C1E14] border border-emerald-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-300">{t('app.system_online', 'System Online')}</span>
          </div>
          <span className="text-[10px] text-emerald-500/80">{showroomLocation}</span>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-[#131B2E] transition">
          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-700">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-slate-200 truncate">{userName}</div>
              <div className="text-[10px] text-slate-500 capitalize truncate">
                {userRole.toLowerCase()}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title={t('app.sign_out', 'Log Out')}
            className="p-1 hover:bg-[#1E293B] text-slate-500 hover:text-rose-400 rounded transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
