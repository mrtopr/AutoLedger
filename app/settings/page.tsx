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
  CheckCircle2,
  Lock,
  Key,
  Copy,
  ExternalLink,
  Globe,
  Shield,
  Zap,
  Landmark,
  Hash,
  ChevronDown,
  Layers,
  FileCode
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
  const { t, language, setLanguage } = useLanguage();

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

  // Razorpay Gateway Settings
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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
      link.download = `TradeLedger_ERP_Backup_${now}.json`;
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
      if (settings.razorpayKeyId) setRazorpayKeyId(settings.razorpayKeyId);
      if (settings.razorpayKeySecret) setRazorpayKeySecret(settings.razorpayKeySecret);
      if (settings.razorpayWebhookSecret) setRazorpayWebhookSecret(settings.razorpayWebhookSecret);
    } else {
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
          razorpayKeyId: razorpayKeyId.trim(),
          razorpayKeySecret: razorpayKeySecret.trim(),
          razorpayWebhookSecret: razorpayWebhookSecret.trim(),
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
    <form onSubmit={handleSave} className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-none p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                {t('set.title', 'Dealership Configuration & System Settings')}
              </h1>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {t('set.subtitle', 'Configure dealership master identity, GSTIN registration, bank accounts, and print invoice templates.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="h-8 px-3.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] font-medium text-xs rounded-none border border-[#CBD5E1] transition inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Preview Invoice</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="h-8 px-4 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-60 text-white font-semibold text-xs rounded-none shadow-2xs transition inline-flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{t('set.save_settings', 'Save Changes')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-none flex items-center gap-2 text-[#15803D] text-xs font-medium">
          <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>Settings saved successfully. All POS counter bills and invoices are now using your updated parameters.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-none flex items-center gap-2 text-[#B91C1C] text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. COMPANY & BUSINESS PROFILE */}
      <div className="bg-white border border-[#E2E8F0] rounded-none p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#C81E1E]" />
            <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              Company & Legal Entity Details
            </h2>
          </div>
          <span className="text-[11px] text-[#64748B]">Prints on invoice header</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Showroom / Trade Name
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Store className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Auto Spares & Wholesalers"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-semibold text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Legal Business Entity Name
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Apex Trade & Wholesale Pvt Ltd"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                GSTIN (15-Digit Identifier)
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27ABCDE1234F1Z5"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono font-bold text-[#0F172A] uppercase placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs tracking-wider"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                State & GST State Code
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <MapPin className="w-4 h-4" />
              </div>
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
                className="w-full h-9 pl-9 pr-8 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-medium text-[#0F172A] appearance-none cursor-pointer transition-all outline-hidden shadow-2xs"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 w-4 h-4 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Contact Phone / WhatsApp
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98221 00001"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono font-medium text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Billing Email Address
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">OPTIONAL</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@royalauto.com"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Showroom / Workshop Address
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No. 12-15, Main Auto Market, Pune, Maharashtra - 411002"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. DIRECT BANK SETTLEMENT & UPI QR */}
      <div className="bg-white border border-[#E2E8F0] rounded-none p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              Bank Settlement & Counter UPI
            </h2>
          </div>
          <span className="text-[11px] text-[#64748B]">Printed on invoice footer</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Bank Name
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">OPTIONAL</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Landmark className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank / State Bank of India"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Bank Account Number
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">OPTIONAL</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 50200012345678"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono font-bold text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                IFSC Code
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">OPTIONAL</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono font-bold text-[#0F172A] uppercase placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                UPI VPA / ID
              </label>
              <span className="text-[10px] font-mono text-[#2563EB] font-semibold">DYNAMIC QR</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#2563EB] transition-colors pointer-events-none">
                <QrCode className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. royalauto@okhdfcbank"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 rounded-md text-xs font-mono font-bold text-[#2563EB] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. RAZORPAY GATEWAY */}
      <div className="bg-white border border-[#E2E8F0] rounded-none p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#16A34A]" />
            <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
              <span>Razorpay Payment Gateway API</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                razorpayKeyId.startsWith('rzp_live') 
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' 
                  : 'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]'
              }`}>
                {razorpayKeyId.startsWith('rzp_live') ? 'LIVE PRODUCTION' : 'TEST SANDBOX'}
              </span>
            </h2>
          </div>
          <a
            href="https://dashboard.razorpay.com/app/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#2563EB] hover:underline font-medium"
          >
            <span>Razorpay Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Razorpay Key ID
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">PUBLIC KEY</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value.trim())}
                placeholder="rzp_test_... or rzp_live_..."
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Razorpay Key Secret
              </label>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-[10px] text-[#2563EB] hover:text-[#1D4ED8] font-semibold transition cursor-pointer"
              >
                {showSecret ? 'Hide Secret' : 'Reveal Secret'}
              </button>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showSecret ? 'text' : 'password'}
                value={razorpayKeySecret}
                onChange={(e) => setRazorpayKeySecret(e.target.value.trim())}
                placeholder="••••••••••••••••••••••••"
                className="w-full h-9 pl-9 pr-10 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 text-[#94A3B8] hover:text-[#0F172A] transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Webhook Secret (Instant Reconciler)
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">FOR INSTANT WEBHOOKS</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Shield className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={razorpayWebhookSecret}
                onChange={(e) => setRazorpayWebhookSecret(e.target.value.trim())}
                placeholder="e.g. tradeledger_webhook_secret_2026"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Webhook Endpoint Display */}
        <div className="p-3.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#0F172A] flex items-center gap-1.5 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-[#2563EB]" />
              Razorpay Webhook Callback URL
            </span>
            <button
              type="button"
              onClick={() => {
                const url = typeof window !== 'undefined' 
                  ? `${window.location.origin}/api/v1/webhooks/razorpay` 
                  : 'https://tradeledger.app/api/v1/webhooks/razorpay';
                navigator.clipboard.writeText(url);
                setCopiedWebhook(true);
                setTimeout(() => setCopiedWebhook(false), 3000);
              }}
              className="h-7 px-3 bg-white hover:bg-[#F1F5F9] text-[#334155] text-[11px] font-semibold rounded-md border border-[#CBD5E1] shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>
          <p className="text-[11px] text-[#475569] font-mono bg-white p-2.5 rounded-md border border-[#CBD5E1] break-all select-all shadow-2xs">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/webhooks/razorpay` : 'https://tradeledger.app/api/v1/webhooks/razorpay'}
          </p>
        </div>
      </div>

      {/* 4. INVOICE SERIES & TERMS */}
      <div className="bg-white border border-[#E2E8F0] rounded-none p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C81E1E]" />
            <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              Invoice Series & Terms & Conditions
            </h2>
          </div>
          <span className="text-[11px] text-[#64748B]">Sequence numbering</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Invoice Prefix Sequence
              </label>
              <span className="text-[10px] font-mono text-[#DC2626] font-semibold">REQUIRED</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <FileCode className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="e.g. INV/2026-27/ or ROYAL-"
                className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-mono font-bold text-[#0F172A] placeholder:text-[#94A3B8] placeholder:font-normal transition-all outline-hidden shadow-2xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Default GST Rate for Spares
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">FALLBACK</span>
            </div>
            <div className="relative flex items-center group">
              <div className="absolute left-3 text-[#94A3B8] group-focus-within:text-[#C81E1E] transition-colors pointer-events-none">
                <Percent className="w-4 h-4" />
              </div>
              <select
                value={defaultGstRate}
                onChange={(e) => setDefaultGstRate(e.target.value)}
                className="w-full h-9 pl-9 pr-8 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs font-medium text-[#0F172A] appearance-none cursor-pointer transition-all outline-hidden shadow-2xs"
              >
                <option value="18">18% (Standard 2-Wheeler Spares & Lubricants)</option>
                <option value="28">28% (Automotive Assemblies & High-End Parts)</option>
                <option value="12">12% (Agricultural & Select Parts)</option>
                <option value="5">5% (Essential Products)</option>
              </select>
              <ChevronDown className="absolute right-3 w-4 h-4 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Invoice Terms & Conditions (Footer Footnote)
              </label>
              <span className="text-[10px] font-mono text-[#64748B]">POLICY</span>
            </div>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Enter dealer terms, warranty clauses, and return policy..."
              className="w-full p-3 bg-[#F8FAFC] hover:bg-[#F1F5F9]/70 focus:bg-white border border-[#CBD5E1] focus:border-[#C81E1E] focus:ring-2 focus:ring-[#C81E1E]/15 rounded-md text-xs text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-hidden shadow-2xs leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* 5. DATABASE BACKUP & DISASTER RECOVERY */}
      <div className="bg-white border border-[#E2E8F0] rounded-none p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              Database Backup & Disaster Recovery
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] font-semibold">
            OFFLINE READY
          </span>
        </div>

        {backupToast && (
          <div className={`p-3 rounded-md border text-xs font-medium flex items-center gap-1.5 ${
            backupToast.type === 'success' ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
          }`}>
            {backupToast.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{backupToast.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Download */}
          <div className="border border-[#E2E8F0] rounded-md p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9]/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[#475569]" />
                <span>Download Database Snapshot</span>
              </div>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Exports all products, customers, khata balances, and invoices into a portable .json file.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isExportingBackup}
                className="h-8.5 px-4 bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-60 text-white text-xs font-semibold rounded-md shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingBackup ? 'Exporting...' : 'Export Backup (.json)'}</span>
              </button>
            </div>
          </div>

          {/* Restore */}
          <div className="border border-[#E2E8F0] rounded-md p-4 bg-[#F8FAFC] hover:bg-[#F1F5F9]/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Restore from Backup File</span>
              </div>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Upload an existing backup .json file to resynchronize all tables and data records.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex justify-end">
              <label className="h-8.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-md shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isRestoringBackup ? 'Restoring...' : 'Feed Backup File'}</span>
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

      {/* Live Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={sampleInvoice}
      />
    </form>
  );
}
