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
  LogOut,
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuth();
  const { t } = useLanguage();

  const showroomName = tenant?.name || 'Apex Trade & Wholesale';
  const showroomLocation = tenant?.address ? tenant.address.split(',')[0] : 'Main Trade Hub';
  const userName = user?.name || user?.phone || 'Operator';
  const userRole = user?.role || 'STAFF';

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
        { labelKey: 'app.new_bill', fallbackLabel: 'POS Billing', href: '/pos', icon: Receipt, shortcut: 'N' },
        { labelKey: 'nav.invoices', fallbackLabel: 'Invoices', href: '/invoices', icon: FileText },
        { labelKey: 'nav.customers_khata', fallbackLabel: 'Customer Directory', href: '/customers', icon: Users, shortcut: 'C' },
        { labelKey: 'nav.inventory', fallbackLabel: 'Inventory & Stock', href: '/inventory', icon: Boxes, shortcut: 'I' },
      ],
    },
    {
      titleKey: 'nav.finance',
      fallbackTitle: 'FINANCE & AUDIT',
      items: [
        { labelKey: 'nav.settlement', fallbackLabel: 'Day-End Settlement', href: '/settlement', icon: Landmark },
        { labelKey: 'nav.reports', fallbackLabel: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
        { labelKey: 'nav.tally', fallbackLabel: 'Tally XML Export', href: '/tally', icon: FileSpreadsheet },
      ],
    },
    {
      titleKey: 'nav.management',
      fallbackTitle: 'ADMINISTRATION',
      items: [
        { labelKey: 'nav.staff', fallbackLabel: 'Staff & Roles', href: '/staff', icon: UserCheck },
        { labelKey: 'nav.settings', fallbackLabel: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-[240px] bg-white text-slate-700 border-r border-[#E2E8F0] fixed inset-y-0 left-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#E2E8F0] bg-white">
        <Link href="/" className="flex items-center min-w-0 group h-full py-2.5">
          <img src="/logo.png" alt="TradeLeger Logo" className="h-full w-auto object-contain shrink-0 max-h-[36px]" />
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3.5">
        {navGroups.map((group) => (
          <div key={group.fallbackTitle} className="space-y-1">
            <div className="px-2 text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">
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
                    data-tour={`nav-${item.href.replace('/', '') || 'dashboard'}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group ${
                      isActive
                        ? 'bg-red-50 text-[#C81E1E] font-semibold border border-red-200/80'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#C81E1E]' : 'text-slate-400 group-hover:text-slate-600'
                      }`} />
                      <span className="truncate">{label}</span>
                    </div>

                    {item.shortcut && !isActive && (
                      <kbd className="text-[10px] font-mono text-slate-400 group-hover:text-slate-600 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 shrink-0 ml-1">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Area */}
      <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/50 space-y-2">
        {/* Language Switcher */}
        <LanguageToggle variant="sidebar" />

        {/* Dual-Engine System Status */}
        <div className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-between text-[11px] shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span>Dual-Engine Cloud</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Sync Active</span>
        </div>

        {/* Operator Profile */}
        <div className="flex items-center justify-between pt-1">
          <div className="truncate text-xs">
            <div className="font-semibold text-slate-900 truncate">{userName}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{userRole}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
