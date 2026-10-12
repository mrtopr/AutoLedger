'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  FileText, 
  Users, 
  RefreshCw, 
  Eye, 
  X, 
  Trash2, 
  Clock, 
  Boxes,
  ArrowDownLeft,
  Building2,
  Calendar
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  creditDays: number;
  poCount?: number;
  grnCount?: number;
}

interface PurchaseOrder {
  id: string;
  number: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  orderDate: string;
  expectedBy: string | null;
  notes: string | null;
  subtotalPaise: string;
  taxTotalPaise: string;
  grandTotalPaise: string;
  supplier: { id: string; name: string; phone: string | null };
  itemCount: number;
  items: any[];
  grnCount: number;
  createdAt: string;
}

interface GoodsReceipt {
  id: string;
  number: string;
  receiptDate: string;
  supplier: { id: string; name: string };
  poNumber: string | null;
  poId: string | null;
  notes: string | null;
  totalAmountPaise: string;
  lines: any[];
  createdAt: string;
}

interface ProductItem {
  id: string;
  name: string;
  partNumber: string;
  stockQty: number;
  purchasePrice: string;
}

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'grn' | 'suppliers'>('orders');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New PO Modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poOrderDate, setPoOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poLines, setPoLines] = useState<any[]>([
    { productId: '', description: '', qty: '1', rate: '', gstRateBp: 1800 },
  ]);
  const [submittingPO, setSubmittingPO] = useState(false);

  // New GRN Modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [grnPoId, setGrnPoId] = useState('');
  const [grnSupplierId, setGrnSupplierId] = useState('');
  const [grnDate, setGrnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [grnNotes, setGrnNotes] = useState('');
  const [grnLines, setGrnLines] = useState<any[]>([
    { productId: '', poItemId: '', description: '', qtyReceived: '1', unitCost: '' },
  ]);
  const [submittingGRN, setSubmittingGRN] = useState(false);

  // New Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supGstin, setSupGstin] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supCreditDays, setSupCreditDays] = useState('30');
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Detail Modal
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Format INR paise to Rupees
  const fmtPaise = (paiseStr?: string | bigint) => {
    if (!paiseStr) return '₹0.00';
    const val = typeof paiseStr === 'bigint' ? paiseStr : BigInt(paiseStr || 0);
    const absVal = val < 0n ? -val : val;
    const isNegative = val < 0n;
    const rupees = (Number(absVal) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${isNegative ? '-' : ''}₹${rupees}`;
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/v1/suppliers');
      const data = await res.json();
      if (data.success) setSuppliers(data.suppliers || []);
    } catch (e) {
      console.error('Error fetching suppliers:', e);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/purchase-orders');
      const data = await res.json();
      if (data.success) setPurchaseOrders(data.purchaseOrders || []);
    } catch (e) {
      console.error('Error fetching POs:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGRNs = async () => {
    try {
      const res = await fetch('/api/v1/grn');
      const data = await res.json();
      if (data.success) setGoodsReceipts(data.goodsReceipts || []);
    } catch (e) {
      console.error('Error fetching GRNs:', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/v1/products?limit=200');
      const data = await res.json();
      if (data.success && data.products) {
        setProducts(data.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          partNumber: p.partNumber,
          stockQty: p.stockQty,
          purchasePrice: p.purchasePricePaise ? (Number(p.purchasePricePaise) / 100).toFixed(2) : '0.00',
        })));
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchGRNs();
    fetchSuppliers();
    fetchProducts();
  }, []);

  // Filtered POs
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchSearch =
        po.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [purchaseOrders, searchQuery, statusFilter]);

  // Handle PO creation
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poLines.length === 0) return;

    try {
      setSubmittingPO(true);
      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          orderDate: poOrderDate,
          expectedBy: poExpectedDate || undefined,
          notes: poNotes || undefined,
          items: poLines.map((l) => ({
            productId: l.productId || undefined,
            description: l.description,
            qty: parseFloat(l.qty || '1'),
            ratePaise: Math.round(parseFloat(l.rate || '0') * 100),
            gstRateBp: l.gstRateBp || 1800,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create Purchase Order');
        return;
      }

      setShowPOModal(false);
      setSelectedSupplierId('');
      setPoNotes('');
      setPoLines([{ productId: '', description: '', qty: '1', rate: '', gstRateBp: 1800 }]);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error submitting PO');
    } finally {
      setSubmittingPO(false);
    }
  };

  // Handle GRN creation
  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnSupplierId || grnLines.length === 0) return;

    try {
      setSubmittingGRN(true);
      const res = await fetch('/api/v1/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: grnSupplierId,
          poId: grnPoId || undefined,
          receiptDate: grnDate,
          notes: grnNotes || undefined,
          lines: grnLines.map((l) => ({
            productId: l.productId || undefined,
            poItemId: l.poItemId || undefined,
            description: l.description,
            qtyReceived: parseFloat(l.qtyReceived || '1'),
            unitCostPaise: Math.round(parseFloat(l.unitCost || '0') * 100),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create Goods Receipt');
        return;
      }

      setShowGRNModal(false);
      setGrnSupplierId('');
      setGrnPoId('');
      setGrnNotes('');
      setGrnLines([{ productId: '', poItemId: '', description: '', qtyReceived: '1', unitCost: '' }]);
      fetchGRNs();
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error saving GRN');
    } finally {
      setSubmittingGRN(false);
    }
  };

  // Handle Supplier creation
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    try {
      setSubmittingSupplier(true);
      const res = await fetch('/api/v1/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supName.trim(),
          phone: supPhone.trim() || undefined,
          gstin: supGstin.trim() || undefined,
          address: supAddress.trim() || undefined,
          creditDays: parseInt(supCreditDays || '30'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create supplier');
        return;
      }

      setShowSupplierModal(false);
      setSupName('');
      setSupPhone('');
      setSupGstin('');
      setSupAddress('');
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message || 'Error creating supplier');
    } finally {
      setSubmittingSupplier(false);
    }
  };

  // When PO is selected in GRN modal, auto-populate lines
  const onSelectPOForGRN = (poId: string) => {
    setGrnPoId(poId);
    const target = purchaseOrders.find((p) => p.id === poId);
    if (target) {
      setGrnSupplierId(target.supplier.id);
      setGrnLines(
        target.items.map((it) => ({
          productId: it.productId || '',
          poItemId: it.id,
          description: it.description,
          qtyReceived: Math.max(0, it.qtyOrdered - it.qtyReceived).toString(),
          unitCost: (Number(it.ratePaise) / 100).toFixed(2),
        }))
      );
    }
  };

  // Status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PARTIALLY_RECEIVED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'SENT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Purchases & Procurement
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Purchase Orders (PO) • Goods Receipt Notes (GRN) • Direct Stock-In & Auto GL Integration
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowGRNModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
          >
            <Truck className="w-4 h-4" />
            Receive Stock (GRN)
          </button>

          <button
            onClick={() => setShowPOModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Orders ({purchaseOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'grn'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Goods Receipts (GRN) ({goodsReceipts.length})
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'suppliers'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PO #, supplier name..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold uppercase text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm py-1.5 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="RECEIVED">Fully Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                onClick={fetchOrders}
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                title="Refresh POs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        {po.number}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(po.orderDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {po.supplier?.name}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-600">
                        {po.itemCount} items
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                            po.status
                          )}`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {fmtPaise(po.grandTotalPaise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedPO(po)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="View PO Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GOODS RECEIPTS (GRN) */}
      {activeTab === 'grn' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Goods Receipt Notes (GRN)</h2>
              <p className="text-xs text-slate-500">
                Inward stock received, with automated FIFO stock addition and Sundry Creditors ledger posting.
              </p>
            </div>
            <button
              onClick={fetchGRNs}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400 bg-slate-50">
                <th className="py-3 px-4">GRN #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4 text-center">Lines</th>
                <th className="py-3 px-4 text-right">Inward Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {goodsReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No goods receipt notes recorded yet.
                  </td>
                </tr>
              ) : (
                goodsReceipts.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                      {grn.number}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(grn.receiptDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {grn.supplier?.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {grn.poNumber || 'Direct GRN'}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-slate-600">
                      {grn.lines?.length || 0} items
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {fmtPaise(grn.totalAmountPaise)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Suppliers Directory</h2>
              <p className="text-xs text-slate-500">
                Manage vendors, credit periods, and procurement history.
              </p>
            </div>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add Supplier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs hover:border-indigo-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{sup.name}</h3>
                    {sup.gstin && (
                      <span className="font-mono text-[11px] text-slate-400">
                        GSTIN: {sup.gstin}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                    {sup.creditDays}d Credit
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  {sup.phone && <div>📞 {sup.phone}</div>}
                  {sup.address && <div className="truncate">📍 {sup.address}</div>}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{sup.poCount || 0} Purchase Orders</span>
                  <span>{sup.grnCount || 0} Inward GRNs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: NEW PURCHASE ORDER */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Purchase Order (PO)</h3>
                <p className="text-xs text-slate-500">
                  Generate formal PO to send to supplier with GST tax calculation
                </p>
              </div>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Supplier *
                  </label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={poOrderDate}
                    onChange={(e) => setPoOrderDate(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                  <span>Line Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPoLines([
                        ...poLines,
                        { productId: '', description: '', qty: '1', rate: '', gstRateBp: 1800 },
                      ])
                    }
                    className="text-indigo-600 hover:underline flex items-center gap-1 normal-case font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {poLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const updated = [...poLines];
                          const prod = products.find((p) => p.id === e.target.value);
                          updated[idx].productId = e.target.value;
                          if (prod) {
                            updated[idx].description = prod.name;
                            updated[idx].rate = prod.purchasePrice;
                          }
                          setPoLines(updated);
                        }}
                        className="w-48 text-sm py-1.5 px-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="">Catalog Item...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        required
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...poLines];
                          updated[idx].description = e.target.value;
                          setPoLines(updated);
                        }}
                        className="flex-1 text-sm py-1.5 px-2.5 border border-slate-200 rounded-lg"
                      />

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.qty}
                        onChange={(e) => {
                          const updated = [...poLines];
                          updated[idx].qty = e.target.value;
                          setPoLines(updated);
                        }}
                        className="w-16 text-sm py-1.5 px-2 border border-slate-200 rounded-lg text-center"
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Rate ₹"
                        value={line.rate}
                        onChange={(e) => {
                          const updated = [...poLines];
                          updated[idx].rate = e.target.value;
                          setPoLines(updated);
                        }}
                        className="w-24 text-sm py-1.5 px-2 border border-slate-200 rounded-lg text-right font-mono"
                      />

                      <select
                        value={line.gstRateBp}
                        onChange={(e) => {
                          const updated = [...poLines];
                          updated[idx].gstRateBp = parseInt(e.target.value);
                          setPoLines(updated);
                        }}
                        className="w-20 text-xs py-1.5 px-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="0">0%</option>
                        <option value="500">5%</option>
                        <option value="1200">12%</option>
                        <option value="1800">18%</option>
                        <option value="2800">28%</option>
                      </select>

                      {poLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPoLines(poLines.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notes / Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivery within 7 days, payment 30 days after GRN"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPO}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingPO ? 'Creating PO...' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE STOCK (GRN) */}
      {showGRNModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Goods Receipt Note (GRN - Stock In)</h3>
                <p className="text-xs text-slate-500">
                  Direct physical stock increment and GL liability addition
                </p>
              </div>
              <button onClick={() => setShowGRNModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Link Purchase Order (Optional)
                  </label>
                  <select
                    value={grnPoId}
                    onChange={(e) => onSelectPOForGRN(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Direct Receipt (No PO)...</option>
                    {purchaseOrders
                      .filter((p) => p.status !== 'RECEIVED' && p.status !== 'CANCELLED')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.number} - {p.supplier?.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Supplier *
                  </label>
                  <select
                    required
                    value={grnSupplierId}
                    onChange={(e) => setGrnSupplierId(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Items receiving */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                  <span>Received Items (Stocked directly into inventory)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setGrnLines([
                        ...grnLines,
                        { productId: '', poItemId: '', description: '', qtyReceived: '1', unitCost: '' },
                      ])
                    }
                    className="text-emerald-600 hover:underline flex items-center gap-1 normal-case font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2">
                  {grnLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const updated = [...grnLines];
                          const prod = products.find((p) => p.id === e.target.value);
                          updated[idx].productId = e.target.value;
                          if (prod) {
                            updated[idx].description = prod.name;
                            updated[idx].unitCost = prod.purchasePrice;
                          }
                          setGrnLines(updated);
                        }}
                        className="w-48 text-sm py-1.5 px-2 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="">Select Catalog Product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        required
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...grnLines];
                          updated[idx].description = e.target.value;
                          setGrnLines(updated);
                        }}
                        className="flex-1 text-sm py-1.5 px-2.5 border border-slate-200 rounded-lg"
                      />

                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="Qty"
                        value={line.qtyReceived}
                        onChange={(e) => {
                          const updated = [...grnLines];
                          updated[idx].qtyReceived = e.target.value;
                          setGrnLines(updated);
                        }}
                        className="w-20 text-sm py-1.5 px-2 border border-slate-200 rounded-lg text-center font-mono"
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Unit Cost ₹"
                        value={line.unitCost}
                        onChange={(e) => {
                          const updated = [...grnLines];
                          updated[idx].unitCost = e.target.value;
                          setGrnLines(updated);
                        }}
                        className="w-28 text-sm py-1.5 px-2 border border-slate-200 rounded-lg text-right font-mono"
                      />

                      {grnLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setGrnLines(grnLines.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGRNModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGRN}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingGRN ? 'Processing Inward Stock...' : 'Confirm Stock Receipt (GRN)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD SUPPLIER */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bajaj Auto Spares Ltd"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  placeholder="22AAAAA0000A1Z5"
                  value={supGstin}
                  onChange={(e) => setSupGstin(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Credit Period (Days)
                  </label>
                  <input
                    type="number"
                    value={supCreditDays}
                    onChange={(e) => setSupCreditDays(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSupplier}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {submittingSupplier ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: VIEW PO */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selectedPO.number}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                      selectedPO.status
                    )}`}
                  >
                    {selectedPO.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supplier: {selectedPO.supplier?.name} • Date:{' '}
                  {new Date(selectedPO.orderDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3 text-center">Ordered</th>
                    <th className="py-2 px-3 text-center">Received</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {selectedPO.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-medium text-slate-800">{it.description}</td>
                      <td className="py-2 px-3 text-center font-mono">{it.qtyOrdered}</td>
                      <td className="py-2 px-3 text-center font-mono text-emerald-600 font-bold">
                        {it.qtyReceived}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{fmtPaise(it.ratePaise)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {fmtPaise(it.lineTotalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">{fmtPaise(selectedPO.subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span className="font-mono">{fmtPaise(selectedPO.taxTotalPaise)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="font-mono">{fmtPaise(selectedPO.grandTotalPaise)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
