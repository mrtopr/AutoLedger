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
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2 ${
          toast.type === 'success' 
            ? 'bg-[#0F172A] text-white border-[#334155]' 
            : 'bg-[#991B1B] text-white border-[#B91C1C]'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" /> : <AlertCircle className="w-4 h-4 text-[#FCA5A5]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                {language === 'hi' ? 'इन्वेंट्री एवं पार्ट्स स्टॉक' : 'Inventory & Stock Management'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {products.length} SKUs · {totalUnits} Units
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Physical stock monitoring, bin levels, cost basis valuation, and fast-moving spare parts replenishment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProducts}
            disabled={loading}
            className="h-8 px-3 bg-white hover:bg-[#F8F9FA] text-[#475569] hover:text-[#0F172A] rounded-md border border-[#CBD5E1] text-xs font-medium transition flex items-center gap-1.5 shadow-2xs"
            title={language === 'hi' ? 'ताज़ा करें' : 'Refresh Inventory'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C81E1E]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-semibold rounded-md shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('inv.add_product', 'Add Product')}</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{language === 'hi' ? 'कुल स्टॉक मूल्यांकन' : 'Wholesale Valuation'}</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">
            {formatPaiseToRupees(totalValuation)}
          </div>
          <div className="text-[11px] text-[#64748B]">{language === 'hi' ? 'लागत मूल्य:' : 'Cost Basis:'} {formatPaiseToRupees(totalCostValuation)}</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{language === 'hi' ? 'कुल पार्ट्स (SKUs)' : 'Total SKUs Listed'}</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">
            {products.length} <span className="text-xs text-[#64748B] font-normal">{language === 'hi' ? 'पार्ट्स' : 'Parts'}</span>
          </div>
          <div className="text-[11px] text-[#64748B]">{totalUnits} {language === 'hi' ? 'यूनिट्स उपलब्ध' : 'units on warehouse shelves'}</div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`cursor-pointer border rounded-lg p-3.5 shadow-2xs transition-colors bg-white ${
            statusFilter === 'LOW' 
              ? 'border-[#D97706] ring-2 ring-[#D97706]/20' 
              : 'border-[#E2E8F0] hover:border-[#FDE68A]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">{t('dash.low_stock_spares', 'Low Stock Items')}</span>
            {lowStockCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
                Action Needed
              </span>
            )}
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#92400E] mt-1">
            {lowStockCount} <span className="text-xs text-[#64748B] font-normal">{language === 'hi' ? 'पार्ट्स' : 'Parts'}</span>
          </div>
          <div className="text-[11px] text-[#D97706] mt-0.5">{language === 'hi' ? 'न्यूनतम सीमा से कम स्टॉक' : 'Below minimum reorder threshold'}</div>
        </div>
      </div>

      {/* 3. Search & Filter Strip */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inv.search_placeholder', 'Search SKU, part name, brand...')}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#F8F9FA] border border-[#CBD5E1] rounded-md focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] text-[#0F172A] placeholder-[#94A3B8] outline-hidden transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Department Select */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-8 text-xs bg-[#F8F9FA] border border-[#CBD5E1] rounded-md px-2.5 font-medium text-[#334155] focus:bg-white focus:border-[#C81E1E] outline-hidden transition"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d === 'All Departments' && language === 'hi' ? 'सभी श्रेणियां (All Departments)' : d}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`h-7 px-3 rounded text-[11px] font-medium transition ${
                statusFilter === 'ALL' ? 'bg-white text-[#0F172A] shadow-2xs font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setStatusFilter('LOW')}
              className={`h-7 px-3 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                statusFilter === 'LOW' ? 'bg-white text-[#92400E] shadow-2xs font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <span>Low</span>
              {lowStockCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />}
            </button>
            <button
              onClick={() => setStatusFilter('HEALTHY')}
              className={`h-7 px-3 rounded text-[11px] font-medium transition ${
                statusFilter === 'HEALTHY' ? 'bg-white text-[#0F172A] shadow-2xs font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              In Stock
            </button>
          </div>
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] text-[10px] font-semibold uppercase">
                <th className="py-3 px-4 font-semibold">{t('inv.sku_part_no', 'Part Name & SKU')}</th>
                <th className="py-3 px-4 font-semibold">{t('inv.category', 'Category')}</th>
                <th className="py-3 px-4 text-center font-semibold">{t('inv.stock_qty', 'Stock')}</th>
                <th className="py-3 px-4 text-center font-semibold">{t('inv.min_stock', 'Min Level')}</th>
                <th className="py-3 px-4 text-right font-semibold">{t('inv.selling_price', 'Wholesale Rate')}</th>
                <th className="py-3 px-4 text-center font-semibold">{t('invs.status', 'Status')}</th>
                <th className="py-3 px-4 text-right font-semibold">{t('inv.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#94A3B8]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CBD5E1]" />
                    <span>{t('common.loading', 'Loading inventory records...')}</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#94A3B8]">
                    {t('common.no_data', 'No spare parts found matching your filter criteria.')}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stockQty <= p.reorderLevel;
                  const isOut = p.stockQty <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#F8F9FA] transition-colors">
                      {/* Part Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0F172A] text-xs">{p.name}</div>
                        <div className="text-[10px] text-[#64748B] font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="bg-[#F1F5F9] px-1.5 py-0.5 rounded-md text-[#475569] border border-[#E2E8F0]">{p.partNumber || '—'}</span>
                          <span>·</span>
                          <span>{p.brand}</span>
                          {p.models && p.models.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[#94A3B8] truncate max-w-[200px]">
                                {p.models.slice(0, 2).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-[#475569] text-xs">
                        {p.category || 'General'}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono tabular-nums font-semibold text-xs ${
                          isOut ? 'text-[#991B1B]' : isLow ? 'text-[#92400E]' : 'text-[#0F172A]'
                        }`}>
                          {p.stockQty}
                        </span>
                        <span className="text-[10px] text-[#64748B] ml-1">{p.unit}</span>
                      </td>

                      {/* Min Level */}
                      <td className="py-3 px-4 text-center text-[#64748B] font-mono tabular-nums text-xs">
                        {p.reorderLevel} {p.unit}
                      </td>

                      {/* Wholesale Rate */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono tabular-nums font-semibold text-[#0F172A] text-xs">
                          {formatPaiseToRupees(BigInt(p.salePricePaise || 0))}
                        </div>
                        {Number(p.purchasePricePaise || 0) > 0 && (
                          <div className="text-[10px] text-[#64748B] font-mono tabular-nums">
                            Cost: {formatPaiseToRupees(BigInt(p.purchasePricePaise))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          isOut 
                            ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FEE2E2]' 
                            : isLow 
                            ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]' 
                            : 'bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOut ? 'bg-[#C81E1E]' : isLow ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                          }`} />
                          {isOut 
                            ? 'Out of Stock' 
                            : isLow 
                            ? 'Low Stock' 
                            : 'In Stock'}
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
                            className="h-7 px-2.5 text-[11px] font-medium text-[#334155] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg shadow-2xs transition"
                          >
                            + Stock
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
                            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition"
                            title="Edit Part"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedProduct(p);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-[#DC2626] hover:text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg transition"
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

      {/* MODAL: ADD PART */}
      {isAddModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-lg max-w-lg w-full border border-[#CBD5E1] shadow-2xl overflow-hidden text-xs">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0F172A]">Add New Spare Part</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="p-5 space-y-3.5">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Part Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Front Disc Brake Pad Set"
                    value={newPart.name}
                    onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">OEM / Part No.</label>
                    <input
                      type="text"
                      placeholder="e.g. BP-PULSAR-02"
                      value={newPart.partNumber}
                      onChange={(e) => setNewPart({ ...newPart, partNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] outline-hidden font-mono transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Honda Genuine, Castrol"
                      value={newPart.brand}
                      onChange={(e) => setNewPart({ ...newPart, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] outline-hidden transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Category</label>
                    <select
                      value={newPart.category}
                      onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] bg-white outline-hidden transition"
                    >
                      {DEPARTMENTS.filter((d) => d !== 'All Departments').map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Unit</label>
                    <select
                      value={newPart.unit}
                      onChange={(e) => setNewPart({ ...newPart, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] bg-white outline-hidden transition"
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
                    <label className="block font-semibold text-[#334155] mb-1">Wholesale Rate (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newPart.salePriceRupees}
                      onChange={(e) => setNewPart({ ...newPart, salePriceRupees: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums font-semibold outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Purchase Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newPart.purchasePriceRupees}
                      onChange={(e) => setNewPart({ ...newPart, purchasePriceRupees: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums outline-hidden transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Opening Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={newPart.openingStock}
                      onChange={(e) => setNewPart({ ...newPart, openingStock: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Min Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      value={newPart.reorderLevel}
                      onChange={(e) => setNewPart({ ...newPart, reorderLevel: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums outline-hidden transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Compatible Bike Models</label>
                  <input
                    type="text"
                    placeholder="e.g. Honda Activa 6G, Shine 125, Pulsar 150"
                    value={newPart.models}
                    onChange={(e) => setNewPart({ ...newPart, models: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] outline-hidden transition"
                  />
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="h-8.5 px-4 text-[#475569] hover:bg-[#F1F5F9] rounded-md font-medium border border-[#CBD5E1] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-8.5 px-5 bg-[#C81E1E] hover:bg-[#A81818] text-white rounded-md font-semibold shadow-xs transition"
                  >
                    {submitting ? 'Saving...' : 'Save Part'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {isAdjustModalOpen && selectedProduct && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-lg max-w-sm w-full border border-[#CBD5E1] shadow-2xl overflow-hidden text-xs">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Adjust Stock</h3>
                  <p className="text-[11px] text-[#64748B] truncate max-w-[220px]">{selectedProduct.name}</p>
                </div>
                <button onClick={() => setIsAdjustModalOpen(false)} className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAdjustStock} className="p-5 space-y-3.5">
                <div className="flex items-center justify-between p-3 bg-[#F8F9FA] border border-[#E2E8F0] rounded-md">
                  <span className="text-[#64748B]">Current Stock</span>
                  <span className="font-mono tabular-nums font-bold text-[#0F172A] text-xs">
                    {selectedProduct.stockQty} {selectedProduct.unit}
                  </span>
                </div>

                {/* Mode Toggle */}
                <div className="grid grid-cols-2 gap-1 bg-[#F1F5F9] p-1 rounded-md border border-[#E2E8F0] text-xs">
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, mode: 'ADD', reason: 'PURCHASE' })}
                    className={`py-1.5 rounded-md transition text-xs ${
                      adjustData.mode === 'ADD' ? 'bg-white text-[#166534] shadow-2xs font-semibold' : 'text-[#64748B]'
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, mode: 'DEDUCT', reason: 'ADJUSTMENT' })}
                    className={`py-1.5 rounded-md transition text-xs ${
                      adjustData.mode === 'DEDUCT' ? 'bg-white text-[#92400E] shadow-2xs font-semibold' : 'text-[#64748B]'
                    }`}
                  >
                    - Deduct Stock
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Quantity ({selectedProduct.unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustData.qty}
                    onChange={(e) => setAdjustData({ ...adjustData, qty: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums font-semibold outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Reason</label>
                  <select
                    value={adjustData.reason}
                    onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] bg-white outline-hidden transition"
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

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="h-8.5 px-4 text-[#475569] hover:bg-[#F1F5F9] rounded-md font-medium border border-[#CBD5E1] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`h-8.5 px-5 text-white rounded-md font-semibold shadow-xs transition ${
                      adjustData.mode === 'ADD' ? 'bg-[#16A34A] hover:bg-[#15803D]' : 'bg-[#D97706] hover:bg-[#B45309]'
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

      {/* MODAL: EDIT PART */}
      {isEditModalOpen && selectedProduct && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-lg max-w-lg w-full border border-[#CBD5E1] shadow-2xl overflow-hidden text-xs">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0F172A]">Edit Spare Part</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditProduct} className="p-5 space-y-3.5">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Part Name</label>
                  <input
                    type="text"
                    required
                    value={editPart.name}
                    onChange={(e) => setEditPart({ ...editPart, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] outline-hidden transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Part No.</label>
                    <input
                      type="text"
                      value={editPart.partNumber}
                      onChange={(e) => setEditPart({ ...editPart, partNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Brand</label>
                    <input
                      type="text"
                      value={editPart.brand}
                      onChange={(e) => setEditPart({ ...editPart, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] outline-hidden transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Wholesale Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editPart.salePriceRupees}
                      onChange={(e) => setEditPart({ ...editPart, salePriceRupees: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums font-semibold outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Purchase Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editPart.purchasePriceRupees}
                      onChange={(e) => setEditPart({ ...editPart, purchasePriceRupees: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums outline-hidden transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Min Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      value={editPart.reorderLevel}
                      onChange={(e) => setEditPart({ ...editPart, reorderLevel: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] font-mono tabular-nums outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Unit</label>
                    <select
                      value={editPart.unit}
                      onChange={(e) => setEditPart({ ...editPart, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] bg-white outline-hidden transition"
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
                  <label className="block font-semibold text-[#334155] mb-1">Compatible Bike Models</label>
                  <input
                    type="text"
                    value={editPart.models}
                    onChange={(e) => setEditPart({ ...editPart, models: e.target.value })}
                    className="w-full px-3 py-2 border border-[#CBD5E1] rounded-md focus:border-[#C81E1E] outline-hidden transition"
                  />
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="h-8.5 px-4 text-[#475569] hover:bg-[#F1F5F9] rounded-md font-medium border border-[#CBD5E1] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-8.5 px-5 bg-[#C81E1E] hover:bg-[#A81818] text-white rounded-md font-semibold shadow-xs transition"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {isDeleteModalOpen && selectedProduct && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-lg max-w-xs w-full border border-[#CBD5E1] shadow-2xl p-5 text-center text-xs space-y-3.5">
              <h3 className="text-sm font-bold text-[#0F172A]">Delete Part</h3>
              <p className="text-xs text-[#64748B]">
                Remove <span className="font-semibold text-[#0F172A]">{selectedProduct.name}</span> from inventory?
              </p>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedProduct(null);
                  }}
                  className="h-8.5 px-4 border border-[#CBD5E1] text-[#475569] rounded-md hover:bg-[#F1F5F9] font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProduct}
                  disabled={submitting}
                  className="h-8.5 px-5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md font-semibold shadow-xs transition"
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
