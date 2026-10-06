'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { 
  Search, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  Edit2, 
  Trash2, 
  Check, 
  AlertCircle,
  Package
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';
import ClientPortal from '@/app/components/ClientPortal';

interface ProductItem {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  category: string;
  hsnCode: string;
  gstRateBp: number;
  unit: string;
  purchasePricePaise: string;
  salePricePaise: string;
  mrpPaise: string;
  stockQty: number;
  reorderLevel: number;
  isLowStock: boolean;
  models: string[];
}

const DEPARTMENTS = [
  'All Departments',
  'Engine & Transmission',
  'Brakes & Friction',
  'Lubricants & Oils',
  'Electrical & Battery',
  'Body & Suspension',
  'Filters & Belts',
  'General Spares',
];

export default function InventoryPage() {
  const { t, language } = useLanguage();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'HEALTHY' | 'OUT'>('ALL');

  // Modals & State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Part Form
  const [newPart, setNewPart] = useState({
    name: '',
    partNumber: '',
    brand: 'Honda Genuine',
    category: 'Engine & Transmission',
    hsnCode: '8714',
    gstRateBp: 1800,
    unit: 'pcs',
    purchasePriceRupees: '',
    salePriceRupees: '',
    mrpRupees: '',
    openingStock: '10',
    reorderLevel: '5',
    models: 'Honda Activa 6G, Shine 125',
  });

  // Edit Part Form
  const [editPart, setEditPart] = useState({
    id: '',
    name: '',
    partNumber: '',
    brand: '',
    category: '',
    unit: 'pcs',
    purchasePriceRupees: '',
    salePriceRupees: '',
    mrpRupees: '',
    reorderLevel: '5',
    models: '',
  });

  // Stock Adjustment Form
  const [adjustData, setAdjustData] = useState({
    mode: 'ADD' as 'ADD' | 'DEDUCT',
    qty: '10',
    reason: 'PURCHASE',
    unitCostRupees: '',
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/products');
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not refresh inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Aggregated KPIs
  const totalValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + BigInt(p.salePricePaise || 0) * BigInt(Math.max(0, p.stockQty || 0)), 0n);
  }, [products]);

  const totalCostValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + BigInt(p.purchasePricePaise || 0) * BigInt(Math.max(0, p.stockQty || 0)), 0n);
  }, [products]);

  const totalUnits = useMemo(() => {
    return products.reduce((sum, p) => sum + Math.max(0, p.stockQty || 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stockQty <= p.reorderLevel).length;
  }, [products]);

  // Filtered Products
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchDept = selectedDept === 'All Departments' || p.category === selectedDept;
      
      let matchStatus = true;
      if (statusFilter === 'LOW') matchStatus = p.stockQty > 0 && p.stockQty <= p.reorderLevel;
      else if (statusFilter === 'OUT') matchStatus = p.stockQty <= 0;
      else if (statusFilter === 'HEALTHY') matchStatus = p.stockQty > p.reorderLevel;

      const q = search.trim().toLowerCase();
      const matchSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.partNumber.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) ||
        (p.models && p.models.some((m) => m.toLowerCase().includes(q)));

      return matchDept && matchStatus && matchSearch;
    });
  }, [products, selectedDept, statusFilter, search]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPart.name || !newPart.salePriceRupees) {
      showToast('error', 'Name and wholesale rate are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPart.name.trim(),
          partNumber: newPart.partNumber.trim(),
          brand: newPart.brand.trim() || 'Honda Genuine',
          category: newPart.category,
          hsnCode: newPart.hsnCode || '8714',
          gstRateBp: Number(newPart.gstRateBp) || 1800,
          unit: newPart.unit || 'pcs',
          purchasePricePaise: parseRupeesToPaise(newPart.purchasePriceRupees || '0'),
          salePricePaise: parseRupeesToPaise(newPart.salePriceRupees),
          mrpPaise: parseRupeesToPaise(newPart.mrpRupees || newPart.salePriceRupees),
          openingStock: parseInt(newPart.openingStock, 10) || 0,
          reorderLevel: parseInt(newPart.reorderLevel, 10) || 5,
          bikeModelIds: newPart.models ? newPart.models.split(',').map((m) => m.trim()).filter(Boolean) : [],
        }),
      });

      if (!res.ok) throw new Error('Failed to create part');
      showToast('success', `Added "${newPart.name}"`);
      setIsAddModalOpen(false);
      setNewPart({
        name: '',
        partNumber: '',
        brand: 'Honda Genuine',
        category: 'Engine & Transmission',
        hsnCode: '8714',
        gstRateBp: 1800,
        unit: 'pcs',
        purchasePriceRupees: '',
        salePriceRupees: '',
        mrpRupees: '',
        openingStock: '10',
        reorderLevel: '5',
        models: 'Honda Activa 6G, Shine 125',
      });
      await loadProducts();
    } catch (err: any) {
      showToast('error', err.message || 'Error adding product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = parseInt(adjustData.qty, 10);
    if (!qty || qty <= 0) return;

    const delta = adjustData.mode === 'ADD' ? qty : -qty;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/products/${selectedProduct.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty: delta,
          reason: adjustData.reason,
          unitCostPaise: adjustData.unitCostRupees ? parseRupeesToPaise(adjustData.unitCostRupees) : 0,
        }),
      });

      if (!res.ok) throw new Error('Stock update failed');
      showToast('success', `Stock updated: ${selectedProduct.name} (${selectedProduct.stockQty + delta} ${selectedProduct.unit})`);
      setIsAdjustModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      showToast('error', err.message || 'Stock update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPart.id || !editPart.name) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/products/${editPart.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editPart.name.trim(),
          partNumber: editPart.partNumber.trim(),
          brand: editPart.brand.trim(),
          category: editPart.category,
          unit: editPart.unit,
          purchasePricePaise: parseRupeesToPaise(editPart.purchasePriceRupees || '0'),
          salePricePaise: parseRupeesToPaise(editPart.salePriceRupees || '0'),
          mrpPaise: parseRupeesToPaise(editPart.mrpRupees || editPart.salePriceRupees || '0'),
          reorderLevel: parseInt(editPart.reorderLevel, 10) || 5,
          models: editPart.models ? editPart.models.split(',').map((m) => m.trim()).filter(Boolean) : [],
        }),
      });

      if (!res.ok) throw new Error('Edit failed');
      showToast('success', 'Part updated');
      setIsEditModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      showToast('error', err.message || 'Error updating product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/products/${selectedProduct.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('success', 'Part removed from inventory');
      setIsDeleteModalOpen(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (err: any) {
      showToast('error', err.message || 'Delete error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8 text-slate-700">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-3.5 py-2 rounded-lg shadow-md border text-xs font-normal flex items-center gap-2 ${
          toast.type === 'success' 
            ? 'bg-slate-900 text-white border-slate-700' 
            : 'bg-rose-900 text-white border-rose-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header Bar: Minimal, Unweighted */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-base font-medium text-slate-800 tracking-tight flex items-center gap-2">
            {language === 'hi' ? 'इन्वेंट्री एवं पार्ट्स स्टॉक' : 'Inventory & Stock'}
            <span className="text-xs text-slate-400 font-normal">
              ({products.length} {language === 'hi' ? 'पार्ट्स' : 'Items'} · {totalUnits} {language === 'hi' ? 'यूनिट्स' : 'Units'})
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProducts}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition border border-slate-200"
            title={language === 'hi' ? 'ताज़ा करें' : 'Refresh Inventory'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('inv.add_product', '+ Add Product')}</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Strip (Clean, No Heavy Weights) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="text-xs font-normal text-slate-400 uppercase tracking-wider">{language === 'hi' ? 'कुल स्टॉक मूल्यांकन' : 'Total Valuation'}</div>
          <div className="text-lg sm:text-xl font-medium text-slate-800 font-mono-numeric mt-1">
            {formatPaiseToRupees(totalValuation)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{language === 'hi' ? 'लागत मूल्य:' : 'Cost Basis:'} {formatPaiseToRupees(totalCostValuation)}</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="text-xs font-normal text-slate-400 uppercase tracking-wider">{language === 'hi' ? 'कुल पार्ट्स (SKUs)' : 'Total SKUs'}</div>
          <div className="text-lg sm:text-xl font-medium text-slate-800 font-mono-numeric mt-1">
            {products.length} <span className="text-xs text-slate-400 font-normal">{language === 'hi' ? 'पार्ट्स' : 'Parts'}</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{totalUnits} {language === 'hi' ? 'यूनिट्स उपलब्ध' : 'units on shelf'}</div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`cursor-pointer border rounded-xl p-3.5 shadow-2xs transition ${
            statusFilter === 'LOW' 
              ? 'bg-amber-50/40 border-amber-300' 
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-slate-400 uppercase tracking-wider">{t('dash.low_stock_spares', 'Low Stock Items')}</span>
            {lowStockCount > 0 && (
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {language === 'hi' ? 'रीऑर्डर आवश्यक' : 'Action Required'}
              </span>
            )}
          </div>
          <div className="text-lg sm:text-xl font-medium text-slate-800 font-mono-numeric mt-1">
            {lowStockCount} <span className="text-xs text-slate-400 font-normal">{language === 'hi' ? 'पार्ट्स' : 'Parts'}</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{language === 'hi' ? 'न्यूनतम सीमा से कम स्टॉक' : 'Below minimum reorder threshold'}</div>
        </div>
      </div>

      {/* 3. Search & Filter Strip */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inv.search_placeholder', 'Search SKU, part name, model...')}
            className="w-full pl-9 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 text-slate-800 placeholder:text-slate-400 font-normal"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* Department Select */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-normal text-slate-700 focus:outline-none focus:bg-white"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d === 'All Departments' && language === 'hi' ? 'सभी श्रेणियां (All Departments)' : d}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-normal">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs font-medium' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'hi' ? 'सभी' : 'All'} ({products.length})
            </button>
            <button
              onClick={() => setStatusFilter('LOW')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                statusFilter === 'LOW' ? 'bg-white text-amber-700 shadow-2xs font-medium' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{language === 'hi' ? 'कम स्टॉक' : 'Low'}</span>
              {lowStockCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
            <button
              onClick={() => setStatusFilter('HEALTHY')}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === 'HEALTHY' ? 'bg-white text-slate-800 shadow-2xs font-medium' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'hi' ? 'उपलब्ध' : 'In Stock'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Table (Clean, Unweighted, Minimalist) */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-400 font-normal">
                <th className="py-3 px-4 font-medium">{t('inv.sku_part_no', 'Part Name & SKU')}</th>
                <th className="py-3 px-3 font-medium">{t('inv.category', 'Category')}</th>
                <th className="py-3 px-3 text-center font-medium">{t('inv.stock_qty', 'Stock')}</th>
                <th className="py-3 px-3 text-center font-medium">{t('inv.min_stock', 'Min Level')}</th>
                <th className="py-3 px-3 text-right font-medium">{t('inv.selling_price', 'Wholesale Rate')}</th>
                <th className="py-3 px-3 text-center font-medium">{t('invs.status', 'Status')}</th>
                <th className="py-3 px-4 text-right font-medium">{t('inv.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1.5 text-slate-400" />
                    <span>{t('common.loading', 'Loading inventory records...')}</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    {t('common.no_data', 'No spare parts found matching your filter criteria.')}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stockQty <= p.reorderLevel;
                  const isOut = p.stockQty <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      {/* Part Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 text-[13px]">{p.name}</div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="bg-slate-50 px-1 rounded text-slate-500 border border-slate-200/60 font-normal">{p.partNumber || '—'}</span>
                          <span>·</span>
                          <span className="text-slate-500">{p.brand}</span>
                          {p.models && p.models.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-slate-400 truncate max-w-[200px]">
                                {p.models.slice(0, 2).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-slate-600 font-normal text-xs">
                        {p.category || 'General'}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-3 text-center">
                        <span className={`font-mono font-medium text-sm ${
                          isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'
                        }`}>
                          {p.stockQty}
                        </span>
                        <span className="text-xs text-slate-400 ml-1 font-normal">{p.unit}</span>
                      </td>

                      {/* Min Level */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs font-normal">
                        {p.reorderLevel} {p.unit}
                      </td>

                      {/* Wholesale Rate */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-medium text-slate-800 text-xs">
                          {formatPaiseToRupees(BigInt(p.salePricePaise || 0))}
                        </div>
                        {Number(p.purchasePricePaise || 0) > 0 && (
                          <div className="text-[11px] text-slate-400 font-mono font-normal">
                            Cost: {formatPaiseToRupees(BigInt(p.purchasePricePaise))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal ${
                          isOut 
                            ? 'bg-rose-50 text-rose-700' 
                            : isLow 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          {isOut 
                            ? (language === 'hi' ? 'खत्म (Out)' : 'Out of Stock') 
                            : isLow 
                            ? (language === 'hi' ? 'कम स्टॉक' : 'Low Stock') 
                            : (language === 'hi' ? 'उपलब्ध' : 'In Stock')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setAdjustData({
                                mode: 'ADD',
                                qty: '10',
                                reason: 'PURCHASE',
                                unitCostRupees: (Number(p.purchasePricePaise || 0) / 100).toString(),
                              });
                              setIsAdjustModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-md transition"
                          >
                            {language === 'hi' ? '+ स्टॉक' : '+ Stock'}
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setEditPart({
                                id: p.id,
                                name: p.name,
                                partNumber: p.partNumber,
                                brand: p.brand,
                                category: p.category,
                                unit: p.unit || 'pcs',
                                purchasePriceRupees: (Number(p.purchasePricePaise || 0) / 100).toString(),
                                salePriceRupees: (Number(p.salePricePaise || 0) / 100).toString(),
                                mrpRupees: (Number(p.mrpPaise || 0) / 100).toString(),
                                reorderLevel: p.reorderLevel.toString(),
                                models: p.models ? p.models.join(', ') : '',
                              });
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                            title="Edit Part"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Delete Part"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ADD PART */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden text-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-900">Add New Spare Part</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="p-5 space-y-3.5">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Part Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Front Disc Brake Pad Set"
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">OEM / Part No.</label>
                  <input
                    type="text"
                    placeholder="e.g. BP-PULSAR-02"
                    value={newPart.partNumber}
                    onChange={(e) => setNewPart({ ...newPart, partNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Honda Genuine, Castrol"
                    value={newPart.brand}
                    onChange={(e) => setNewPart({ ...newPart, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={newPart.category}
                    onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-normal"
                  >
                    {DEPARTMENTS.filter((d) => d !== 'All Departments').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit</label>
                  <select
                    value={newPart.unit}
                    onChange={(e) => setNewPart({ ...newPart, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-normal"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="set">Set (set)</option>
                    <option value="ltr">Litres (ltr)</option>
                    <option value="box">Box (box)</option>
                    <option value="can">Can (can)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Wholesale Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newPart.salePriceRupees}
                    onChange={(e) => setNewPart({ ...newPart, salePriceRupees: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newPart.purchasePriceRupees}
                    onChange={(e) => setNewPart({ ...newPart, purchasePriceRupees: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newPart.openingStock}
                    onChange={(e) => setNewPart({ ...newPart, openingStock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={newPart.reorderLevel}
                    onChange={(e) => setNewPart({ ...newPart, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Compatible Bike Models</label>
                <input
                  type="text"
                  placeholder="e.g. Honda Activa 6G, Shine 125, Pulsar 150"
                  value={newPart.models}
                  onChange={(e) => setNewPart({ ...newPart, models: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-normal"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-2xs"
                >
                  {submitting ? 'Saving...' : 'Save Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      )}

      {/* ========================================================= */}
      {/* MODAL: STOCK ADJUSTMENT (+ / -) */}
      {/* ========================================================= */}
      {isAdjustModalOpen && selectedProduct && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden text-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Adjust Stock</h3>
                <p className="text-xs text-slate-500 truncate max-w-[220px] font-normal">{selectedProduct.name}</p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-5 space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-600 font-normal">Current Stock</span>
                <span className="font-mono font-medium text-slate-900 text-sm">
                  {selectedProduct.stockQty} {selectedProduct.unit}
                </span>
              </div>

              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-normal">
                <button
                  type="button"
                  onClick={() => setAdjustData({ ...adjustData, mode: 'ADD', reason: 'PURCHASE' })}
                  className={`py-1.5 rounded-md transition ${
                    adjustData.mode === 'ADD' ? 'bg-white text-emerald-700 shadow-2xs font-medium' : 'text-slate-500'
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustData({ ...adjustData, mode: 'DEDUCT', reason: 'ADJUSTMENT' })}
                  className={`py-1.5 rounded-md transition ${
                    adjustData.mode === 'DEDUCT' ? 'bg-white text-amber-700 shadow-2xs font-medium' : 'text-slate-500'
                  }`}
                >
                  - Deduct Stock
                </button>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Quantity ({selectedProduct.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustData.qty}
                  onChange={(e) => setAdjustData({ ...adjustData, qty: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-medium text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Reason</label>
                <select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-normal"
                >
                  {adjustData.mode === 'ADD' ? (
                    <>
                      <option value="PURCHASE">Supplier Inward / New Lot</option>
                      <option value="RETURN_IN">Customer Return (Restock)</option>
                      <option value="ADJUSTMENT">Audit Count Correction (+)</option>
                    </>
                  ) : (
                    <>
                      <option value="ADJUSTMENT">Audit Count Correction (-)</option>
                      <option value="DAMAGE">Damaged / Scrap</option>
                      <option value="RETURN_OUT">Supplier Return (RTV)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-1.5 text-white rounded-lg font-medium shadow-2xs ${
                    adjustData.mode === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {submitting ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT PART */}
      {/* ========================================================= */}
      {isEditModalOpen && selectedProduct && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden text-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-900">Edit Spare Part</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditProduct} className="p-5 space-y-3.5">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Part Name</label>
                <input
                  type="text"
                  required
                  value={editPart.name}
                  onChange={(e) => setEditPart({ ...editPart, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Part No.</label>
                  <input
                    type="text"
                    value={editPart.partNumber}
                    onChange={(e) => setEditPart({ ...editPart, partNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={editPart.brand}
                    onChange={(e) => setEditPart({ ...editPart, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Wholesale Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPart.salePriceRupees}
                    onChange={(e) => setEditPart({ ...editPart, salePriceRupees: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPart.purchasePriceRupees}
                    onChange={(e) => setEditPart({ ...editPart, purchasePriceRupees: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={editPart.reorderLevel}
                    onChange={(e) => setEditPart({ ...editPart, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-normal"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit</label>
                  <select
                    value={editPart.unit}
                    onChange={(e) => setEditPart({ ...editPart, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-normal"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="set">Set (set)</option>
                    <option value="ltr">Litres (ltr)</option>
                    <option value="box">Box (box)</option>
                    <option value="can">Can (can)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Compatible Bike Models</label>
                <input
                  type="text"
                  value={editPart.models}
                  onChange={(e) => setEditPart({ ...editPart, models: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-normal"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-2xs"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================= */}
      {isDeleteModalOpen && selectedProduct && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-xs w-full border border-slate-200 shadow-2xl p-5 text-center text-xs">
            <h3 className="text-sm font-medium text-slate-900">Delete Part</h3>
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Remove <span className="font-medium text-slate-800">{selectedProduct.name}</span> from inventory?
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedProduct(null);
                }}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={submitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
        </ClientPortal>
      )}
    </div>
  );
}
