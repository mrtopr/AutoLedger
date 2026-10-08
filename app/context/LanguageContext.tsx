'use client';

import React, { createContext, useContext } from 'react';

export type Language = 'en';

export interface Translations {
  [key: string]: {
    en: string;
    hi?: string;
  };
}

export const dictionary: Translations = {
  // Brand & General
  'app.name': { en: 'TRADELEDGER' },
  'app.dealership': { en: 'B2B Wholesale & Distribution ERP' },
  'app.system_online': { en: 'System Online' },
  'app.search_placeholder': { en: 'Search customer, invoice, part number, SKU...' },
  'app.new_bill': { en: 'New Bill' },
  'app.notifications': { en: 'Notifications' },
  'app.sign_out': { en: 'Sign Out' },
  'app.staff_roles': { en: 'Staff & Roles' },
  'app.dealership_settings': { en: 'Business Settings' },
  'app.ctrl_k': { en: 'Ctrl K' },

  // Sidebar Nav Groups
  'nav.overview': { en: 'OVERVIEW' },
  'nav.operations': { en: 'OPERATIONS' },
  'nav.finance': { en: 'FINANCE' },
  'nav.management': { en: 'MANAGEMENT' },

  // Nav Items
  'nav.dashboard': { en: 'Dashboard' },
  'nav.invoices': { en: 'Invoices' },
  'nav.customers_khata': { en: 'Customer Directory' },
  'nav.inventory': { en: 'Inventory & Stock' },
  'nav.products': { en: 'Products & SKUs' },
  'nav.reports': { en: 'Reports' },
  'nav.staff': { en: 'Staff & Permissions' },
  'nav.settings': { en: 'Settings' },
  'nav.home': { en: 'Home' },
  'nav.bills': { en: 'Bills' },
  'nav.parts': { en: 'Products' },
  'nav.customers': { en: 'Customer Accounts' },
  'nav.more': { en: 'More' },

  // Dashboard Metrics
  'dash.today_billed_sales': { en: "Today's Billed Sales" },
  'dash.bills_generated': { en: 'bills generated today' },
  'dash.cash_upi_realized': { en: 'Cash & UPI Realized' },
  'dash.cash': { en: 'Cash' },
  'dash.upi': { en: 'UPI' },
  'dash.garage_khata_due': { en: 'Total Receivables Due' },
  'dash.across_workshops': { en: 'Across client accounts' },
  'dash.low_stock_spares': { en: 'Low Stock Products' },
  'dash.parts_below_threshold': { en: 'Below critical reorder threshold' },
  
  // Dashboard Chart
  'dash.trend_title': { en: 'Daily Sales & Cash/UPI Collections Trend' },
};

interface LanguageContextType {
  language: 'en';
  setLanguage: (lang: 'en') => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || dictionary[key]?.en || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const t = (key: string, fallback?: string): string => {
    return fallback || dictionary[key]?.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language: 'en', setLanguage: () => {}, toggleLanguage: () => {}, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en' as const,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: string, fallback?: string) => fallback || dictionary[key]?.en || key,
    };
  }
  return context;
}
