'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  MoreHorizontal
} from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    { labelKey: 'nav.home', fallback: 'Home', href: '/', icon: LayoutDashboard },
    { labelKey: 'nav.bills', fallback: 'Bills', href: '/pos', icon: Receipt },
    { labelKey: 'nav.inventory', fallback: 'Inventory', href: '/inventory', icon: Package },
    { labelKey: 'nav.customers', fallback: 'Customers', href: '/customers', icon: Users },
    { labelKey: 'nav.more', fallback: 'Settlement', href: '/settlement', icon: MoreHorizontal },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E2E8F0] z-40 px-2 py-1 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition ${
              isActive
                ? 'text-[#C81E1E]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-[#C81E1E]' : 'text-slate-400'}`} />
            <span>{t(item.labelKey, item.fallback)}</span>
          </Link>
        );
      })}
    </div>
  );
}
