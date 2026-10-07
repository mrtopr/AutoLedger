'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Bike,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Tag,
  Boxes,
  X,
  TrendingUp,
  AlertTriangle,
  Copy,
  Check,
  Filter,
  Sparkles,
  Zap,
  DollarSign
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

const POPULAR_BIKE_MODELS = [
  'Hero Splendor Plus',
  'Hero HF Deluxe',
  'Hero Passion Pro',
  'Honda Activa 6G',
  'Honda Shine 125',
  'Honda Unicorn',
  'Bajaj Pulsar 150',
  'Bajaj Platina 100',
  'TVS Jupiter',
  'TVS Apache RTR',
  'TVS XL100',
  'Royal Enfield Classic 350',
  'Yamaha FZ-S',
  'Suzuki Access 125'
];

const CATEGORIES = [
  'ALL',
  'Brakes & Friction',
  'Engine & Transmission',
  'Lubricants & Oils',
  'Ignition & Electrical',
  'Body & Frame',
  'Suspension & Steering'
];

const BIKE_MAKES = ['ALL', 'Hero', 'Honda', 'Bajaj', 'TVS', 'Yamaha', 'Royal Enfield'];

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [isAddProductModal, setIsAddProductModal] = useState(false);
  const [isAdjustStockModal, setIsAdjustStockModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    partNumber: '',
    brand: 'ASK Genuine',
    category: 'Brakes & Friction',
    hsnCode: '8714',
    gstRateBp: 1800,
    unit: 'pcs',
    purchasePriceRupees: '',
    salePriceRupees: '',
    mrpRupees: '',
    openingStock: '20',
    reorderLevel: '5',
    selectedModels: ['Hero Splendor Plus', 'Honda Activa 6G'] as string[],
    customModelInput: '',
  });

  // Stock Adjustment Form State
  const [selectedProductIdForStock, setSelectedProductIdForStock] = useState<string>('');
  const [stockChangeQty, setStockChangeQty] = useState<string>('10');
  const [stockReason, setStockReason] = useState<string>('PURCHASE');
  const [stockUnitCostRupees, setStockUnitCostRupees] = useState<string>('');

  // Fetch live products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedMake !== 'ALL') params.append('make', selectedMake);

      const res = await fetch(`/api/v1/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products) {
          setProducts(data.products);
        }
      }
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedMake]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'SELECT') {
        return;
      }
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsAddProductModal(true);
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setSelectedProductIdForStock(products[0]?.id || '');
        setIsAdjustStockModal(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }
      if (stockFilter === 'LOW' && (p.stockQty > p.reorderLevel || p.stockQty === 0)) {
        return false;
      }
      if (stockFilter === 'OUT' && p.stockQty > 0) {
        return false;
      }
      return true;
    });
  }, [products, selectedCategory, stockFilter]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalSkus = products.length;
    const lowStockCount = products.filter((p) => p.stockQty <= p.reorderLevel && p.stockQty > 0).length;
    const outOfStockCount = products.filter((p) => p.stockQty <= 0).length;
    const totalValuationPaise = products.reduce((acc, p) => {
      const rate = BigInt(p.purchasePricePaise || p.salePricePaise || '0');
      const qty = BigInt(Math.max(0, p.stockQty));
      return acc + rate * qty;
    }, 0n);

    return {
      totalSkus,
      lowStockCount,
      outOfStockCount,
      totalValuationFormatted: formatPaiseToRupees(totalValuationPaise),
    };
  }, [products]);

  // Handle Copy SKU
  const handleCopySku = (sku: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  // Open Quick Stock Adjust for a specific row
  const handleOpenRowStockAdjust = (product: ProductItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProductIdForStock(product.id);
    setStockChangeQty('10');
    setStockReason('PURCHASE');
    setStockUnitCostRupees((Number(product.purchasePricePaise) / 100).toFixed(2));
    setIsAdjustStockModal(true);
  };

  // Handle Add Product Submit
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newProduct.name || !newProduct.salePriceRupees) {
      setModalError('Part name and sale price are required');
      return;
    }

    try {
      setSubmitting(true);
      const salePaise = parseRupeesToPaise(newProduct.salePriceRupees);
      const purchasePaise = newProduct.purchasePriceRupees ? parseRupeesToPaise(newProduct.purchasePriceRupees) : 0n;
      const mrpPaise = newProduct.mrpRupees ? parseRupeesToPaise(newProduct.mrpRupees) : salePaise;

      const customList = newProduct.customModelInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const combinedModels = Array.from(new Set([...newProduct.selectedModels, ...customList]));

      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          partNumber: newProduct.partNumber.trim(),
          brand: newProduct.brand.trim() || 'Genuine',
          category: newProduct.category,
          hsnCode: newProduct.hsnCode.trim() || '8714',
          gstRateBp: newProduct.gstRateBp,
          unit: newProduct.unit,
          purchasePricePaise: purchasePaise.toString(),
          salePricePaise: salePaise.toString(),
          mrpPaise: mrpPaise.toString(),
          openingStock: parseInt(newProduct.openingStock, 10) || 0,
          reorderLevel: parseInt(newProduct.reorderLevel, 10) || 0,
          bikeModelIds: combinedModels.length > 0 ? combinedModels : ['Universal / Multi-Fit'],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to add product');
        return;
      }

      setIsAddProductModal(false);
      setNewProduct({
        name: '',
        partNumber: '',
        brand: 'ASK Genuine',
        category: 'Brakes & Friction',
        hsnCode: '8714',
        gstRateBp: 1800,
        unit: 'pcs',
        purchasePriceRupees: '',
        salePriceRupees: '',
        mrpRupees: '',
        openingStock: '20',
        reorderLevel: '5',
        selectedModels: ['Hero Splendor Plus', 'Honda Activa 6G'],
        customModelInput: '',
      });
      fetchProducts();
    } catch (err: any) {
      setModalError(err.message || 'Error creating product');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle model chip in Add Modal
  const toggleModelChip = (model: string) => {
    if (newProduct.selectedModels.includes(model)) {
      setNewProduct({
        ...newProduct,
        selectedModels: newProduct.selectedModels.filter((m) => m !== model),
      });
    } else {
      setNewProduct({
        ...newProduct,
        selectedModels: [...newProduct.selectedModels, model],
      });
    }
  };

  // Handle Stock Adjustment Submit
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductIdForStock || !stockChangeQty) return;

    try {
      setSubmitting(true);
      const unitCostPaise = stockUnitCostRupees ? parseRupeesToPaise(stockUnitCostRupees) : 0n;

      const res = await fetch(`/api/v1/products/${selectedProductIdForStock}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty: parseInt(stockChangeQty, 10),
          reason: stockReason,
          unitCostPaise: unitCostPaise.toString(),
        }),
      });

      if (res.ok) {
        setIsAdjustStockModal(false);
        fetchProducts();
      }
    } catch (err) {
      console.error('Error adjusting stock:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Currently selected product for stock modal
  const activeStockProduct = products.find((p) => p.id === selectedProductIdForStock) || products[0];

  // Estimated margin calculation in modal
  const modalMarginInfo = useMemo(() => {
    const sale = parseFloat(newProduct.salePriceRupees) || 0;
    const purchase = parseFloat(newProduct.purchasePriceRupees) || 0;
    if (sale > 0 && purchase > 0 && sale >= purchase) {
      const profit = sale - purchase;
      const marginPercent = ((profit / sale) * 100).toFixed(1);
      return { profit: profit.toFixed(2), marginPercent };
    }
    return null;
  }, [newProduct.salePriceRupees, newProduct.purchasePriceRupees]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <Package className="w-4 h-4 text-[#C81E1E]" />
              <span>Spares Master & Inventory Catalog</span>
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
              {stats.totalSkus} Active Parts
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Multi-brand spares catalog with bike compatibility, HSN tax rates, wholesale pricing, and stock telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setSelectedProductIdForStock(products[0]?.id || '');
              setIsAdjustStockModal(true);
            }}
            className="h-8.5 px-3 bg-white hover:bg-[#F8F9FA] text-[#334155] hover:text-[#0F172A] text-xs font-semibold rounded-xl border border-[#CBD5E1] transition shadow-2xs flex items-center gap-1.5"
            title="Inward Stock (Alt+S)"
          >
            <Boxes className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Inward / Stock</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-[#F1F5F9] rounded-md text-[10px] text-[#64748B] font-mono border border-[#E2E8F0]">Alt+S</kbd>
          </button>
          <button
            onClick={() => setIsAddProductModal(true)}
            className="h-8.5 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5"
            title="Add New Part (Alt+C)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Part</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-red-900/60 rounded-md text-[10px] text-white font-mono">Alt+C</kbd>
          </button>
        </div>
      </div>

      {/* Stock Telemetry Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total SKUs */}
        <div 
          onClick={() => setStockFilter('ALL')}
          className={`p-4 rounded-2xl border transition-colors cursor-pointer bg-white shadow-2xs ${
            stockFilter === 'ALL' 
              ? 'border-[#0F172A] ring-1 ring-[#0F172A]' 
              : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center justify-between text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">
            <span>Active SKUs</span>
            <Package className="w-4 h-4 text-[#64748B]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono tabular-nums text-[#0F172A]">{stats.totalSkus}</span>
            <span className="text-[11px] text-[#64748B]">parts listed</span>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`p-4 rounded-2xl border transition-colors cursor-pointer bg-white shadow-2xs ${
            stockFilter === 'LOW' 
              ? 'border-[#D97706] ring-1 ring-[#D97706]' 
              : 'border-[#E2E8F0] hover:border-[#FDE68A]'
          }`}
        >
          <div className="flex items-center justify-between text-[#D97706] text-[11px] font-semibold uppercase tracking-wider">
            <span>Low Stock Reorder</span>
            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono tabular-nums text-[#92400E]">{stats.lowStockCount}</span>
            <span className="text-[11px] text-[#D97706]">below threshold</span>
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'OUT' ? 'ALL' : 'OUT')}
          className={`p-4 rounded-2xl border transition-colors cursor-pointer bg-white shadow-2xs ${
            stockFilter === 'OUT' 
              ? 'border-[#C81E1E] ring-1 ring-[#C81E1E]' 
              : 'border-[#E2E8F0] hover:border-[#FCA5A5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#C81E1E] text-[11px] font-semibold uppercase tracking-wider">
            <span>Out of Stock (0 Qty)</span>
            <AlertCircle className="w-4 h-4 text-[#C81E1E]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono tabular-nums text-[#991B1B]">{stats.outOfStockCount}</span>
            <span className="text-[11px] text-[#C81E1E]">requires inward</span>
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs">
          <div className="flex items-center justify-between text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">
            <span>Stock Valuation (Wholesale)</span>
            <DollarSign className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono tabular-nums text-[#166534]">
              {stats.totalValuationFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box with `/` shortcut */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search part #, model, brand (Press '/')..."
              className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl pl-9 pr-8 py-2 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] transition outline-hidden shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bike Make Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-0.5 sm:pb-0">
            {BIKE_MAKES.map((make) => (
              <button
                key={make}
                onClick={() => setSelectedMake(make)}
                className={`h-7.5 px-3 rounded-xl text-xs font-medium transition shrink-0 ${
                  selectedMake === make 
                    ? 'bg-[#0F172A] text-white font-semibold shadow-2xs' 
                    : 'bg-[#F8F9FA] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
                }`}
              >
                {make === 'ALL' ? 'All Brands' : make}
              </button>
            ))}
          </div>
        </div>

        {/* Category Facet Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 border-t border-[#F1F5F9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3 text-[#64748B]" /> Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`h-6.5 px-2.5 rounded-lg text-[11px] font-medium transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#C81E1E] text-white font-semibold shadow-2xs'
                  : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left text-xs text-[#334155] relative border-collapse">
            <thead className="bg-[#F8F9FA] text-[10px] font-semibold uppercase text-[#64748B] border-b border-[#E2E8F0] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3.5 w-36">Part Number</th>
                <th className="py-2.5 px-3.5 min-w-[220px]">Item Description & Specs</th>
                <th className="py-2.5 px-3.5 min-w-[200px]">Bike Compatibility</th>
                <th className="py-2.5 px-3 w-16 text-center">GST %</th>
                <th className="py-2.5 px-3.5 w-32 text-right">Wholesale Rate</th>
                <th className="py-2.5 px-3.5 w-28 text-right">MRP / Margin</th>
                <th className="py-2.5 px-3.5 w-28 text-center">Stock Level</th>
                <th className="py-2.5 px-3.5 w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-[#C81E1E] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium text-[#475569]">Loading motorcycle parts catalog...</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Package className="w-6 h-6 text-[#CBD5E1] mx-auto" />
                        <p className="text-[#334155] font-medium text-xs">No spare parts match the active filters.</p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedMake('ALL');
                            setSelectedCategory('ALL');
                            setStockFilter('ALL');
                          }}
                          className="text-xs text-[#2563EB] hover:underline font-medium"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stockQty <= 0;
                  const isLowStock = !isOutOfStock && p.stockQty <= p.reorderLevel;

                  // Margin calculation
                  const wholesalePaise = BigInt(p.salePricePaise || '0');
                  const purchasePaise = BigInt(p.purchasePricePaise || '0');
                  let marginBadge: React.ReactNode = null;

                  if (wholesalePaise > 0n && purchasePaise > 0n && wholesalePaise > purchasePaise) {
                    const profitPaise = wholesalePaise - purchasePaise;
                    const marginPct = Number((profitPaise * 1000n) / wholesalePaise) / 10;
                    marginBadge = (
                      <span className="text-[10px] text-[#166534] font-medium block">
                        +{marginPct.toFixed(0)}% margin
                      </span>
                    );
                  }

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-[#F8F9FA] transition-colors group ${
                        isOutOfStock ? 'bg-[#FEF2F2]/40' : isLowStock ? 'bg-[#FFFBEB]/40' : ''
                      }`}
                    >
                      {/* Part Number / SKU with Copy */}
                      <td className="py-2.5 px-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#0F172A]">{p.partNumber || '-'}</span>
                          {p.partNumber && (
                            <button
                              onClick={(e) => handleCopySku(p.partNumber, e)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#E2E8F0] rounded transition text-[#64748B]"
                              title="Copy SKU"
                            >
                              {copiedSku === p.partNumber ? (
                                <Check className="w-3 h-3 text-[#16A34A]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Item Description & Brand */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-medium text-[#0F172A] text-xs">{p.name}</div>
                        <div className="text-[10px] text-[#64748B] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-[#475569] bg-[#F1F5F9] px-1.5 py-0.2 rounded-md border border-[#E2E8F0]">
                            {p.brand}
                          </span>
                          <span>·</span>
                          <span>{p.category}</span>
                          <span>·</span>
                          <span className="font-mono">HSN: {p.hsnCode}</span>
                          <span>·</span>
                          <span>Unit: {p.unit}</span>
                        </div>
                      </td>

                      {/* Bike Compatibility */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-wrap gap-1">
                          {p.models.map((m) => (
                            <span
                              key={m}
                              className="bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* GST % */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                          {p.gstRateBp / 100}%
                        </span>
                      </td>

                      {/* Wholesale Sale Rate */}
                      <td className="py-2.5 px-3.5 text-right font-bold font-mono tabular-nums text-[#0F172A]">
                        {formatPaiseToRupees(BigInt(p.salePricePaise || 0))}
                      </td>

                      {/* MRP & Margin */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="font-mono tabular-nums text-[#64748B]">{formatPaiseToRupees(BigInt(p.mrpPaise || 0))}</div>
                        {marginBadge}
                      </td>

                      {/* Stock Level with Clear Alarm Badges */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className={`font-mono tabular-nums font-semibold ${isOutOfStock ? 'text-[#991B1B]' : isLowStock ? 'text-[#92400E]' : 'text-[#0F172A]'}`}>
                            {p.stockQty} {p.unit}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[9px] bg-[#FEF2F2] text-[#991B1B] border border-[#FEE2E2] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C81E1E]" />
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[9px] bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="text-[9px] text-[#166534] font-medium">Healthy</span>
                          )}
                        </div>
                      </td>

                      {/* Contextual Quick Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          onClick={(e) => handleOpenRowStockAdjust(p, e)}
                          className="h-6.5 inline-flex items-center gap-1 px-2.5 bg-white hover:bg-[#F1F5F9] text-[#334155] font-medium text-[10px] rounded-lg border border-[#CBD5E1] shadow-2xs transition"
                          title="Quick Add Stock to this Item"
                        >
                          <Boxes className="w-3 h-3 text-[#64748B]" />
                          <span>+ Stock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------- ADD NEW PRODUCT MODAL ----------------- */}
      {isAddProductModal && (
        <ClientPortal>
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#CBD5E1] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl my-6">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2.5">
                  <Package className="w-5 h-5 text-[#C81E1E]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Add Motorcycle Spare Part to Catalog
                    </h3>
                    <p className="text-[11px] text-[#64748B]">Configure part specifications, vehicle compatibility, and pricing tiers.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddProductModal(false)}
                  className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FEE2E2] rounded-xl text-xs text-[#991B1B] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#C81E1E]" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleAddProduct} className="space-y-3.5 text-xs">
                {/* Part Name & Part Number */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[#334155] font-semibold mb-1">
                      Part Name / Description *
                    </label>
                    <input
                      type="text"
                      required
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="e.g. Front Disc Brake Pad Set (Brembo KBX)"
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      Part Number / SKU
                    </label>
                    <input
                      type="text"
                      value={newProduct.partNumber}
                      onChange={(e) => setNewProduct({ ...newProduct, partNumber: e.target.value })}
                      placeholder="BP-PULSAR-02"
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-mono focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                {/* Brand & Category & Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      value={newProduct.brand}
                      onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      placeholder="e.g. ASK, Brembo, Rolon"
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      Category
                    </label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    >
                      <option value="Brakes & Friction">Brakes & Friction</option>
                      <option value="Engine & Transmission">Engine & Transmission</option>
                      <option value="Lubricants & Oils">Lubricants & Oils</option>
                      <option value="Ignition & Electrical">Ignition & Electrical</option>
                      <option value="Body & Frame">Body & Frame</option>
                      <option value="Suspension & Steering">Suspension & Steering</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      Unit of Measure
                    </label>
                    <select
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    >
                      <option value="pcs">pcs</option>
                      <option value="set">set</option>
                      <option value="kit">kit</option>
                      <option value="can">can</option>
                      <option value="pair">pair</option>
                      <option value="ltr">ltr</option>
                    </select>
                  </div>
                </div>

                {/* Pricing Grid */}
                <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2.5 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[#334155] font-semibold mb-1">
                        Wholesale Sale Price (₹) *
                      </label>
                      <input
                        type="text"
                        required
                        value={newProduct.salePriceRupees}
                        onChange={(e) => setNewProduct({ ...newProduct, salePriceRupees: e.target.value })}
                        placeholder="290.00"
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg p-2 text-xs font-bold text-[#0F172A] font-mono tabular-nums focus:border-[#C81E1E] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[#334155] font-semibold mb-1">
                        MRP Price (₹)
                      </label>
                      <input
                        type="text"
                        value={newProduct.mrpRupees}
                        onChange={(e) => setNewProduct({ ...newProduct, mrpRupees: e.target.value })}
                        placeholder="380.00"
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg p-2 text-xs text-[#0F172A] font-mono tabular-nums focus:border-[#C81E1E] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[#334155] font-semibold mb-1">
                        Purchase Cost (₹)
                      </label>
                      <input
                        type="text"
                        value={newProduct.purchasePriceRupees}
                        onChange={(e) => setNewProduct({ ...newProduct, purchasePriceRupees: e.target.value })}
                        placeholder="220.00"
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg p-2 text-xs text-[#0F172A] font-mono tabular-nums focus:border-[#C81E1E] outline-hidden"
                      />
                    </div>
                  </div>

                  {modalMarginInfo && (
                    <div className="text-[11px] text-[#166534] font-medium flex items-center gap-1.5 pt-0.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Projected Dealer Profit: ₹{modalMarginInfo.profit} ({modalMarginInfo.marginPercent}% gross margin)</span>
                    </div>
                  )}
                </div>

                {/* GST & HSN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      GST Slab Rate
                    </label>
                    <select
                      value={newProduct.gstRateBp}
                      onChange={(e) => setNewProduct({ ...newProduct, gstRateBp: parseInt(e.target.value) })}
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-medium focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    >
                      <option value="1800">18% GST (Auto Spares)</option>
                      <option value="2800">28% GST (Batteries / Tyres)</option>
                      <option value="1200">12% GST</option>
                      <option value="500">5% GST</option>
                      <option value="0">0% (Exempted)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      value={newProduct.hsnCode}
                      onChange={(e) => setNewProduct({ ...newProduct, hsnCode: e.target.value })}
                      placeholder="8714"
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-mono focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                {/* Initial Stock & Low Stock Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      Initial Opening Stock Qty
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.openingStock}
                      onChange={(e) => setNewProduct({ ...newProduct, openingStock: e.target.value })}
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-bold focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[#334155] font-semibold mb-1">
                      Low Stock Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.reorderLevel}
                      onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: e.target.value })}
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-bold focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                {/* Interactive Motorcycle Compatibility Chips */}
                <div>
                  <label className="block text-[#334155] font-semibold mb-1">
                    Select Compatible Motorcycle Models (Click to toggle)
                  </label>
                  <div className="flex flex-wrap gap-1 p-2.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl max-h-28 overflow-y-auto">
                    {POPULAR_BIKE_MODELS.map((model) => {
                      const isSelected = newProduct.selectedModels.includes(model);
                      return (
                        <button
                          type="button"
                          key={model}
                          onClick={() => toggleModelChip(model)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                            isSelected
                              ? 'bg-[#0F172A] text-white font-semibold shadow-2xs'
                              : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {model}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2">
                    <input
                      type="text"
                      value={newProduct.customModelInput}
                      onChange={(e) => setNewProduct({ ...newProduct, customModelInput: e.target.value })}
                      placeholder="Or type other custom models (comma separated)..."
                      className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2 text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsAddProductModal(false)}
                    className="flex-1 h-8.5 bg-white hover:bg-[#F8F9FA] text-[#475569] font-medium rounded-xl text-xs border border-[#CBD5E1]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-8.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold rounded-xl text-xs shadow-2xs transition disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save & Add to Catalog'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* ----------------- ADJUST STOCK MODAL ----------------- */}
      {isAdjustStockModal && (
        <ClientPortal>
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
            <div className="bg-white border border-[#CBD5E1] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-5 h-5 text-[#C81E1E]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Inward Stock Entry / Adjust Qty
                    </h3>
                    <p className="text-[11px] text-[#64748B]">Record supplier purchase or stock count audit.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustStockModal(false)}
                  className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Product Snapshot Card */}
              {activeStockProduct && (
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#E2E8F0] text-xs flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="font-semibold text-[#0F172A]">{activeStockProduct.name}</div>
                    <div className="text-[10px] text-[#64748B] font-mono">{activeStockProduct.partNumber} · {activeStockProduct.brand}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#64748B]">Current Stock</div>
                    <div className="font-bold font-mono tabular-nums text-[#0F172A] text-xs">{activeStockProduct.stockQty} {activeStockProduct.unit}</div>
                  </div>
                </div>
              )}

              <form onSubmit={handleAdjustStock} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[#334155] font-semibold mb-1">
                    Select Product / Part *
                  </label>
                  <select
                    required
                    value={selectedProductIdForStock || (products[0]?.id || '')}
                    onChange={(e) => setSelectedProductIdForStock(e.target.value)}
                    className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-medium focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.partNumber || 'No SKU'}) · Stock: {p.stockQty} {p.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#334155] font-semibold mb-1">
                    Quantity to Add (+)
                  </label>
                  <input
                    type="number"
                    required
                    value={stockChangeQty}
                    onChange={(e) => setStockChangeQty(e.target.value)}
                    className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-bold focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                  />
                  {/* Quick Qty Buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {['+5', '+10', '+20', '+50', '+100'].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => setStockChangeQty(preset.replace('+', ''))}
                        className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-[10px] font-semibold border border-[#CBD5E1] shadow-2xs"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[#334155] font-semibold mb-1">
                    Movement Reason
                  </label>
                  <select
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-medium focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                  >
                    <option value="PURCHASE">Supplier Inward Purchase</option>
                    <option value="ADJUSTMENT">Physical Audit Correction</option>
                    <option value="RETURN_IN">Customer Return In</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#334155] font-semibold mb-1">
                    Purchase Unit Cost (₹ Optional)
                  </label>
                  <input
                    type="text"
                    value={stockUnitCostRupees}
                    onChange={(e) => setStockUnitCostRupees(e.target.value)}
                    placeholder="e.g. 210.00"
                    className="w-full bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl p-2.5 text-xs text-[#0F172A] font-mono tabular-nums focus:bg-white focus:border-[#C81E1E] outline-hidden shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdjustStockModal(false)}
                    className="flex-1 h-8.5 bg-white hover:bg-[#F8F9FA] text-[#475569] font-medium rounded-xl text-xs border border-[#CBD5E1]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-8.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl text-xs shadow-2xs transition"
                  >
                    {submitting ? 'Updating...' : 'Confirm Stock Addition'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      )}
    </div>
  );
}
