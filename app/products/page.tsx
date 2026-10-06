'use client';

import React, { useState, useEffect } from 'react';
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
  X
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

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState<string>('ALL');

  // Modal States
  const [isAddProductModal, setIsAddProductModal] = useState(false);
  const [isAdjustStockModal, setIsAdjustStockModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    partNumber: '',
    brand: '',
    category: 'General Spares',
    hsnCode: '8714',
    gstRateBp: 1800,
    unit: 'pcs',
    purchasePriceRupees: '',
    salePriceRupees: '',
    mrpRupees: '',
    openingStock: '0',
    reorderLevel: '5',
    bikeModelsInput: '',
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
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard Shortcuts (Alt+C -> Add Part, Alt+S -> Adjust Stock)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsAddProductModal(true);
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsAdjustStockModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Add Product Submit
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newProduct.name || !newProduct.salePriceRupees) {
      setModalError('Product Name and Wholesale Selling Price are required.');
      return;
    }

    try {
      setSubmitting(true);
      const salePaise = parseRupeesToPaise(newProduct.salePriceRupees);
      const purchasePaise = newProduct.purchasePriceRupees ? parseRupeesToPaise(newProduct.purchasePriceRupees) : 0n;
      const mrpPaise = newProduct.mrpRupees ? parseRupeesToPaise(newProduct.mrpRupees) : 0n;

      const bikeModelList = newProduct.bikeModelsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          partNumber: newProduct.partNumber,
          brand: newProduct.brand,
          category: newProduct.category,
          hsnCode: newProduct.hsnCode,
          gstRateBp: newProduct.gstRateBp,
          unit: newProduct.unit,
          purchasePricePaise: purchasePaise.toString(),
          salePricePaise: salePaise.toString(),
          mrpPaise: mrpPaise.toString(),
          openingStock: parseInt(newProduct.openingStock, 10) || 0,
          reorderLevel: parseInt(newProduct.reorderLevel, 10) || 0,
          bikeModelIds: bikeModelList,
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
        reorderLevel: '10',
        bikeModelsInput: 'Hero Splendor Plus, Honda Activa 6G',
      });
      fetchProducts();
    } catch (err: any) {
      setModalError(err.message || 'Error creating product');
    } finally {
      setSubmitting(false);
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
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Motorbike Spare Parts & Inventory Master
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time live inventory catalog with bike model compatibility, HSN rates, and stock alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAdjustStockModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition shadow-sm flex items-center gap-1.5"
          >
            <Boxes className="w-3.5 h-3.5 text-slate-600" />
            <span>Adjust Stock (Alt+S)</span>
          </button>
          <button
            onClick={() => setIsAddProductModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Part (Alt+C)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by part number, bike model (Activa, Splendor...), or brand..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 transition"
          />
        </div>

        {/* Bike Make Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'Hero', 'Honda', 'Bajaj', 'TVS', 'Yamaha', 'Royal Enfield'].map((make) => (
            <button
              key={make}
              onClick={() => setSelectedMake(make)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                selectedMake === make 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {make === 'ALL' ? 'All Bikes' : make}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-32">Part No.</th>
                <th className="py-3 px-4 min-w-[200px]">Item Description & Brand</th>
                <th className="py-3 px-4 min-w-[220px]">Bike Compatibility</th>
                <th className="py-3 px-3 w-20 text-center">GST %</th>
                <th className="py-3 px-4 w-28 text-right">Wholesale Rate</th>
                <th className="py-3 px-4 w-24 text-right">MRP</th>
                <th className="py-3 px-4 w-28 text-center">Stock Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 font-mono-numeric">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    {loading ? 'Loading live inventory...' : 'No products found. Click "+ Add New Part" to create one.'}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLowStock = p.stockQty <= p.reorderLevel;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-blue-700 font-mono">{p.partNumber || '-'}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 font-sans text-xs">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5 flex items-center gap-2">
                          <span className="font-medium text-slate-700">{p.brand}</span>
                          <span>•</span>
                          <span>HSN: {p.hsnCode}</span>
                          <span>•</span>
                          <span>Unit: {p.unit}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {p.models.map((m) => (
                            <span
                              key={m}
                              className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-sans font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {p.gstRateBp / 100}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700 text-sm">
                        {formatPaiseToRupees(BigInt(p.salePricePaise || 0))}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500">
                        {formatPaiseToRupees(BigInt(p.mrpPaise || 0))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`font-bold ${isLowStock ? 'text-amber-700' : 'text-slate-800'}`}>
                            {p.stockQty} {p.unit}
                          </span>
                          {isLowStock && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-sans font-bold">
                              Low
                            </span>
                          )}
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

      {/* ----------------- ADD NEW PRODUCT MODAL ----------------- */}
      {isAddProductModal && (
        <ClientPortal>
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-xl my-8 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Add New Motorcycle Spare Part / Item
                </h3>
              </div>
              <button
                onClick={() => setIsAddProductModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
              {/* Part Name & Part Number */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">
                    Part Name / Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g. Front Disc Brake Pad Set (Brembo KBX)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Part Number / SKU
                  </label>
                  <input
                    type="text"
                    value={newProduct.partNumber}
                    onChange={(e) => setNewProduct({ ...newProduct, partNumber: e.target.value })}
                    placeholder="BP-PULSAR-02"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Brand & Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    placeholder="e.g. ASK, Brembo, Rolon"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Category
                  </label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  >
                    <option value="Brakes & Friction">Brakes & Friction</option>
                    <option value="Engine & Transmission">Transmission & Drive</option>
                    <option value="Lubricants & Oils">Lubricants & Oils</option>
                    <option value="Ignition & Electrical">Ignition & Electrical</option>
                    <option value="Body & Frame">Body & Frame Parts</option>
                    <option value="Suspension & Steering">Suspension & Steering</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Unit of Measure
                  </label>
                  <select
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Wholesale Sale Price (₹) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.salePriceRupees}
                    onChange={(e) => setNewProduct({ ...newProduct, salePriceRupees: e.target.value })}
                    placeholder="290.00"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-emerald-700 font-mono-numeric focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    MRP Price (₹)
                  </label>
                  <input
                    type="text"
                    value={newProduct.mrpRupees}
                    onChange={(e) => setNewProduct({ ...newProduct, mrpRupees: e.target.value })}
                    placeholder="380.00"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono-numeric focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Purchase Cost (₹)
                  </label>
                  <input
                    type="text"
                    value={newProduct.purchasePriceRupees}
                    onChange={(e) => setNewProduct({ ...newProduct, purchasePriceRupees: e.target.value })}
                    placeholder="220.00"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono-numeric focus:border-blue-600"
                  />
                </div>
              </div>

              {/* GST & HSN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    GST Slab Rate
                  </label>
                  <select
                    value={newProduct.gstRateBp}
                    onChange={(e) => setNewProduct({ ...newProduct, gstRateBp: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium"
                  >
                    <option value="1800">18% GST (Auto Spares)</option>
                    <option value="2800">28% GST (Batteries / Tyres)</option>
                    <option value="1200">12% GST</option>
                    <option value="500">5% GST</option>
                    <option value="0">0% (Exempted)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    value={newProduct.hsnCode}
                    onChange={(e) => setNewProduct({ ...newProduct, hsnCode: e.target.value })}
                    placeholder="8714"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Initial Stock & Low Stock Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Initial Opening Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.openingStock}
                    onChange={(e) => setNewProduct({ ...newProduct, openingStock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Low Stock Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.reorderLevel}
                    onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold"
                  />
                </div>
              </div>

              {/* Motorcycle Compatibility Tags */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Compatible Bike Models (Comma-separated)
                </label>
                <input
                  type="text"
                  value={newProduct.bikeModelsInput}
                  onChange={(e) => setNewProduct({ ...newProduct, bikeModelsInput: e.target.value })}
                  placeholder="e.g. Hero Splendor Plus, Honda Activa 6G, Bajaj Pulsar 150"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:border-blue-600 font-medium"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Example: Hero Splendor, Honda Activa, TVS Jupiter, Bajaj Pulsar
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddProductModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Saving to Catalog...' : 'Save & Add to Catalog'}
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                Inward Stock Entry / Adjust Qty
              </h3>
              <button
                onClick={() => setIsAdjustStockModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Product / Part *
                </label>
                <select
                  required
                  value={selectedProductIdForStock || (products[0]?.id || '')}
                  onChange={(e) => setSelectedProductIdForStock(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.partNumber || 'No SKU'}) • Current: {p.stockQty} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Qty to Add (+)
                  </label>
                  <input
                    type="number"
                    required
                    value={stockChangeQty}
                    onChange={(e) => setStockChangeQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Movement Reason
                  </label>
                  <select
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  >
                    <option value="PURCHASE">Supplier Inward Purchase</option>
                    <option value="ADJUSTMENT">Physical Audit Correction</option>
                    <option value="RETURN_IN">Customer Return In</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Purchase Unit Cost (₹ Optional)
                </label>
                <input
                  type="text"
                  value={stockUnitCostRupees}
                  onChange={(e) => setStockUnitCostRupees(e.target.value)}
                  placeholder="e.g. 210.00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono-numeric"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustStockModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition"
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
