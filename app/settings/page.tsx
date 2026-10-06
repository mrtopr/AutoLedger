'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { 
  Building2, 
  Store, 
  CreditCard, 
  FileText, 
  Check, 
  Save, 
  AlertCircle, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  QrCode,
  Percent,
  Sparkles,
  RefreshCw,
  Eye,
  Download,
  UploadCloud,
  Database,
  HardDrive,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import InvoicePreviewModal, { InvoicePreviewData } from '@/app/components/InvoicePreviewModal';

const INDIAN_STATES = [
  '01 - Jammu and Kashmir',
  '02 - Himachal Pradesh',
  '03 - Punjab',
  '04 - Chandigarh',
  '06 - Haryana',
  '07 - Delhi',
  '08 - Rajasthan',
  '09 - Uttar Pradesh',
  '10 - Bihar',
  '18 - Assam',
  '19 - West Bengal',
  '20 - Jharkhand',
  '21 - Odisha',
  '22 - Chhattisgarh',
  '23 - Madhya Pradesh',
  '24 - Gujarat',
  '27 - Maharashtra',
  '29 - Karnataka',
  '32 - Kerala',
  '33 - Tamil Nadu',
  '36 - Telangana',
  '37 - Andhra Pradesh',
];

export default function SettingsPage() {
  const { tenant, updateTenantProfile } = useAuth();
  const { t, language } = useLanguage();

  // Form states initialized with tenant data
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('27 - Maharashtra');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  
  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // Invoice & Print Settings
  const [invoicePrefix, setInvoicePrefix] = useState('INV/2026-27/');
  const [terms, setTerms] = useState(
    '1. Goods once sold will not be accepted back without original tax invoice.\n2. Parts covered under OEM warranty only. Interest @ 18% p.a. on overdue credit.'
  );
  const [defaultGstRate, setDefaultGstRate] = useState('18');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Backup & Disaster Recovery state
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backupToast, setBackupToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<any | null>(null);

  const showBackupToast = (type: 'success' | 'error', message: string) => {
    setBackupToast({ type, message });
    setTimeout(() => setBackupToast(null), 4000);
  };

  const handleDownloadBackup = async () => {
    try {
      setIsExportingBackup(true);
      const res = await fetch('/api/v1/backup');
      const json = await res.json();

      if (!res.ok || !json.backup) {
        throw new Error(json.error || 'Failed to generate database snapshot');
      }

      const blob = new Blob([JSON.stringify(json.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.href = url;
      link.download = `AutoLedger_ERP_Backup_${now}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showBackupToast('success', 'Complete database backup downloaded successfully');
    } catch (err: any) {
      console.error('Download backup error:', err);
      showBackupToast('error', err.message || 'Error downloading backup');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleFeedBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to feed and restore backup from "${file.name}"? This will synchronize all products, customers, invoices, and settings.`)) {
      e.target.value = '';
      return;
    }

    try {
      setIsRestoringBackup(true);
      const text = await file.text();
      const parsedData = JSON.parse(text);

      const res = await fetch('/api/v1/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsedData }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to restore backup data');
      }

      setRestoreSummary(result.restoredStats);
      showBackupToast('success', 'Database and system restored successfully from backup');
    } catch (err: any) {
      console.error('Feed backup error:', err);
      showBackupToast('error', err.message || 'Failed to parse or restore backup file');
    } finally {
      setIsRestoringBackup(false);
      e.target.value = '';
    }
  };

  // Sync state when tenant loads
  useEffect(() => {
    if (tenant) {
      setName(tenant.name || 'Shree Vishwakarma Honda');
      setLegalName(tenant.legalName || 'Shree Honda');
      const loadedState = tenant.stateCode || '10 - Bihar';
      setStateCode(loadedState);

      const statePrefix = loadedState.slice(0, 2);
      let initialGstin = tenant.gstin || `${statePrefix}ABCDE1234F1Z5`;
      if (statePrefix && initialGstin.startsWith('27') && statePrefix !== '27') {
        initialGstin = statePrefix + initialGstin.slice(2);
      }
      setGstin(initialGstin);

      setAddress(tenant.address || 'Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125');
      setPhone(tenant.phone || '+91 9822100001');
      setEmail(tenant.email || 'honda@gmail.com');
      setUpiId(tenant.upiId || 'hondarishi@okhdfcbank');

      const bank = tenant.bankDetails || {};
      setBankName(bank.bankName || 'HDFC Bank');
      setAccountNumber(bank.accountNumber || '50200012345678');
      setIfscCode(bank.ifscCode || 'HDFC0001234');

      const settings = tenant.settings || {};
      if (settings.invoicePrefix) setInvoicePrefix(settings.invoicePrefix);
      if (settings.terms) setTerms(settings.terms);
      if (settings.defaultGstRate) setDefaultGstRate(settings.defaultGstRate);
    } else {
      // Fallback defaults for Shree Vishwakarma Honda
      setName('Shree Vishwakarma Honda');
      setLegalName('Shree Honda');
      setStateCode('10 - Bihar');
      setGstin('10ABCDE1234F1Z5');
      setAddress('Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125');
      setPhone('+91 9822100001');
      setEmail('honda@gmail.com');
      setUpiId('hondarishi@okhdfcbank');
      setBankName('HDFC Bank');
      setAccountNumber('50200012345678');
      setIfscCode('HDFC0001234');
    }
  }, [tenant]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const updates = {
        name: name.trim(),
        legalName: legalName.trim(),
        gstin: gstin.trim().toUpperCase(),
        address: address.trim(),
        stateCode: stateCode.trim(),
        phone: phone.trim(),
        email: email.trim(),
        upiId: upiId.trim(),
        bankDetails: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
        },
        settings: {
          invoicePrefix: invoicePrefix.trim(),
          terms: terms.trim(),
          defaultGstRate,
        },
      };

      const res = await updateTenantProfile(updates);

      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to save changes');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Sample data for Live Invoice Preview
  const sampleInvoice: InvoicePreviewData = {
    invoiceNumber: `${invoicePrefix}0042`,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: '10:30 am',
    placeOfSupply: stateCode,
    customer: {
      name: 'Ramesh Auto Works & Garage',
      shopName: 'Ramesh Auto Works & Garage',
      phone: '+91 9822100099',
      address: 'Shop 4, Market Yard, Pune - 411037',
      gstin: '27AALPJ1122K1Z9',
    },
    items: [
      {
        name: 'Drive Chain & Sprocket Kit',
        partNumber: '40530-KTC-900',
        hsnCode: '8714',
        qty: 2,
        unit: 'set',
        ratePaise: 125000,
        rateRupees: '1,250.00',
        gstRateBp: 1800,
        totalPaise: 295000,
      },
      {
        name: 'Front Brake Pad Set OEM',
        partNumber: '06455-KPP-901',
        hsnCode: '8714',
        qty: 1,
        unit: 'set',
        ratePaise: 45000,
        rateRupees: '450.00',
        gstRateBp: 1800,
        totalPaise: 53100,
      },
    ],
    taxableValuePaise: 295000,
    cgstPaise: 26550,
    sgstPaise: 26550,
    totalTaxPaise: 53100,
    grandTotalPaise: 348100,
    paidNowPaise: 348100,
    creditBalancePaise: 0,
    tenant: {
      name: name || 'Shree Vishwakarma Honda',
      legalName: legalName || 'Shree Honda',
      address: address || 'Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125',
      gstin: gstin || '10ABCDE1234F1Z5',
      phone: phone || '+91 9822100001',
      email: email || 'honda@gmail.com',
      stateCode: stateCode || '10 - Bihar',
      bankName: bankName || 'HDFC Bank',
      accountNumber: accountNumber || '50200012345678',
      ifscCode: ifscCode || 'HDFC0001234',
      upiId: upiId || 'hondarishi@okhdfcbank',
    },
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Store className="w-6 h-6 text-[#DC2626]" />
            <span>{t('set.title', 'Dealership & System Settings')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('set.subtitle', 'Edit dealership branding, official GST details, bank settlement, and single-page invoice templates.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-300 shadow-2xs transition"
          >
            <Eye className="w-4 h-4 text-slate-700" />
            <span>{language === 'hi' ? 'बिल प्रीव्यू देखें' : 'Preview Live Invoice'}</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{language === 'hi' ? 'सुरक्षित हो रहा है...' : 'Saving Changes...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t('set.save_settings', 'Save All Changes')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Dealership profile & invoice format saved successfully! All POS bills and PDFs now use your updated details.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-800 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 0. LANGUAGE & REGIONAL PREFERENCES */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#DC2626]" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {language === 'hi' ? 'भाषा एवं क्षेत्रीय सेटिंग्स' : 'Language & Regional Preferences'}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {language === 'hi' ? 'तुरंत भाषा बदलें' : 'Instant live switch'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900">
              {language === 'hi' ? 'एप्लिकेशन भाषा (App Display Language)' : 'Application Display Language'}
            </div>
            <p className="text-[11px] text-slate-500">
              {language === 'hi' 
                ? 'सभी मेनू, बिलिंग काउंटर, स्टॉक, खाता बही और रिपोर्ट्स के लिए भाषा चुनें।' 
                : 'Switch between English and Hindi across the entire ERP, dashboard, billing, and reports.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition ${
                language === 'en'
                  ? 'bg-white text-blue-700 border-blue-400 shadow-xs ring-2 ring-blue-500/10'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition ${
                language === 'hi'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              हिन्दी (Hindi)
            </button>
          </div>
        </div>
      </div>

      {/* 1. DEALERSHIP & TRADE PROFILE */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Dealership & Legal Entity
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Prints on top header of every invoice</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Showroom / Trade Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Royal Auto Spares & Wholesalers"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:bg-slate-50 focus:border-blue-600 transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Displayed boldly as company header on invoices & topbar</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Legal Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. AutoLedger Spares Pvt Ltd"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-800 focus:bg-slate-50 focus:border-blue-600 transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Registered GST entity legal name</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              GSTIN (15 Digits) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27ABCDE1234F1Z5"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 uppercase focus:bg-slate-50 focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              State & GST State Code <span className="text-red-500">*</span>
            </label>
            <select
              value={stateCode}
              onChange={(e) => {
                const newState = e.target.value;
                setStateCode(newState);
                const prefix = newState.slice(0, 2);
                if (prefix && gstin && /^\d{2}/.test(gstin)) {
                  setGstin(prefix + gstin.slice(2));
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-800 focus:bg-slate-50 focus:border-blue-600 transition"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Contact Phone / WhatsApp <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98221 00001"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-2.5 font-mono font-medium text-slate-900 focus:bg-slate-50 focus:border-blue-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Billing Email Address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@royalauto.com"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-2.5 font-medium text-slate-900 focus:bg-slate-50 focus:border-blue-600 transition"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">
              Market / Showroom Full Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No. 12-15, Nana Peth Auto Market, Pune, Maharashtra - 411002"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-2.5 font-medium text-slate-900 focus:bg-slate-50 focus:border-blue-600 transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. DIRECT BANK SETTLEMENT & UPI QR */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bank Settlement & UPI Details
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Printed on invoice bottom for customer payments</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Bank Name
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. HDFC Bank / State Bank of India"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-800 focus:bg-slate-50 focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Bank Account Number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 50200012345678"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 focus:bg-slate-50 focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              IFSC Code
            </label>
            <input
              type="text"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 uppercase focus:bg-slate-50 focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              UPI ID / VPA
            </label>
            <div className="relative">
              <QrCode className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. royalauto@okhdfcbank"
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-2.5 font-mono font-bold text-blue-700 focus:bg-slate-50 focus:border-blue-600 transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. INVOICE SERIES, TAX & PRINTING FORMAT */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Invoice Series & Terms & Conditions
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Controls bill number sequence & legal notices</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Invoice Prefix Sequence
            </label>
            <input
              type="text"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="e.g. INV/2026-27/ or ROYAL-"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 focus:bg-slate-50 focus:border-blue-600 transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">New invoices generate as {invoicePrefix}0001, etc.</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Default GST Rate for Spare Parts
            </label>
            <div className="relative">
              <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <select
                value={defaultGstRate}
                onChange={(e) => setDefaultGstRate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-2.5 font-bold text-slate-800 focus:bg-slate-50 focus:border-blue-600 transition"
              >
                <option value="18">18% (Standard 2-Wheeler Spares & Lubricants)</option>
                <option value="28">28% (Automotive Assemblies & High-End Parts)</option>
                <option value="12">12% (Agricultural & Select Parts)</option>
                <option value="5">5% (Essential Products)</option>
              </select>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">
              Invoice Terms & Conditions (Legal Footnote)
            </label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Enter dealer terms, warranty clauses, and return policy..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 text-xs font-normal focus:bg-slate-50 focus:border-blue-600 transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Printed on the bottom-left of every 1-page A4 GST Tax Invoice</span>
          </div>
        </div>
      </div>

      {/* 5. Database Backup & Disaster Recovery Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                Database Backup & Disaster Recovery
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Crash Protection
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Take an offline snapshot of all inventory, customers, khata ledgers, and invoices or feed an existing backup to restore.
              </p>
            </div>
          </div>
        </div>

        {/* Toast for backup actions */}
        {backupToast && (
          <div className={`mb-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            backupToast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {backupToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{backupToast.message}</span>
          </div>
        )}

        {/* Restore Result Summary */}
        {restoreSummary && (
          <div className="mb-4 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900">
            <div className="font-semibold text-blue-950 mb-1">Restoration Summary:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-medium text-slate-700 mt-2">
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[10px]">Products Synced</span>
                <span className="font-bold text-slate-900 font-mono">{restoreSummary.products}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[10px]">Customers Synced</span>
                <span className="font-bold text-slate-900 font-mono">{restoreSummary.customers}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[10px]">Tenants Synced</span>
                <span className="font-bold text-slate-900 font-mono">{restoreSummary.tenants}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[10px]">Status</span>
                <span className="font-bold text-emerald-700">100% Online</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Take / Download Backup */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs mb-1">
                <HardDrive className="w-4 h-4 text-slate-700" />
                <span>{language === 'hi' ? 'विकल्प 1: पूरा डेटा बैकअप डाउनलोड करें' : 'Option 1: Take Complete Data Backup'}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {language === 'hi' 
                  ? 'आपके सभी प्रोडक्ट्स, स्टॉक, ग्राहक खाता, बिल व भुगतान का सुरक्षित .json बैकअप डाउनलोड करता है।' 
                  : 'Exports your entire database & records (Products, Stock Logs, Customer Khatas, Invoices, Payment history) into a portable .json file.'}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{language === 'hi' ? 'सुरक्षित ऑफलाइन कॉपी' : 'Safe offline copy'}</span>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isExportingBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg shadow-2xs transition"
              >
                {isExportingBackup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'hi' ? 'बैकअप बन रहा है...' : 'Exporting Snapshot...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('set.download_backup', 'Download Full Backup (.json)')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Feed / Restore Backup */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs mb-1">
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>{language === 'hi' ? 'विकल्प 2: बैकअप फाइल से डेटा रीस्टोर करें' : 'Option 2: Feed & Restore from Backup'}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {language === 'hi'
                  ? 'सिस्टम क्रैश या बदलने की स्थिति में पहले से मौजूद बैकअप JSON फाइल अपलोड करके डेटा वापस लाएं।'
                  : 'In case of device crash, system change, or database corruption, upload a previous backup file to restore and sync all records back into database.'}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{language === 'hi' ? 'तत्काल सिंक' : 'Instant DB sync'}</span>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg shadow-2xs transition cursor-pointer">
                {isRestoringBackup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'hi' ? 'डेटा रीस्टोर हो रहा है...' : 'Restoring & Syncing DB...'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{t('set.restore_backup', 'Feed Backup File')}</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFeedBackupFile}
                  disabled={isRestoringBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{language === 'hi' ? 'सभी बदलाव तत्काल लागू होंगे।' : 'Changes apply instantly to all new bills, invoices, PDFs, and WhatsApp shares.'}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-lg transition"
          >
            {language === 'hi' ? 'बिल प्रीव्यू देखें' : 'Preview Invoice'}
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-6 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{language === 'hi' ? 'सुरक्षित हो रहा है...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t('set.save_settings', 'Save All Settings')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={sampleInvoice}
      />
    </form>
  );
}
