'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  X,
  Eye,
  FileText,
  User,
  Phone,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { useAuth } from '@/app/context/AuthContext';
import ClientPortal from './ClientPortal';
import InvoicePreviewModal, { InvoicePreviewData } from './InvoicePreviewModal';
import { formatPaiseToRupees } from '@/server/lib/tax';

interface CommandItem {
  id: string;
  title: string;
  category: 'Actions' | 'Navigation' | 'Customers' | 'Parts' | 'Language';
  shortcut?: string;
  icon: React.ElementType;
  action: () => void;
}

export default function CommandPalette() {
  const { language, toggleLanguage, t } = useLanguage();
  const { tenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Live searchable data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Quick Invoice Preview Modal inside Search
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState<InvoicePreviewData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Fetch live store data when palette opens
  const fetchLiveSearchData = async () => {
    try {
      setLoadingData(true);
      const [invRes, custRes, prodRes] = await Promise.all([
        fetch('/api/v1/invoices'),
        fetch('/api/v1/customers'),
        fetch('/api/v1/products')
      ]);

      if (invRes.ok) {
        const invJson = await invRes.json();
        if (invJson.invoices) setInvoices(invJson.invoices);
        else if (Array.isArray(invJson)) setInvoices(invJson);
      }

      if (custRes.ok) {
        const custJson = await custRes.json();
        if (custJson.customers) setCustomers(custJson.customers);
        else if (Array.isArray(custJson)) setCustomers(custJson);
      }

      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        if (prodJson.products) setProducts(prodJson.products);
        else if (Array.isArray(prodJson)) setProducts(prodJson);
      }
    } catch (err) {
      console.warn('Failed to load search data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Global Keyboard Shortcuts (Ctrl+K, Cmd+K, '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Toggle Command Palette (Ctrl+K or Cmd+K)
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
      fetchLiveSearchData();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Open full Invoice Preview from search result
  const handleOpenInvoicePreview = (inv: any) => {
    const previewData: InvoicePreviewData = {
      invoiceNumber: inv.invoiceNumber || inv.number || 'INV-001',
      date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
      time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now',
      placeOfSupply: tenant?.stateCode || '27 - Maharashtra',
      customer: {
        id: inv.customerId,
        name: inv.customerName || inv.customer || 'Walk-in Customer',
        shopName: inv.customerShop || inv.customerName || 'Walk-in Customer',
        phone: inv.customerPhone || '',
        address: inv.customerAddress || 'Local Market',
        gstin: inv.customerGstin || null,
      },
      items: inv.items && inv.items.length > 0 ? inv.items.map((it: any) => ({
        name: it.name,
        partNumber: it.partNumber,
        qty: it.qty,
        unit: it.unit || 'pcs',
        ratePaise: it.ratePaise,
        gstRateBp: it.gstRateBp || 1800,
        totalPaise: it.totalPaise,
      })) : [
        {
          name: 'Spare Parts & Services',
          partNumber: 'SPARE-001',
          qty: 1,
          unit: 'pcs',
          ratePaise: inv.grandTotalPaise || inv.amountPaise || '0',
          gstRateBp: 1800,
          totalPaise: inv.grandTotalPaise || inv.amountPaise || '0',
        }
      ],
      taxableValuePaise: inv.taxableValuePaise || inv.grandTotalPaise || inv.amountPaise,
      cgstPaise: inv.cgstPaise || '0',
      sgstPaise: inv.sgstPaise || '0',
      totalTaxPaise: inv.totalTaxPaise || '0',
      grandTotalPaise: inv.grandTotalPaise || inv.amountPaise || '0',
      paidNowPaise: inv.paidNowPaise || '0',
      creditBalancePaise: inv.creditBalancePaise || '0',
      tenant: {
        name: tenant?.name || 'AutoLedger Dealership',
        legalName: tenant?.legalName || 'AutoLedger Spares Pvt Ltd',
        address: tenant?.address || 'Near Main Market, Showroom No. 1',
        gstin: tenant?.gstin || '27ABCDE1234F1Z5',
        phone: tenant?.phone || '+91 9822100001',
        email: tenant?.email || 'billing@autoledger.com',
        stateCode: tenant?.stateCode || '27 - Maharashtra',
        bankName: tenant?.bankDetails?.bankName || 'HDFC Bank',
        accountNumber: tenant?.bankDetails?.accountNumber || '50200012345678',
        ifscCode: tenant?.bankDetails?.ifscCode || 'HDFC0001234',
        upiId: tenant?.upiId || 'autoledger@okhdfcbank',
      }
    };

    setSelectedPreviewInvoice(previewData);
    setIsPreviewModalOpen(true);
  };

  const defaultCommands: CommandItem[] = [
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

  // Dynamic Matching for Invoices, Customers, Products, and Commands
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        matchedInvoices: [],
        matchedCustomers: [],
        matchedProducts: [],
        matchedCommands: defaultCommands,
        totalCount: defaultCommands.length,
      };
    }

    // Clean query to also match raw digits e.g. "3947" in "INV/2026-27/3947"
    const digitQuery = q.replace(/\D/g, '');

    // 1. Matched Invoices (Match invoice number, customer name, phone, digits)
    const matchedInvoices = invoices.filter((inv) => {
      const invNum = (inv.invoiceNumber || inv.number || '').toLowerCase();
      const custName = (inv.customerName || inv.customer || '').toLowerCase();
      const custShop = (inv.customerShop || '').toLowerCase();
      const phone = (inv.customerPhone || '').toLowerCase();

      return (
        invNum.includes(q) ||
        (digitQuery && invNum.includes(digitQuery)) ||
        custName.includes(q) ||
        custShop.includes(q) ||
        phone.includes(q)
      );
    });

    // 2. Matched Customers (Match name, shop, phone, gstin)
    const matchedCustomers = customers.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const shop = (c.shopName || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const gstin = (c.gstin || '').toLowerCase();

      return name.includes(q) || shop.includes(q) || phone.includes(q) || gstin.includes(q);
    });

    // 3. Matched Products (Match name, part number, category)
    const matchedProducts = products.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const partNum = (p.partNumber || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();

      return name.includes(q) || partNum.includes(q) || cat.includes(q);
    });

    // 4. Matched Commands
    const matchedCommands = defaultCommands.filter((cmd) =>
      cmd.title.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
    );

    const totalCount =
      matchedInvoices.length + matchedCustomers.length + matchedProducts.length + matchedCommands.length;

    return {
      matchedInvoices,
      matchedCustomers,
      matchedProducts,
      matchedCommands,
      totalCount,
    };
  }, [query, invoices, customers, products, defaultCommands]);

  const flatList = useMemo(() => {
    const list: Array<{ type: 'INVOICE' | 'CUSTOMER' | 'PRODUCT' | 'COMMAND'; data: any }> = [];

    searchResults.matchedInvoices.forEach((inv) => list.push({ type: 'INVOICE', data: inv }));
    searchResults.matchedCustomers.forEach((c) => list.push({ type: 'CUSTOMER', data: c }));
    searchResults.matchedProducts.forEach((p) => list.push({ type: 'PRODUCT', data: p }));
    searchResults.matchedCommands.forEach((cmd) => list.push({ type: 'COMMAND', data: cmd }));

    return list;
  }, [searchResults]);

  const handleKeyDownInMenu = (e: React.KeyboardEvent) => {
    if (flatList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flatList[selectedIndex];
      if (!selected) return;

      if (selected.type === 'INVOICE') {
        handleOpenInvoicePreview(selected.data);
      } else if (selected.type === 'CUSTOMER') {
        setIsOpen(false);
        router.push(`/customers/${selected.data.id}`);
      } else if (selected.type === 'PRODUCT') {
        setIsOpen(false);
        router.push(`/inventory`);
      } else if (selected.type === 'COMMAND') {
        selected.data.action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
        <div 
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150"
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
              placeholder={language === 'hi' ? 'बिल नंबर (उदा: 3947), ग्राहक, पार्ट्स या कमांड खोजें...' : 'Search by bill/invoice # (e.g. 3947), customer, parts or command...'}
              className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            />
            {query && (
              <button 
                onClick={() => {
                  setQuery('');
                  setSelectedIndex(0);
                }}
                className="p-1 hover:bg-slate-200 rounded-md text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-block text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
              ESC
            </kbd>
          </div>

          {/* Search Results Area */}
          <div className="max-h-96 overflow-y-auto p-2 space-y-3">
            {searchResults.totalCount === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">
                  No bills, customers, or commands found for &ldquo;{query}&rdquo;
                </div>
                <p className="text-[11px] text-slate-400">
                  Try searching by bill number (e.g. 3947), customer name, or phone number.
                </p>
              </div>
            ) : (
              <>
                {/* 1. MATCHED INVOICES & BILLS */}
                {searchResults.matchedInvoices.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-3 h-3 text-blue-600" />
                        <span>Past Invoices & Bills ({searchResults.matchedInvoices.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-400 lowercase">Click to preview & print</span>
                    </div>

                    {searchResults.matchedInvoices.map((inv) => {
                      const grandTotalRs = Number(BigInt(inv.grandTotalPaise || inv.amountPaise || 0)) / 100;
                      const isPaid = BigInt(inv.creditBalancePaise || 0) === 0n;
                      const dateStr = inv.createdAt 
                        ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : 'Recent';

                      return (
                        <div
                          key={inv.id}
                          onClick={() => handleOpenInvoicePreview(inv)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/80 border border-transparent hover:border-blue-200 transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-blue-700">
                                  {inv.invoiceNumber || inv.number}
                                </span>
                                <span className="text-xs font-semibold text-slate-900 truncate">
                                  {inv.customerShop || inv.customerName || 'Walk-in Customer'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>{dateStr}</span>
                                {inv.customerPhone && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono">{inv.customerPhone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="font-mono font-bold text-xs text-slate-900">
                                ₹{grandTotalRs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                              <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isPaid ? 'PAID' : 'DUE ON KHATA'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInvoicePreview(inv);
                              }}
                              className="p-1.5 bg-white group-hover:bg-blue-600 text-slate-500 group-hover:text-white rounded-lg border border-slate-200 group-hover:border-blue-600 shadow-2xs transition"
                              title="Preview & Print"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. MATCHED CUSTOMERS & KHATA */}
                {searchResults.matchedCustomers.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-amber-600" />
                      <span>Customer & Garage Khata ({searchResults.matchedCustomers.length})</span>
                    </div>

                    {searchResults.matchedCustomers.slice(0, 4).map((c) => {
                      const balanceRs = Number(BigInt(c.balancePaise || 0)) / 100;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setIsOpen(false);
                            router.push(`/customers/${c.id}`);
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50/70 border border-transparent hover:border-amber-200 transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900">{c.shopName || c.name}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>{c.name}</span>
                                {c.phone && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono">{c.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-amber-700">
                              ₹{balanceRs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] text-slate-400">Khata Balance</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. MATCHED SPARE PARTS INVENTORY */}
                {searchResults.matchedProducts.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-3 h-3 text-emerald-600" />
                      <span>Inventory & Spare Parts ({searchResults.matchedProducts.length})</span>
                    </div>

                    {searchResults.matchedProducts.slice(0, 4).map((p) => {
                      const mrpRs = Number(BigInt(p.salePricePaise || p.mrpPaise || 0)) / 100;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setIsOpen(false);
                            router.push(`/inventory`);
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                SKU: {p.partNumber || 'N/A'} · {p.category || 'Spares'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-slate-900">
                              ₹{mrpRs.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-emerald-700 font-bold">
                              {p.stockQty || 0} {p.unit || 'pcs'} in stock
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. ACTIONS & NAVIGATION COMMANDS */}
                {searchResults.matchedCommands.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Actions & Navigation
                    </div>

                    {searchResults.matchedCommands.map((cmd) => {
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition text-left"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate">{cmd.title}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {cmd.shortcut && (
                              <kbd className="text-[10px] font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                                {cmd.shortcut}
                              </kbd>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span><kbd className="font-mono bg-white border px-1 rounded shadow-2xs">↑</kbd> <kbd className="font-mono bg-white border px-1 rounded shadow-2xs">↓</kbd> to navigate</span>
              <span><kbd className="font-mono bg-white border px-1 rounded shadow-2xs">↵</kbd> to open</span>
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Universal Dealership Search
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Direct Invoice Preview & Print Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={selectedPreviewInvoice}
      />
    </ClientPortal>
  );
}
