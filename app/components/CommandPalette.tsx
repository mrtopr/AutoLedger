'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Receipt, 
  UserPlus, 
  Boxes, 
  CreditCard, 
  FileSpreadsheet, 
  Package, 
  Users, 
  BarChart3, 
  Settings, 
  ArrowRight,
  Sparkles,
  Languages,
  X
} from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

interface CommandItem {
  id: string;
  title: string;
  category: 'Actions' | 'Navigation' | 'Customers' | 'Parts' | 'Language';
  shortcut?: string;
  icon: React.ElementType;
  action: () => void;
}

export default function CommandPalette() {
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger single-key shortcuts when typing in an input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Toggle Command Palette (Ctrl+K or Cmd+K or '/')
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        return;
      }

      // Single-key shortcuts when NOT inside text inputs
      if (!isInputFocused && !isOpen) {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          router.push('/pos');
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          router.push('/customers');
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          router.push('/inventory');
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          router.push('/customers');
        } else if (e.key === '/') {
          e.preventDefault();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, router]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const defaultCommands: CommandItem[] = [
    {
      id: 'act-toggle-lang',
      title: language === 'hi' ? 'Switch Language to English (अंग्रेज़ी में बदलें)' : 'हिन्दी में बदलें (Switch to Hindi)',
      category: 'Language',
      shortcut: 'L',
      icon: Languages,
      action: () => {
        toggleLanguage();
        setIsOpen(false);
      },
    },
    {
      id: 'act-new-bill',
      title: language === 'hi' ? 'नया बिल बनाएं (New Bill / Counter POS)' : 'New Bill / Counter POS',
      category: 'Actions',
      shortcut: 'N',
      icon: Receipt,
      action: () => {
        setIsOpen(false);
        router.push('/pos');
      },
    },
    {
      id: 'act-add-customer',
      title: language === 'hi' ? 'नया ग्राहक / खाता जोड़ें (Add New Customer)' : 'Add New Customer / Khata',
      category: 'Actions',
      shortcut: 'C',
      icon: UserPlus,
      action: () => {
        setIsOpen(false);
        router.push('/customers');
      },
    },
    {
      id: 'act-stock-inward',
      title: language === 'hi' ? 'इन्वेंट्री / स्टॉक एंट्री (Inventory & Stock)' : 'Stock Inward / Inventory Entry',
      category: 'Actions',
      shortcut: 'I',
      icon: Boxes,
      action: () => {
        setIsOpen(false);
        router.push('/inventory');
      },
    },
    {
      id: 'act-collect-payment',
      title: language === 'hi' ? 'भुगतान प्राप्त करें (Collect Payment)' : 'Collect Payment / Clear Ledger',
      category: 'Actions',
      shortcut: 'P',
      icon: CreditCard,
      action: () => {
        setIsOpen(false);
        router.push('/customers');
      },
    },
    {
      id: 'act-gst-export',
      title: language === 'hi' ? 'जीएसटी रिपोर्ट डाउनलोड (Export GSTR Reports)' : 'Export GSTR-1 & Reports',
      category: 'Actions',
      icon: FileSpreadsheet,
      action: () => {
        setIsOpen(false);
        router.push('/reports');
      },
    },
    {
      id: 'nav-dashboard',
      title: language === 'hi' ? 'डैशबोर्ड (Dashboard Overview)' : 'Dashboard Overview',
      category: 'Navigation',
      icon: Sparkles,
      action: () => {
        setIsOpen(false);
        router.push('/');
      },
    },
    {
      id: 'nav-invoices',
      title: language === 'hi' ? 'बिल एवं चालान इतिहास (Invoices & Bills)' : 'Invoices & Billing History',
      category: 'Navigation',
      icon: Receipt,
      action: () => {
        setIsOpen(false);
        router.push('/invoices');
      },
    },
    {
      id: 'nav-customers',
      title: language === 'hi' ? 'ग्राहक एवं खाता बही (Customers & Khata)' : 'Customer Directory & Ledgers',
      category: 'Navigation',
      icon: Users,
      action: () => {
        setIsOpen(false);
        router.push('/customers');
      },
    },
    {
      id: 'nav-inventory',
      title: language === 'hi' ? 'स्पेयर पार्ट्स इन्वेंट्री (Parts & Stock)' : 'Parts & Catalog Registry',
      category: 'Navigation',
      icon: Package,
      action: () => {
        setIsOpen(false);
        router.push('/inventory');
      },
    },
    {
      id: 'nav-reports',
      title: language === 'hi' ? 'वित्तीय रिपोर्ट्स (Reports & Analytics)' : 'Financial Reports & Settlement',
      category: 'Navigation',
      icon: BarChart3,
      action: () => {
        setIsOpen(false);
        router.push('/reports');
      },
    },
    {
      id: 'nav-settings',
      title: language === 'hi' ? 'डीलरशिप सेटिंग्स (Dealership Settings)' : 'Dealership Settings & Profile',
      category: 'Navigation',
      icon: Settings,
      action: () => {
        setIsOpen(false);
        router.push('/settings');
      },
    },
  ];

  const filteredCommands = defaultCommands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDownInMenu = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInMenu}
            placeholder={language === 'hi' ? 'कमांड या पेज खोजें... (उदा: नया बिल, ग्राहक, इन्वेंट्री, भाषा)' : 'Type a command or search anything... (e.g. New Bill, Customer, Inventory)'}
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-200 rounded text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[11px] font-mono text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Command Results */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No matching commands or routes found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-colors text-left ${
                    isSelected 
                      ? 'bg-slate-100 text-slate-900 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#DC2626] text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#DC2626]' : 'text-slate-300'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white border px-1 rounded">↑</kbd> <kbd className="font-mono bg-white border px-1 rounded">↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-white border px-1 rounded">↵</kbd> to select</span>
          </div>
          <div>AutoLedger Dealership OS</div>
        </div>
      </div>
    </div>
  );
}
