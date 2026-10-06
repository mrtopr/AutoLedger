'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Store, 
  User, 
  Phone, 
  Mail, 
  Lock, 
  FileText, 
  MapPin, 
  ArrowRight, 
  ArrowLeft, 
  Package, 
  Plus, 
  CheckCircle2, 
  Sparkles, 
  Boxes, 
  TrendingUp, 
  Tag, 
  Trash2,
  Bike,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';

interface OnboardingProduct {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  category: string;
  hsnCode: string;
  gstRateBp: number;
  unit: string;
  purchasePriceRupees: string;
  salePriceRupees: string;
  mrpRupees: string;
  stockQty: number;
  reorderLevel: number;
  models: string[];
}

const PRESET_PARTS = [
  {
    name: 'Front Brake Shoe Set',
    partNumber: 'BS-HERO-01',
    brand: 'ASK Genuine',
    category: 'Brakes & Friction',
    hsnCode: '8714',
    gstRateBp: 1800,
    unit: 'set',
    purchasePriceRupees: '180.00',
    salePriceRupees: '240.00',
    mrpRupees: '320.00',
    stockQty: 50,
    reorderLevel: 15,
    models: ['Hero Splendor Plus', 'Hero HF Deluxe'],
  },
  {
    name: '4T 10W-30 Premium Engine Oil (900ml)',
    partNumber: 'OIL-CAST-4T',
    brand: 'Castrol Activ',
    category: 'Lubricants & Oils',
    hsnCode: '2710',
    gstRateBp: 1800,
    unit: 'can',
    purchasePriceRupees: '340.00',
    salePriceRupees: '410.00',
    mrpRupees: '495.00',
    stockQty: 60,
    reorderLevel: 20,
    models: ['Honda Activa 6G', 'Hero Splendor', 'Honda Shine'],
  },
  {
    name: 'Drive Chain Sprocket Kit 428H',
    partNumber: 'CSK-SPL-112',
    brand: 'Rolon Gold',
    category: 'Transmission & Drive',
    hsnCode: '8483',
    gstRateBp: 1800,
    unit: 'kit',
    purchasePriceRupees: '780.00',
    salePriceRupees: '990.00',
    mrpRupees: '1250.00',
    stockQty: 20,
    reorderLevel: 10,
    models: ['Hero Splendor Plus', 'Hero Passion Pro'],
  },
  {
    name: 'Maintenance Free Battery 12V 5Ah',
    partNumber: 'BAT-EXIDE-5L',
    brand: 'Exide Xplore',
    category: 'Electrical & Battery',
    hsnCode: '8507',
    gstRateBp: 2800,
    unit: 'pcs',
    purchasePriceRupees: '1050.00',
    salePriceRupees: '1290.00',
    mrpRupees: '1650.00',
    stockQty: 15,
    reorderLevel: 8,
    models: ['Honda Activa 6G', 'Bajaj Pulsar 150', 'TVS Jupiter'],
  }
];

export default function OnboardingWizardPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Business Profile
  const [businessData, setBusinessData] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    gstin: '',
    address: '',
    stateCode: '27',
    businessType: 'Motorcycle Spare Parts & Wholesale',
  });

  // Step 2: Inventory Items
  const [itemsList, setItemsList] = useState<OnboardingProduct[]>([]);

  // Current item being edited/added in Step 2
  const [currentItem, setCurrentItem] = useState({
    name: 'Front Brake Shoe Set',
    partNumber: 'BS-HERO-01',
    brand: 'ASK Genuine',
    category: 'Brakes & Friction',
    hsnCode: '8714',
    gstRateBp: 1800,
    unit: 'set',
    purchasePriceRupees: '180.00',
    salePriceRupees: '240.00',
    mrpRupees: '320.00',
    stockQty: '50',
    reorderLevel: '15',
    bikeModelsInput: 'Hero Splendor Plus, Honda Activa 6G',
  });

  // Calculate margin on current item
  const pCost = parseFloat(currentItem.purchasePriceRupees || '0');
  const sRate = parseFloat(currentItem.salePriceRupees || '0');
  const profitMargin = sRate > pCost && pCost > 0 ? (((sRate - pCost) / sRate) * 100).toFixed(1) : '0';
  const profitPerUnit = sRate > pCost ? (sRate - pCost).toFixed(2) : '0.00';

  // Apply a quick preset
  const applyPreset = (preset: typeof PRESET_PARTS[0]) => {
    setCurrentItem({
      name: preset.name,
      partNumber: preset.partNumber,
      brand: preset.brand,
      category: preset.category,
      hsnCode: preset.hsnCode,
      gstRateBp: preset.gstRateBp,
      unit: preset.unit,
      purchasePriceRupees: preset.purchasePriceRupees,
      salePriceRupees: preset.salePriceRupees,
      mrpRupees: preset.mrpRupees,
      stockQty: preset.stockQty.toString(),
      reorderLevel: preset.reorderLevel.toString(),
      bikeModelsInput: preset.models.join(', '),
    });
  };

  // Add current item to batch
  const handleAddItemToBatch = () => {
    if (!currentItem.name || !currentItem.salePriceRupees) {
      setError('Please provide Part Name and Wholesale Sale Price');
      return;
    }

    const newItem: OnboardingProduct = {
      id: `item-${Date.now()}`,
      name: currentItem.name,
      partNumber: currentItem.partNumber || `PART-${Date.now().toString().slice(-4)}`,
      brand: currentItem.brand || 'Genuine',
      category: currentItem.category,
      hsnCode: currentItem.hsnCode || '8714',
      gstRateBp: currentItem.gstRateBp,
      unit: currentItem.unit,
      purchasePriceRupees: currentItem.purchasePriceRupees || '0',
      salePriceRupees: currentItem.salePriceRupees,
      mrpRupees: currentItem.mrpRupees || currentItem.salePriceRupees,
      stockQty: parseInt(currentItem.stockQty, 10) || 10,
      reorderLevel: parseInt(currentItem.reorderLevel, 10) || 5,
      models: currentItem.bikeModelsInput.split(',').map(m => m.trim()).filter(Boolean),
    };

    setItemsList([newItem, ...itemsList]);
    setError(null);

    // Reset current item for next entry
    setCurrentItem({
      name: '',
      partNumber: '',
      brand: 'Genuine',
      category: 'Brakes & Friction',
      hsnCode: '8714',
      gstRateBp: 1800,
      unit: 'pcs',
      purchasePriceRupees: '',
      salePriceRupees: '',
      mrpRupees: '',
      stockQty: '20',
      reorderLevel: '10',
      bikeModelsInput: 'Hero Splendor Plus, Bajaj Pulsar',
    });
  };

  const handleRemoveFromBatch = (id: string) => {
    setItemsList(itemsList.filter(i => i.id !== id));
  };

  // Step 1 Validation & Proceed
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessData.businessName || !businessData.ownerName || !businessData.phone || !businessData.password) {
      setError('Business Name, Owner Name, Phone, and Password are required');
      return;
    }

    if (businessData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setStep(2);
  };

  // Final Submission: Create Business + Insert All Inventory + Launch
  const handleCompleteSetup = async () => {
    setError(null);
    setSubmitting(true);

    try {
      // 1. Sign up business and owner
      const signupRes = await signup({
        businessName: businessData.businessName,
        ownerName: businessData.ownerName,
        phone: businessData.phone,
        email: businessData.email,
        password: businessData.password,
        gstin: businessData.gstin,
        address: businessData.address,
        stateCode: businessData.stateCode,
      });

      if (!signupRes.success) {
        setError(signupRes.error || 'Failed to register business');
        setSubmitting(false);
        setStep(1);
        return;
      }

      // 2. If user has added items (or if they have current item filled in)
      const allToSave = [...itemsList];
      if (currentItem.name && currentItem.salePriceRupees) {
        allToSave.push({
          id: `item-${Date.now()}`,
          name: currentItem.name,
          partNumber: currentItem.partNumber || `PART-${Date.now().toString().slice(-4)}`,
          brand: currentItem.brand || 'Genuine',
          category: currentItem.category,
          hsnCode: currentItem.hsnCode || '8714',
          gstRateBp: currentItem.gstRateBp,
          unit: currentItem.unit,
          purchasePriceRupees: currentItem.purchasePriceRupees || '0',
          salePriceRupees: currentItem.salePriceRupees,
          mrpRupees: currentItem.mrpRupees || currentItem.salePriceRupees,
          stockQty: parseInt(currentItem.stockQty, 10) || 10,
          reorderLevel: parseInt(currentItem.reorderLevel, 10) || 5,
          models: currentItem.bikeModelsInput.split(',').map(m => m.trim()).filter(Boolean),
        });
      }

      for (const prod of allToSave) {
        await fetch('/api/v1/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: prod.name,
            partNumber: prod.partNumber,
            brand: prod.brand,
            category: prod.category,
            hsnCode: prod.hsnCode,
            gstRateBp: prod.gstRateBp,
            unit: prod.unit,
            purchasePricePaise: parseRupeesToPaise(prod.purchasePriceRupees).toString(),
            salePricePaise: parseRupeesToPaise(prod.salePriceRupees).toString(),
            mrpPaise: parseRupeesToPaise(prod.mrpRupees).toString(),
            openingStock: prod.stockQty,
            reorderLevel: prod.reorderLevel,
            bikeModelIds: prod.models,
          }),
        }).catch(err => console.warn('Could not save product:', err));
      }

      // Step 3 Complete
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Error completing setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[88vh] flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-6">
        {/* Animated Progress Indicator Header */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Step 1 Pill */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                step === 1 ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-100' : 'bg-emerald-600 text-white'
              }`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <div>
                <div className={`text-xs font-bold ${step === 1 ? 'text-blue-700' : 'text-slate-800'}`}>
                  Step 1: Business Details
                </div>
                <div className="text-[11px] text-slate-400">Shop name & Owner profile</div>
              </div>
            </div>

            {/* Connecting line */}
            <div className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />

            {/* Step 2 Pill */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                step === 2 ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-100' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 border border-slate-300'
              }`}>
                {step > 2 ? '✓' : '2'}
              </div>
              <div>
                <div className={`text-xs font-bold ${step === 2 ? 'text-blue-700' : 'text-slate-700'}`}>
                  Step 2: Add Inventory
                </div>
                <div className="text-[11px] text-slate-400">Stock & price listing</div>
              </div>
            </div>

            {/* Connecting line */}
            <div className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${step === 3 ? 'bg-emerald-600' : 'bg-slate-200'}`} />

            {/* Step 3 Pill */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                step === 3 ? 'bg-emerald-600 text-white shadow-md ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-300'
              }`}>
                {step === 3 ? '✓' : '3'}
              </div>
              <div>
                <div className={`text-xs font-bold ${step === 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
                  Step 3: Launch
                </div>
                <div className="text-[11px] text-slate-400">Live Dashboard</div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* ------------------- STEP 1: BUSINESS PROFILE ------------------- */}
        {step === 1 && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-lg space-y-6 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-2">
                <Store className="w-3.5 h-3.5" />
                <span>Enterprise Onboarding</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Enter Your Business & Store Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set up your digital wholesale ledger, GST identity, and Owner login credentials.
              </p>
            </div>

            <form onSubmit={handleProceedToStep2} className="space-y-4 text-xs">
              {/* Business Name & Owner Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Shop / Wholesale Enterprise Name *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={businessData.businessName}
                      onChange={(e) => setBusinessData({ ...businessData, businessName: e.target.value })}
                      placeholder="e.g. Honda Showroom & Spares"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Proprietor / Owner Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={businessData.ownerName}
                      onChange={(e) => setBusinessData({ ...businessData, ownerName: e.target.value })}
                      placeholder="e.g. Rishi Sharma"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Primary Mobile / Login Phone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={businessData.phone}
                      onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Owner Password / Security PIN *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={businessData.password}
                      onChange={(e) => setBusinessData({ ...businessData, password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* GSTIN & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    GSTIN Number (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={businessData.gstin}
                      onChange={(e) => setBusinessData({ ...businessData, gstin: e.target.value.toUpperCase() })}
                      placeholder="27AALPJ1122K1Z9"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold uppercase focus:bg-white focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    State of Registration
                  </label>
                  <select
                    value={businessData.stateCode}
                    onChange={(e) => setBusinessData({ ...businessData, stateCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-600"
                  >
                    <option value="27">27 - Maharashtra</option>
                    <option value="07">07 - Delhi</option>
                    <option value="24">24 - Gujarat</option>
                    <option value="29">29 - Karnataka</option>
                    <option value="09">09 - Uttar Pradesh</option>
                    <option value="33">33 - Tamil Nadu</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Market Location / Shop Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={businessData.address}
                    onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                    placeholder="e.g. Shop No. 14, Auto Spares Market, Pune"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* Continue Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 group"
                >
                  <span>Continue to Step 2: Add Inventory Items</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------- STEP 2: ADD INVENTORY & PRICE LISTING ------------------- */}
        {step === 2 && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-lg space-y-6 transition-all duration-300 animate-in fade-in slide-in-from-right-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-1">
                  <Package className="w-3.5 h-3.5" />
                  <span>Catalog Master Setup</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Add Initial Inventory, Stock & Price Listing
                </h2>
                <p className="text-xs text-slate-500">
                  Configure spare parts, wholesale rates, MRP, purchase costs, and bike compatibility.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Business Info</span>
              </button>
            </div>

            {/* Fast Presets Strip */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Click a Popular Preset to Auto-Fill:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_PARTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">₹{p.salePriceRupees}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Item Input Form */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">
                    Part Name / Description *
                  </label>
                  <input
                    type="text"
                    value={currentItem.name}
                    onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
                    placeholder="e.g. Front Disc Brake Pad Set (Brembo KBX)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Part Number / SKU
                  </label>
                  <input
                    type="text"
                    value={currentItem.partNumber}
                    onChange={(e) => setCurrentItem({ ...currentItem, partNumber: e.target.value })}
                    placeholder="BP-PULSAR-02"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Brand & Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={currentItem.brand}
                    onChange={(e) => setCurrentItem({ ...currentItem, brand: e.target.value })}
                    placeholder="e.g. ASK, Castrol, Exide"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Broad Category
                  </label>
                  <select
                    value={currentItem.category}
                    onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold"
                  >
                    <option value="Brakes & Friction">Brakes & Friction</option>
                    <option value="Engine & Transmission">Transmission & Drive</option>
                    <option value="Lubricants & Oils">Lubricants & Fluids</option>
                    <option value="Electrical & Battery">Electricals & Battery</option>
                    <option value="Body & Frame">Body & Chassis</option>
                    <option value="Tyres & Suspension">Tyres & Suspension</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Unit of Measure
                  </label>
                  <select
                    value={currentItem.unit}
                    onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold"
                  >
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="set">set (Set)</option>
                    <option value="kit">kit (Complete Kit)</option>
                    <option value="can">can (Oil Can)</option>
                    <option value="pair">pair</option>
                  </select>
                </div>
              </div>

              {/* Price Listing & Live Margin Calculator Strip */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">Price Listing & Margin Calculator:</span>
                  {sRate > pCost && (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs font-mono">
                      +{profitMargin}% Profit Margin (₹{profitPerUnit}/unit)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Wholesale Selling Rate (₹) *
                    </label>
                    <input
                      type="text"
                      required
                      value={currentItem.salePriceRupees}
                      onChange={(e) => setCurrentItem({ ...currentItem, salePriceRupees: e.target.value })}
                      placeholder="240.00"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-emerald-700 font-mono-numeric focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Purchase Cost (₹)
                    </label>
                    <input
                      type="text"
                      value={currentItem.purchasePriceRupees}
                      onChange={(e) => setCurrentItem({ ...currentItem, purchasePriceRupees: e.target.value })}
                      placeholder="180.00"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-900 font-mono-numeric focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      MRP / Retail Tag (₹)
                    </label>
                    <input
                      type="text"
                      value={currentItem.mrpRupees}
                      onChange={(e) => setCurrentItem({ ...currentItem, mrpRupees: e.target.value })}
                      placeholder="320.00"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-900 font-mono-numeric focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Stock Quantity & Bike Models */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Initial Stock Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentItem.stockQty}
                    onChange={(e) => setCurrentItem({ ...currentItem, stockQty: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">
                    Compatible Bike Models
                  </label>
                  <input
                    type="text"
                    value={currentItem.bikeModelsInput}
                    onChange={(e) => setCurrentItem({ ...currentItem, bikeModelsInput: e.target.value })}
                    placeholder="e.g. Hero Splendor, Honda Activa 6G"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Add item button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAddItemToBatch}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-sm transition flex items-center gap-1.5 text-xs"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Add Another Item to Batch</span>
                </button>
              </div>
            </div>

            {/* List of Batch Items Added */}
            {itemsList.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <div className="text-xs font-bold text-slate-800">
                  Listed Items in Your Catalog ({itemsList.length}):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {itemsList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.partNumber} • {item.stockQty} {item.unit} in stock
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-emerald-700">₹{item.salePriceRupees}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromBatch(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final Launch Button */}
            <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Saving Catalog & Launching...</span>
                ) : (
                  <>
                    <span>Complete Setup & View Live Dashboard 🚀</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ------------------- STEP 3: SETUP SUCCESS & AUTO-REDIRECT ------------------- */}
        {step === 3 && (
          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xl text-center space-y-5 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Enterprise Setup Complete!
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                <span className="font-bold text-slate-800">{businessData.businessName}</span> is now active with your listed inventory, category distribution, and khata ledger.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-md mx-auto text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Business Name:</span>
                <span className="font-bold text-slate-900">{businessData.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner / Login:</span>
                <span className="font-semibold text-slate-900">{businessData.ownerName} ({businessData.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Initial Parts Listed:</span>
                <span className="font-bold text-emerald-700">{itemsList.length + 1} catalog items</span>
              </div>
            </div>

            <div className="pt-3">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition inline-flex items-center gap-2"
              >
                <span>Go to Personalized Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
