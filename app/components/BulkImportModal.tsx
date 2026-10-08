'use client';

import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft,
  Search,
  Layers,
  FileText,
  Boxes,
  Sparkles
} from 'lucide-react';
import ClientPortal from '@/app/components/ClientPortal';

interface ParsedProductRow {
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
  isValid: boolean;
  warnings: string[];
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<'GUIDE' | 'UPLOAD' | 'PREVIEW'>('GUIDE');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [previewSearch, setPreviewSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Sample CSV Template content
  const sampleCSV = `Product Name,Part Number / SKU,Brand,Category,Unit,Cost Price (INR),Wholesale Price (INR),MRP (INR),Opening Stock,Reorder Level,GST %,HSN Code,Compatible Models
Castrol 4T 20W40 900ml,CAS-20W40-900,Castrol,Lubricants & Oils,ltr,280,350,410,24,10,18,2710,Universal / Multi-Fit
Front Brake Shoe Set,BS-HON-ACT-01,Honda Genuine,Brakes & Friction,set,160,220,270,40,15,18,8714,Honda Activa 6G / 5G / 4G
LED Headlight Bulb H4,LED-H4-35W,Philips,Electrical & Battery,pcs,320,480,599,15,5,18,8539,Honda Shine / Splendor / Pulsar
Drive V-Belt,BLT-ACT-99,Bando,Filters & Belts,pcs,210,310,380,20,8,18,4010,Honda Activa 125
Heavy Duty Spark Plug,SP-NGK-CR7E,NGK,Engine & Transmission,pcs,95,145,185,50,20,18,8511,Universal / All 2-Wheelers`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TradeLedger_Inventory_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV / TSV text parsing logic
  const parseSpreadsheetText = (text: string) => {
    try {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setErrorMsg('The uploaded file appears to be empty or missing header rows.');
        return;
      }

      // Simple CSV row parser handling quoted commas
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === '\t') && !inQuotes) {
            result.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Find column indices
      const findIdx = (keywords: string[]) => {
        return rawHeaders.findIndex(h => keywords.some(k => h.includes(k)));
      };

      const nameIdx = findIdx(['name', 'product', 'item', 'description', 'title']);
      const partNoIdx = findIdx(['part', 'sku', 'code', 'number', 'itemno']);
      const brandIdx = findIdx(['brand', 'make', 'company', 'manufacturer']);
      const categoryIdx = findIdx(['category', 'dept', 'department', 'group']);
      const unitIdx = findIdx(['unit', 'uom', 'measure']);
      const costIdx = findIdx(['cost', 'purchase', 'buy', 'cp']);
      const saleIdx = findIdx(['sale', 'selling', 'wholesale', 'price', 'rate', 'sp']);
      const mrpIdx = findIdx(['mrp', 'retail', 'maxretail']);
      const stockIdx = findIdx(['stock', 'qty', 'quantity', 'opening', 'count']);
      const reorderIdx = findIdx(['reorder', 'min', 'minimum', 'threshold', 'alert']);
      const gstIdx = findIdx(['gst', 'tax', 'ratebp']);
      const hsnIdx = findIdx(['hsn', 'sac']);
      const modelsIdx = findIdx(['model', 'fit', 'compatibility', 'vehicle', 'spec']);

      if (nameIdx === -1 && saleIdx === -1) {
        setErrorMsg('Could not detect required "Product Name" or "Price" columns. Please verify column headers or use our template.');
        return;
      }

      const rows: ParsedProductRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length === 0 || cols.every(c => !c)) continue;

        const name = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : '';
        const partNumber = partNoIdx >= 0 && cols[partNoIdx] ? cols[partNoIdx] : '';
        const brand = brandIdx >= 0 && cols[brandIdx] ? cols[brandIdx] : 'Standard';
        const category = categoryIdx >= 0 && cols[categoryIdx] ? cols[categoryIdx] : 'General Supplies';
        const unit = unitIdx >= 0 && cols[unitIdx] ? cols[unitIdx] : 'pcs';
        const costStr = costIdx >= 0 && cols[costIdx] ? cols[costIdx].replace(/[^0-9.]/g, '') : '0';
        const saleStr = saleIdx >= 0 && cols[saleIdx] ? cols[saleIdx].replace(/[^0-9.]/g, '') : costStr || '0';
        const mrpStr = mrpIdx >= 0 && cols[mrpIdx] ? cols[mrpIdx].replace(/[^0-9.]/g, '') : saleStr;
        const stockStr = stockIdx >= 0 && cols[stockIdx] ? cols[stockIdx].replace(/[^0-9]/g, '') : '10';
        const reorderStr = reorderIdx >= 0 && cols[reorderIdx] ? cols[reorderIdx].replace(/[^0-9]/g, '') : '5';
        const gstStr = gstIdx >= 0 && cols[gstIdx] ? cols[gstIdx].replace(/[^0-9.]/g, '') : '18';
        const hsnCode = hsnIdx >= 0 && cols[hsnIdx] ? cols[hsnIdx] : '8714';
        const modelsStr = modelsIdx >= 0 && cols[modelsIdx] ? cols[modelsIdx] : 'Universal / Multi-Fit';

        const warnings: string[] = [];
        let isValid = true;

        if (!name) {
          isValid = false;
          warnings.push('Missing product name');
        }
        if (!saleStr || Number(saleStr) <= 0) {
          warnings.push('Zero or missing selling price');
        }

        const gstPercent = Number(gstStr) || 18;
        const gstRateBp = gstPercent <= 1 ? Math.round(gstPercent * 10000) : Math.round(gstPercent * 100);

        rows.push({
          name: name || `Unnamed Item ${i}`,
          partNumber: partNumber || `SKU-${Date.now().toString(36).toUpperCase()}-${i}`,
          brand,
          category,
          hsnCode,
          gstRateBp,
          unit,
          purchasePriceRupees: costStr || '0',
          salePriceRupees: saleStr || '0',
          mrpRupees: mrpStr || saleStr,
          stockQty: parseInt(stockStr, 10) || 0,
          reorderLevel: parseInt(reorderStr, 10) || 5,
          models: modelsStr ? modelsStr.split(/[,/]/).map(m => m.trim()).filter(Boolean) : ['Universal / Multi-Fit'],
          isValid,
          warnings,
        });
      }

      if (rows.length === 0) {
        setErrorMsg('No valid product data rows found in spreadsheet.');
        return;
      }

      setParsedRows(rows);
      setErrorMsg(null);
      setActiveTab('PREVIEW');
    } catch (err: any) {
      setErrorMsg(`Failed to parse file: ${err.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseSpreadsheetText(text);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file. Please ensure it is a valid text, CSV, or TSV document.');
      setIsProcessing(false);
    };
    reader.readAsText(uploadedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    setFile(droppedFile);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseSpreadsheetText(text);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setErrorMsg('Error reading dropped file.');
      setIsProcessing(false);
    };
    reader.readAsText(droppedFile);
  };

  // Submit bulk ingestion to API
  const handleCommitImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('No valid rows available to import.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const payloadItems = validRows.map(r => ({
        name: r.name,
        partNumber: r.partNumber,
        brand: r.brand,
        category: r.category,
        hsnCode: r.hsnCode,
        gstRateBp: r.gstRateBp,
        unit: r.unit,
        purchasePricePaise: Math.round(Number(r.purchasePriceRupees || 0) * 100),
        salePricePaise: Math.round(Number(r.salePriceRupees || 0) * 100),
        mrpPaise: Math.round(Number(r.mrpRupees || r.salePriceRupees || 0) * 100),
        stockQty: r.stockQty,
        reorderLevel: r.reorderLevel,
        models: r.models,
      }));

      const res = await fetch('/api/v1/products/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk import failed');

      onSuccess(data.importedCount || validRows.length);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit inventory feed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered rows for preview search
  const filteredPreview = parsedRows.filter(r => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.partNumber.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  const totalUnits = parsedRows.reduce((sum, r) => sum + r.stockQty, 0);
  const totalValuation = parsedRows.reduce((sum, r) => sum + (Number(r.salePriceRupees || 0) * r.stockQty), 0);
  const validCount = parsedRows.filter(r => r.isValid).length;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8F9FA] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] flex items-center justify-center font-bold shadow-2xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Bulk Inventory Feed & Spreadsheet Importer</h2>
                <p className="text-[11px] text-[#64748B]">Import entire catalog & stock in bulk using Excel (.xlsx, .csv, .tsv)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-white rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Tabs */}
          <div className="px-5 py-2.5 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 sm:gap-3 text-xs">
              <button
                onClick={() => setActiveTab('GUIDE')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'GUIDE'
                    ? 'bg-[#C81E1E] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8F9FA]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>1. Format Guide & Template</span>
              </button>

              <button
                onClick={() => setActiveTab('UPLOAD')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'UPLOAD'
                    ? 'bg-[#C81E1E] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8F9FA]'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>2. Upload Spreadsheet</span>
              </button>

              <button
                onClick={() => setActiveTab('PREVIEW')}
                disabled={parsedRows.length === 0}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'PREVIEW'
                    ? 'bg-[#C81E1E] text-white shadow-2xs'
                    : parsedRows.length > 0 
                    ? 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8F9FA]'
                    : 'text-[#CBD5E1] cursor-not-allowed'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>3. Pre-Import Preview ({parsedRows.length})</span>
              </button>
            </div>

            <button
              onClick={handleDownloadSample}
              className="h-7 px-2.5 bg-[#F8F9FA] hover:bg-white text-[#0F172A] border border-[#CBD5E1] rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 shadow-2xs shrink-0"
              title="Download Excel / CSV template with sample data"
            >
              <Download className="w-3 h-3 text-[#C81E1E]" />
              <span>Download Sample Template</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mx-5 mt-3 p-3 bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#EF4444]" />
              <span className="flex-1 font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">
            
            {/* STEP 1: FORMAT GUIDE & TUTORIAL */}
            {activeTab === 'GUIDE' && (
              <div className="space-y-4">
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3.5 text-xs text-[#1E40AF] flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">How Bulk Inventory Ingestion Works</div>
                    <p className="text-[#3B82F6] leading-relaxed">
                      Instead of adding items one by one, you can upload your existing Excel sheet or supplier pricelist. Our smart parser automatically detects column headers, computes wholesale rates, and creates inventory records instantly.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border border-[#E2E8F0] rounded-lg p-3.5 bg-white space-y-2">
                    <div className="w-6 h-6 rounded-full bg-[#FEF2F2] text-[#C81E1E] font-bold text-xs flex items-center justify-center font-mono">1</div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Get the Template</h3>
                    <p className="text-[11px] text-[#64748B]">
                      Download our pre-formatted spreadsheet template with ready-made columns and example data.
                    </p>
                  </div>

                  <div className="border border-[#E2E8F0] rounded-lg p-3.5 bg-white space-y-2">
                    <div className="w-6 h-6 rounded-full bg-[#FEF2F2] text-[#C81E1E] font-bold text-xs flex items-center justify-center font-mono">2</div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Fill in Excel / Sheets</h3>
                    <p className="text-[11px] text-[#64748B]">
                      Paste your products, SKUs, wholesale prices, MRP, and opening stock counts into the sheet.
                    </p>
                  </div>

                  <div className="border border-[#E2E8F0] rounded-lg p-3.5 bg-white space-y-2">
                    <div className="w-6 h-6 rounded-full bg-[#FEF2F2] text-[#C81E1E] font-bold text-xs flex items-center justify-center font-mono">3</div>
                    <h3 className="text-xs font-bold text-[#0F172A]">Upload & Preview</h3>
                    <p className="text-[11px] text-[#64748B]">
                      Drag and drop your saved spreadsheet. Review the parsed numbers and click Ingest to go live!
                    </p>
                  </div>
                </div>

                {/* Column Structure Table */}
                <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-[#F8F9FA] border-b border-[#E2E8F0] font-bold text-xs text-[#0F172A] uppercase tracking-wider">
                    Required & Optional Spreadsheet Columns
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] text-[#64748B] border-b border-[#E2E8F0] text-[10px] uppercase font-semibold">
                          <th className="py-2 px-3">Column Name</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Example Values</th>
                          <th className="py-2 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-[#0F172A]">Product Name</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#B91C1C]">Required</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">Castrol 4T 20W40 900ml</td>
                          <td className="py-2 px-3 text-[#64748B]">Full descriptive title of the item</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-bold text-[#0F172A]">Wholesale Price (INR)</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#B91C1C]">Required</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">350</td>
                          <td className="py-2 px-3 text-[#64748B]">Default selling rate to B2B clients</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">Part Number / SKU</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">Optional</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">CAS-20W40-900</td>
                          <td className="py-2 px-3 text-[#64748B]">Auto-generated if left empty</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">Cost Price (INR)</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">Optional</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">280</td>
                          <td className="py-2 px-3 text-[#64748B]">Purchase cost for asset valuation</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">MRP (INR)</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">Optional</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">410</td>
                          <td className="py-2 px-3 text-[#64748B]">Maximum Retail Price on packet</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">Opening Stock</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">Optional</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">24</td>
                          <td className="py-2 px-3 text-[#64748B]">Initial shelf stock count (defaults to 10)</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">Category / Brand / Unit</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">Optional</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">Lubricants, Castrol, ltr</td>
                          <td className="py-2 px-3 text-[#64748B]">Organizes items in search & POS filters</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">GST % & HSN</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">Optional</span></td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">18, 2710</td>
                          <td className="py-2 px-3 text-[#64748B]">Tax rates for GST invoice compliance</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleDownloadSample}
                    className="h-8 px-3.5 bg-white hover:bg-[#F8F9FA] text-[#0F172A] border border-[#CBD5E1] rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C81E1E]" />
                    <span>Download Excel / CSV Template</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('UPLOAD')}
                    className="h-8 px-4 bg-[#C81E1E] hover:bg-[#A81818] text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Proceed to Upload</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DRAG & DROP UPLOAD */}
            {activeTab === 'UPLOAD' && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.tsv,.txt,.xlsx,.xls"
                  className="hidden"
                />

                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#CBD5E1] hover:border-[#C81E1E] bg-[#F8F9FA] hover:bg-white rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white group-hover:bg-[#FEF2F2] border border-[#CBD5E1] group-hover:border-[#FECACA] flex items-center justify-center text-[#64748B] group-hover:text-[#C81E1E] transition mb-3 shadow-xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    Click to browse or drag & drop your inventory sheet here
                  </div>
                  <p className="text-xs text-[#64748B] mt-1 max-w-sm">
                    Supports Microsoft Excel CSV, Tab-Delimited TSV, or plain text spreadsheet exports
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#475569] border border-[#E2E8F0]">
                      .CSV
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#475569] border border-[#E2E8F0]">
                      .XLSX / .XLS
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#475569] border border-[#E2E8F0]">
                      .TSV
                    </span>
                  </div>
                </div>

                {file && (
                  <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#15803D] font-medium">
                      <FileText className="w-4 h-4" />
                      <span>Loaded: <strong className="text-[#0F172A]">{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('PREVIEW')}
                      disabled={parsedRows.length === 0}
                      className="px-3 py-1 bg-[#16A34A] text-white rounded text-xs font-semibold hover:bg-[#15803D] transition flex items-center gap-1 shadow-2xs"
                    >
                      <span>Preview Items ({parsedRows.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: PRE-IMPORT PREVIEW & VALIDATION TABLE */}
            {activeTab === 'PREVIEW' && (
              <div className="space-y-3">
                {/* Summary Metrics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-[#64748B]">Total Rows Found</div>
                    <div className="text-base font-bold font-mono text-[#0F172A] mt-0.5">{parsedRows.length} Items</div>
                  </div>
                  <div className="p-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-[#15803D]">Valid to Ingest</div>
                    <div className="text-base font-bold font-mono text-[#16A34A] mt-0.5">{validCount} SKUs</div>
                  </div>
                  <div className="p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-[#1D4ED8]">Total Physical Units</div>
                    <div className="text-base font-bold font-mono text-[#2563EB] mt-0.5">{totalUnits} Units</div>
                  </div>
                  <div className="p-2.5 bg-[#FAF5FF] border border-[#E9D5FF] rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-[#7E22CE]">Est. Inventory Value</div>
                    <div className="text-base font-bold font-mono text-[#9333EA] mt-0.5">₹{totalValuation.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                {/* Search in preview */}
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      placeholder="Filter preview items..."
                      className="w-full h-8 pl-9 pr-3 text-xs bg-[#F8F9FA] border border-[#CBD5E1] rounded-md focus:bg-white focus:border-[#C81E1E] outline-hidden transition"
                    />
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    Showing {filteredPreview.length} of {parsedRows.length} rows
                  </span>
                </div>

                {/* Data Table */}
                <div className="border border-[#E2E8F0] rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#F8F9FA] z-10">
                      <tr className="border-b border-[#E2E8F0] text-[#64748B] text-[10px] uppercase font-semibold">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Part / SKU</th>
                        <th className="py-2.5 px-3">Brand / Category</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3 text-right">Cost (₹)</th>
                        <th className="py-2.5 px-3 text-right">Wholesale (₹)</th>
                        <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-xs">
                      {filteredPreview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F8F9FA] transition">
                          <td className="py-2 px-3 font-mono text-[11px] text-[#64748B]">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-[#0F172A]">{row.name}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">{row.partNumber}</td>
                          <td className="py-2 px-3 text-[#64748B] text-[11px]">
                            {row.brand} · <span className="text-[#0F172A]">{row.category}</span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-[#0F172A]">
                            {row.stockQty} {row.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-[#64748B]">
                            ₹{row.purchasePriceRupees}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#0F172A] tabular-nums">
                            ₹{row.salePriceRupees}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-[#64748B]">
                            ₹{row.mrpRupees}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isValid ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]" title={row.warnings.join(', ')}>
                                Incomplete
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8F9FA] flex items-center justify-between">
            <div>
              {activeTab === 'PREVIEW' && (
                <button
                  onClick={() => setActiveTab('UPLOAD')}
                  className="h-8 px-3 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="h-8 px-3.5 bg-white hover:bg-[#F8F9FA] text-[#475569] border border-[#CBD5E1] rounded-md text-xs font-medium transition"
              >
                Cancel
              </button>

              {activeTab === 'PREVIEW' ? (
                <button
                  onClick={handleCommitImport}
                  disabled={isProcessing || validCount === 0}
                  className="h-8 px-4 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessing ? 'Ingesting Inventory...' : `Confirm & Ingest (${validCount} SKUs)`}</span>
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab(activeTab === 'GUIDE' ? 'UPLOAD' : 'PREVIEW')}
                  disabled={activeTab === 'UPLOAD' && parsedRows.length === 0}
                  className="h-8 px-4 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-60 text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <span>{activeTab === 'GUIDE' ? 'Next: Upload Sheet' : 'Next: Preview Items'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </ClientPortal>
  );
}
