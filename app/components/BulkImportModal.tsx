'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  FileText, 
  Layers, 
  Sparkles, 
  Tag, 
  HelpCircle, 
  Boxes, 
  Settings2, 
  Search, 
  Trash2, 
  CheckSquare, 
  Square, 
  RefreshCw, 
  PlusCircle, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Check, 
  Building2, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  FolderTree
} from 'lucide-react';
import ClientPortal from './ClientPortal';
import { 
  parseTallyInventorySheet, 
  TallyParseResult, 
  TallyParsedItem 
} from '@/app/lib/tallyParser';

// Target field assignments for spreadsheet columns
export type TargetField = 
  | 'NAME' 
  | 'PART_NUMBER' 
  | 'BRAND' 
  | 'CATEGORY' 
  | 'SALE_PRICE' 
  | 'COST_PRICE' 
  | 'MRP' 
  | 'STOCK_QTY' 
  | 'AMOUNT' 
  | 'UNIT' 
  | 'GST_RATE' 
  | 'HSN_CODE' 
  | 'MODELS' 
  | 'IGNORE';

interface ColumnMapping {
  colIndex: number;
  rawHeader: string;
  sampleValue: string;
  targetField: TargetField;
}

export interface ParsedProductRow {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  category: string;
  subcategory?: string;
  hsnCode: string;
  gstRateBp: number;
  unit: string;
  purchasePriceRupees: string;
  salePriceRupees: string;
  mrpRupees: string;
  stockQty: number;
  reorderLevel: number;
  models: string[];
  groupHeading?: string;
  amountRupees?: string;
  isValid: boolean;
  isUnpriced: boolean;
  warnings: string[];
  // Deduplication & Sync state
  syncStatus: 'NEW' | 'UPDATED' | 'UNCHANGED';
  statusReason?: string;
  isIncluded: boolean;
  existingProductId?: string;
  diffInfo?: {
    oldRate?: number;
    newRate?: number;
    oldStock?: number;
    newStock?: number;
  };
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type WizardStep = 1 | 2 | 3;
type PreviewFilterType = 'ALL' | 'TO_SYNC' | 'NEW' | 'UPDATED' | 'UNCHANGED' | 'UNPRICED';

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  // 3-Step Wizard Navigation State
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [uploadMethod, setUploadMethod] = useState<'FILE' | 'PASTE'>('FILE');

  // File & Raw Data State
  const [file, setFile] = useState<File | null>(null);
  const [rawTableRows, setRawTableRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [pasteText, setPasteText] = useState('');

  // Tally & Parsed Result State
  const [tallyResult, setTallyResult] = useState<TallyParseResult | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [originalRows, setOriginalRows] = useState<ParsedProductRow[]>([]);

  // Filtering & Pagination State (Step 2)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilterType>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [previewSearch, setPreviewSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Advanced Drawers (Column Mapper & Format Guide)
  const [isColumnMapperOpen, setIsColumnMapperOpen] = useState(false);
  const [isFormatGuideOpen, setIsFormatGuideOpen] = useState(false);

  // Defaults for missing columns
  const [defaultBrand, setDefaultBrand] = useState('Standard');
  const [defaultCategory, setDefaultCategory] = useState('Automobile Spares');
  const [defaultGstPercent, setDefaultGstPercent] = useState('18');

  // Confirmation & Processing State (Step 3)
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [importCompleted, setImportCompleted] = useState(false);
  const [syncedCountTotal, setSyncedCountTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setUploadMethod('FILE');
      setFile(null);
      setRawTableRows([]);
      setColumnMappings([]);
      setParsedRows([]);
      setOriginalRows([]);
      setTallyResult(null);
      setErrorMsg(null);
      setStatusFeedback(null);
      setPasteText('');
      setSelectedGroupFilter('ALL');
      setPreviewFilter('ALL');
      setPreviewSearch('');
      setIsColumnMapperOpen(false);
      setIsFormatGuideOpen(false);
      setConfirmAcknowledged(false);
      setImportCompleted(false);
      setSyncedCountTotal(0);
    }
  }, [isOpen]);

  // Accessibility: Escape key handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  // Sample CSV Template download
  const sampleCSV = `Item Description,Pack / Qty,MRP (INR),Net Rate (INR),Part No,Brand,Category,GST %
Castrol 4T 20W40 900ml,24,410,350,CAS-20W40,Castrol,Lubricants & Oils,18
Front Brake Shoe Set,40,270,220,BS-ACT-01,Honda Genuine,Brakes & Friction,18
LED Headlight Bulb H4,15,599,480,LED-H4-35W,Philips,Electrical,18
Drive V-Belt,20,380,310,BLT-ACT-99,Bando,Belts & Chains,18
Clutch Cable Complete,30,165,120,CC-HON-110,Endurance,Control Cables,18`;

  const handleDownloadSample = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TradeLedger_Inventory_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust SheetJS loader: uses bundled npm package first, then local vendor script, then fallback CDNs
  const loadSheetJS = async (): Promise<any> => {
    if (typeof window !== 'undefined' && (window as any).XLSX) {
      return (window as any).XLSX;
    }

    try {
      const mod: any = await import('xlsx');
      const resolved = mod?.read ? mod : (mod?.default || mod);
      if (typeof window !== 'undefined') {
        (window as any).XLSX = resolved;
      }
      return resolved;
    } catch (bundleErr) {
      console.warn('Bundled import of xlsx failed, attempting fallback loaders:', bundleErr);
    }

    const loadScript = (src: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve((window as any).XLSX);
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    try {
      return await loadScript('/vendor/xlsx.full.min.js');
    } catch {
      try {
        return await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
      } catch {
        try {
          return await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        } catch {
          throw new Error('Failed to load Excel parsing engine.');
        }
      }
    }
  };

  // Column name pattern match for automatic column guessing
  const guessTargetField = (header: string, sampleVal: string): TargetField => {
    const h = (header ? String(header) : '').toLowerCase();
    if (h.includes('name') || h.includes('desc') || h.includes('item') || h.includes('particular')) return 'NAME';
    if (h.includes('part') || h.includes('sku') || h.includes('code') || h.includes('oem')) return 'PART_NUMBER';
    if (h.includes('qty') || h.includes('quantity') || h.includes('stock') || h.includes('balance') || h.includes('closing') || h.includes('pack')) return 'STOCK_QTY';
    if (h.includes('unit') || h.includes('uom') || h.includes('pkg')) return 'UNIT';
    if (h.includes('mrp') || h.includes('retail') || h.includes('maxretail') || h.includes('list price')) return 'MRP';
    if (h.includes('cost') || h.includes('purchase') || h.includes('buy') || h.includes('cp') || h.includes('dp')) return 'COST_PRICE';
    if (h.includes('amount') || h.includes('value') || h.includes('total') || h.includes('val')) return 'AMOUNT';
    if (h.includes('rate') || h.includes('sale') || h.includes('price') || h.includes('sp') || h.includes('net') || h.includes('wholesale')) return 'SALE_PRICE';
    if (h.includes('brand') || h.includes('make') || h.includes('company') || h.includes('mfg')) return 'BRAND';
    if (h.includes('category') || h.includes('cat') || h.includes('dept') || h.includes('group')) return 'CATEGORY';
    if (h.includes('gst') || h.includes('tax')) return 'GST_RATE';
    if (h.includes('hsn') || h.includes('sac')) return 'HSN_CODE';
    return 'IGNORE';
  };

  // Process rows with both Tally Auto-Engine and Fallback Column Mapper + Deduplication against existing products
  const processRawTable = async (rows: string[][]) => {
    if (rows.length === 0) {
      setErrorMsg('No data found in document.');
      return;
    }

    setRawTableRows(rows);
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      // 1. Fetch current database products for deduplication & change detection
      let existingProducts: any[] = [];
      try {
        const prodRes = await fetch('/api/v1/products');
        const prodData = await prodRes.json();
        if (Array.isArray(prodData.products)) {
          existingProducts = prodData.products;
        }
      } catch (err) {
        console.warn('Could not fetch existing products for dedup comparison:', err);
      }

      const existingByName = new Map<string, any>();
      for (const p of existingProducts) {
        if (p.name) existingByName.set(p.name.trim().toLowerCase(), p);
      }

      // 2. Run Tally Auto-Detection Parser
      const tallyParsed = parseTallyInventorySheet(rows);
      setTallyResult(tallyParsed);

      // 3. Fallback column mapping detection
      const firstRow = Array.from(rows[0] || [], cell => (cell !== null && cell !== undefined ? String(cell).trim() : ''));
      const secondRow = Array.from(rows[1] || [], cell => (cell !== null && cell !== undefined ? String(cell).trim() : ''));
      const mappings: ColumnMapping[] = firstRow.map((rawHeader, idx) => ({
        colIndex: idx,
        rawHeader: rawHeader || `Column ${idx + 1}`,
        sampleValue: secondRow[idx] || '',
        targetField: guessTargetField(rawHeader || `Column ${idx + 1}`, secondRow[idx] || ''),
      }));
      setColumnMappings(mappings);

      // 4. Convert items and cross-examine against existing inventory
      if (tallyParsed.items.length > 0) {
        const convertedRows: ParsedProductRow[] = tallyParsed.items.map((item, idx) => {
          const rowId = `item-${idx}-${Date.now().toString(36)}`;
          const existing = item.name ? existingByName.get(item.name.trim().toLowerCase()) : null;

          let syncStatus: 'NEW' | 'UPDATED' | 'UNCHANGED' = 'NEW';
          let statusReason = 'New product to be added';
          let isIncluded = true;
          let existingProductId: string | undefined = undefined;
          let diffInfo: any = undefined;

          if (existing) {
            existingProductId = existing.id;
            const existingRate = Number(existing.salePricePaise || existing.purchasePricePaise || 0) / 100;
            const existingStock = Number(existing.stockQty || 0);

            const newRate = parseFloat(item.salePriceRupees || item.purchasePriceRupees || '0') || 0;
            const newStock = item.stockQty || 0;

            const rateDiffers = !item.isUnpriced && newRate > 0 && Math.abs(newRate - existingRate) > 0.05;
            const stockDiffers = !item.isUnpriced && newStock !== existingStock;

            if (rateDiffers || stockDiffers) {
              syncStatus = 'UPDATED';
              isIncluded = true;
              diffInfo = {
                oldRate: existingRate,
                newRate: newRate,
                oldStock: existingStock,
                newStock: newStock,
              };
              const reasons: string[] = [];
              if (rateDiffers) reasons.push(`Rate changed (₹${existingRate.toFixed(2)} → ₹${newRate.toFixed(2)})`);
              if (stockDiffers) reasons.push(`Stock changed (${existingStock} → ${newStock})`);
              statusReason = reasons.join(', ');
            } else {
              syncStatus = 'UNCHANGED';
              isIncluded = false; // Skipped by default so user doesn't re-add existing unchanged items
              statusReason = 'Already in inventory with identical rate & stock (Skipped)';
            }
          } else if (item.isUnpriced) {
            statusReason = 'Unpriced item (Rate & Qty to be set at billing)';
          }

          return {
            id: rowId,
            name: item.name,
            partNumber: item.partNumber,
            brand: item.brand,
            category: item.category,
            subcategory: item.subcategory,
            hsnCode: item.hsnCode,
            gstRateBp: item.gstRateBp,
            unit: item.unit,
            purchasePriceRupees: item.purchasePriceRupees,
            salePriceRupees: item.salePriceRupees,
            mrpRupees: item.mrpRupees,
            stockQty: item.stockQty,
            reorderLevel: 5,
            models: item.models,
            groupHeading: item.groupHeading,
            amountRupees: item.amountRupees,
            isValid: item.isValid,
            isUnpriced: item.isUnpriced,
            warnings: item.warnings,
            syncStatus,
            statusReason,
            isIncluded,
            existingProductId,
            diffInfo,
          };
        });

        setParsedRows(convertedRows);
        setOriginalRows(convertedRows);
        setCurrentStep(2);
      } else {
        // If Tally parser returned 0 items, open Step 2 with manual column mapper
        setIsColumnMapperOpen(true);
        setCurrentStep(2);
      }
    } catch (err: any) {
      console.error('Error processing table:', err);
      setErrorMsg(`Failed to analyze sheet: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse tab-separated or comma-separated clipboard text
  const parseDelimitedText = (text: string) => {
    try {
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 1) {
        setErrorMsg('The entered text appears to be empty.');
        return;
      }

      const firstLine = lines[0];
      const isTab = firstLine.includes('\t');
      const delimiter = isTab ? '\t' : ',';

      const parseLine = (line: string): string[] => {
        if (delimiter === '\t') {
          return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
        }
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else cur += char;
        }
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const table = lines.map(line => parseLine(line)).filter(row => row.some(cell => cell.length > 0));
      processRawTable(table);
    } catch (err: any) {
      setErrorMsg(`Failed to parse table: ${err.message}`);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setErrorMsg(null);

    const fileName = uploadedFile.name.toLowerCase();

    try {
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const XLSX = await loadSheetJS();
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const stringRows: string[][] = (sheetData || [])
          .filter(row => Array.isArray(row) && row.length > 0 && Array.from(row).some(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(row => Array.from(row, cell => (cell !== null && cell !== undefined ? String(cell).trim() : '')));

        if (stringRows.length === 0) throw new Error('No rows found in uploaded Excel sheet.');
        await processRawTable(stringRows);
      } else {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          parseDelimitedText(text);
          setIsProcessing(false);
        };
        reader.onerror = () => {
          setErrorMsg('Error reading text file.');
          setIsProcessing(false);
        };
        reader.readAsText(uploadedFile);
        return;
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMsg(`Failed to process spreadsheet: ${err.message || 'Please check file format.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Quick Paste submit
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) {
      setErrorMsg('Please paste some rows from your Excel or Tally spreadsheet first.');
      return;
    }
    parseDelimitedText(pasteText.trim());
  };

  // Generate preview from Manual Column Mapping
  const generatePreviewFromManualMappings = () => {
    setErrorMsg(null);

    const nameCol = columnMappings.find(m => m.targetField === 'NAME');
    if (!nameCol) {
      setErrorMsg('Please map at least one column as "Product Name".');
      return;
    }

    const saleCol = columnMappings.find(m => m.targetField === 'SALE_PRICE');
    const mrpCol = columnMappings.find(m => m.targetField === 'MRP');
    const costCol = columnMappings.find(m => m.targetField === 'COST_PRICE');
    const amountCol = columnMappings.find(m => m.targetField === 'AMOUNT');
    const stockCol = columnMappings.find(m => m.targetField === 'STOCK_QTY');
    const partCol = columnMappings.find(m => m.targetField === 'PART_NUMBER');
    const brandCol = columnMappings.find(m => m.targetField === 'BRAND');
    const catCol = columnMappings.find(m => m.targetField === 'CATEGORY');
    const gstCol = columnMappings.find(m => m.targetField === 'GST_RATE');
    const hsnCol = columnMappings.find(m => m.targetField === 'HSN_CODE');
    const unitCol = columnMappings.find(m => m.targetField === 'UNIT');

    const cleanNum = (str: string, fallback = ''): string => {
      const sanitized = (str || '').replace(/[^0-9.]/g, '');
      const num = parseFloat(sanitized);
      return !isNaN(num) && num >= 0 ? num.toString() : fallback;
    };

    const rows: ParsedProductRow[] = [];
    for (let i = 1; i < rawTableRows.length; i++) {
      const row = rawTableRows[i];
      const name = (row[nameCol.colIndex] || '').trim();
      if (!name) continue;

      let salePriceNum = saleCol ? parseFloat(cleanNum(row[saleCol.colIndex], '0')) || 0 : 0;
      let mrpNum = mrpCol ? parseFloat(cleanNum(row[mrpCol.colIndex], '0')) || 0 : 0;
      let costPriceNum = costCol ? parseFloat(cleanNum(row[costCol.colIndex], '0')) || 0 : 0;
      let amountNum = amountCol ? parseFloat(cleanNum(row[amountCol.colIndex], '0')) || 0 : 0;
      let stock = stockCol ? parseInt(cleanNum(row[stockCol.colIndex], '0'), 10) || 0 : 0;

      if (salePriceNum <= 0 && amountNum > 0 && stock > 0) {
        salePriceNum = Math.round((amountNum / stock) * 100) / 100;
      } else if (stock <= 0 && amountNum > 0 && salePriceNum > 0) {
        stock = Math.round(amountNum / salePriceNum);
      } else if (amountNum <= 0 && salePriceNum > 0 && stock > 0) {
        amountNum = Math.round(salePriceNum * stock * 100) / 100;
      }

      if (mrpNum <= 0 && salePriceNum > 0) {
        mrpNum = Math.round(salePriceNum * 1.25);
      } else if (mrpNum > 0 && salePriceNum > mrpNum) {
        const temp = mrpNum;
        mrpNum = salePriceNum;
        salePriceNum = temp;
        amountNum = Math.round(salePriceNum * stock * 100) / 100;
      }

      if (costPriceNum <= 0 && salePriceNum > 0) {
        costPriceNum = salePriceNum;
      }

      const salePrice = salePriceNum > 0 ? salePriceNum.toFixed(2) : '';
      const mrp = mrpNum > 0 ? mrpNum.toFixed(2) : salePrice;
      const costPrice = costPriceNum > 0 ? costPriceNum.toFixed(2) : salePrice;
      const amountRupees = amountNum > 0 ? amountNum.toFixed(2) : (salePriceNum > 0 && stock > 0 ? (salePriceNum * stock).toFixed(2) : '');

      const brand = brandCol ? (row[brandCol.colIndex] || defaultBrand).trim() : defaultBrand;
      const cat = catCol ? (row[catCol.colIndex] || defaultCategory).trim() : defaultCategory;
      const unit = unitCol ? (row[unitCol.colIndex] || 'pcs').trim() : 'pcs';
      const hsn = hsnCol ? (row[hsnCol.colIndex] || '8714').trim() : '8714';
      const gstBp = gstCol ? (parseInt(cleanNum(row[gstCol.colIndex], '18'), 10) || 18) * 100 : parseInt(defaultGstPercent, 10) * 100;
      const partNo = partCol ? (row[partCol.colIndex] || '').trim() : `TL-${Date.now().toString(36).slice(-4)}-${i}`;

      const isUnpriced = !salePrice && stock === 0;

      rows.push({
        id: `manual-row-${i}`,
        name,
        partNumber: partNo,
        brand,
        category: cat,
        subcategory: 'General',
        hsnCode: hsn,
        gstRateBp: gstBp,
        unit,
        purchasePriceRupees: costPrice,
        salePriceRupees: salePrice,
        mrpRupees: mrp,
        stockQty: stock,
        reorderLevel: 5,
        models: ['Universal / Multi-Fit'],
        amountRupees,
        isValid: Boolean(name && name.length > 1),
        isUnpriced,
        warnings: isUnpriced ? ['Unpriced item'] : [],
        syncStatus: 'NEW',
        statusReason: 'Mapped from spreadsheet columns',
        isIncluded: true,
      });
    }

    if (rows.length === 0) {
      setErrorMsg('No valid product records found from mapping.');
      return;
    }

    setParsedRows(rows);
    setOriginalRows(rows);
    setIsColumnMapperOpen(false);
    setCurrentStep(2);
  };

  // Row update handlers
  const handleUpdateRowCell = (id: string, field: keyof ParsedProductRow, val: any) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };

      if (field === 'stockQty' || field === 'salePriceRupees') {
        const q = field === 'stockQty' ? Number(val || 0) : r.stockQty;
        const p = field === 'salePriceRupees' ? parseFloat(val || '0') : parseFloat(r.salePriceRupees || '0');
        if (!isNaN(q) && !isNaN(p) && p > 0) {
          updated.amountRupees = (q * p).toFixed(2);
        }
        if (field === 'salePriceRupees') {
          const currentMrp = parseFloat(r.mrpRupees || '0');
          if (isNaN(currentMrp) || currentMrp < p) {
            updated.mrpRupees = p > 0 ? (p * 1.25).toFixed(2) : '';
          }
          if (!r.purchasePriceRupees || parseFloat(r.purchasePriceRupees) === parseFloat(r.salePriceRupees || '0')) {
            updated.purchasePriceRupees = val;
          }
        }
      }

      if (field === 'amountRupees') {
        const amt = parseFloat(val || '0');
        if (!isNaN(amt) && amt > 0 && r.stockQty > 0) {
          const newRate = (amt / r.stockQty).toFixed(2);
          updated.salePriceRupees = newRate;
          const currentMrp = parseFloat(r.mrpRupees || '0');
          if (isNaN(currentMrp) || currentMrp < parseFloat(newRate)) {
            updated.mrpRupees = (parseFloat(newRate) * 1.25).toFixed(2);
          }
        }
      }

      return updated;
    }));
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleToggleInclude = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, isIncluded: !r.isIncluded } : r));
  };

  const handleSelectAll = (select: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, isIncluded: select })));
  };

  const handleDeleteUnselected = () => {
    const remaining = parsedRows.filter(r => r.isIncluded);
    setParsedRows(remaining);
  };

  const handleResetToOriginal = () => {
    setParsedRows(originalRows);
    setStatusFeedback('Reset all rows to original sheet extraction');
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  // Submit and commit to database
  const handleCommitImport = async () => {
    const toImport = parsedRows.filter(r => r.isValid && r.isIncluded);
    if (toImport.length === 0) {
      setErrorMsg('No items selected for sync. Please select at least one row.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const payloadItems = toImport.map(r => ({
        name: r.name,
        partNumber: r.partNumber,
        brand: r.brand,
        category: r.category,
        subcategory: r.subcategory,
        hsnCode: r.hsnCode,
        gstRateBp: r.gstRateBp,
        unit: r.unit,
        purchasePricePaise: Math.round(Number(r.purchasePriceRupees || 0) * 100),
        salePricePaise: Math.round(Number(r.salePriceRupees || 0) * 100),
        mrpPaise: Math.round(Number(r.mrpRupees || r.salePriceRupees || 0) * 100),
        stockQty: r.stockQty,
        reorderLevel: r.reorderLevel,
        models: r.models,
        existingProductId: r.existingProductId,
        syncAction: r.syncStatus === 'UPDATED' ? 'UPDATE' : 'CREATE',
        isUnpriced: r.isUnpriced,
      }));

      // Chunk in batches of 500 for lightning-fast network requests & instant visual progress
      const CHUNK_SIZE = 500;
      let totalSynced = 0;
      setSyncProgress({ current: 0, total: payloadItems.length });

      for (let i = 0; i < payloadItems.length; i += CHUNK_SIZE) {
        const chunk = payloadItems.slice(i, i + CHUNK_SIZE);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        try {
          const res = await fetch('/api/v1/products/bulk-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: chunk }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${res.status}`);
          }

          const data = await res.json();
          const count = (data.importedCount || 0) + (data.updatedCount || 0);
          totalSynced += count;

          setSyncProgress({
            current: Math.min(i + chunk.length, payloadItems.length),
            total: payloadItems.length,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            throw new Error(`Batch ${Math.floor(i / CHUNK_SIZE) + 1} timed out. Please check your connection and retry.`);
          }
          throw fetchErr;
        }
      }

      setSyncedCountTotal(totalSynced);
      setImportCompleted(true);
      onSuccess(totalSynced);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit inventory feed.');
    } finally {
      setIsProcessing(false);
      setSyncProgress(null);
    }
  };

  // Filter rows for Step 2 table
  const filteredPreview = useMemo(() => {
    return parsedRows.filter(r => {
      if (selectedGroupFilter !== 'ALL') {
        const itemGroup = r.groupHeading || r.brand || 'Uncategorized';
        if (itemGroup !== selectedGroupFilter) return false;
      }

      if (previewFilter === 'TO_SYNC' && !r.isIncluded) return false;
      if (previewFilter === 'NEW' && r.syncStatus !== 'NEW') return false;
      if (previewFilter === 'UPDATED' && r.syncStatus !== 'UPDATED') return false;
      if (previewFilter === 'UNCHANGED' && r.syncStatus !== 'UNCHANGED') return false;
      if (previewFilter === 'UNPRICED' && !r.isUnpriced) return false;

      if (!previewSearch.trim()) return true;
      const q = previewSearch.toLowerCase();
      return Boolean(
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.partNumber && r.partNumber.toLowerCase().includes(q)) ||
        (r.brand && r.brand.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.subcategory && r.subcategory.toLowerCase().includes(q)) ||
        (Array.isArray(r.models) && r.models.some(m => Boolean(m) && typeof m === 'string' && m.toLowerCase().includes(q))) ||
        (r.groupHeading && r.groupHeading.toLowerCase().includes(q))
      );
    });
  }, [parsedRows, selectedGroupFilter, previewFilter, previewSearch]);

  // Available groups for dropdown
  const availableGroups = useMemo(() => {
    const stats: Record<string, { count: number; totalValuation: number }> = {};
    for (const r of parsedRows) {
      const g = r.groupHeading || r.brand || 'Uncategorized';
      if (!stats[g]) {
        stats[g] = { count: 0, totalValuation: 0 };
      }
      stats[g].count += 1;
      const rate = parseFloat(r.salePriceRupees || r.purchasePriceRupees || '0') || 0;
      stats[g].totalValuation += rate * (r.stockQty || 0);
    }
    return Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
  }, [parsedRows]);

  const totalPages = Math.max(1, Math.ceil(filteredPreview.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPreview.slice(start, start + pageSize);
  }, [filteredPreview, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGroupFilter, previewFilter, previewSearch, pageSize]);

  // Aggregate metrics
  const newCount = parsedRows.filter(r => r.syncStatus === 'NEW').length;
  const updateCount = parsedRows.filter(r => r.syncStatus === 'UPDATED').length;
  const unchangedCount = parsedRows.filter(r => r.syncStatus === 'UNCHANGED').length;
  const unpricedCount = parsedRows.filter(r => r.isUnpriced).length;
  const includedCount = parsedRows.filter(r => r.isIncluded).length;
  const totalUnits = parsedRows.filter(r => r.isIncluded).reduce((sum, r) => sum + r.stockQty, 0);
  const totalValuation = parsedRows.filter(r => r.isIncluded).reduce((sum, r) => sum + (Number(r.amountRupees) || (Number(r.salePriceRupees || 0) * r.stockQty)), 0);

  if (!isOpen) return null;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="bulk-import-modal-title" 
          className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl shadow-2xl w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        >
          {/* Top Bar: Title & Step Indicator */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 text-[#C81E1E] border border-red-200 flex items-center justify-center font-bold shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <h2 id="bulk-import-modal-title" className="text-sm font-bold text-slate-900">Import Inventory</h2>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-500 font-medium">Auto-Hierarchy & Smart Sync</span>
              </div>
            </div>

            {/* Guided 3-Step Breadcrumb / Indicator */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Step 1 */}
              <button
                type="button"
                onClick={() => {
                  if (currentStep > 1 && !isProcessing) setCurrentStep(1);
                }}
                disabled={currentStep === 1 || isProcessing}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  currentStep === 1
                    ? 'bg-[#C81E1E] text-white shadow-2xs'
                    : currentStep > 1
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                      : 'text-slate-400'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${currentStep > 1 ? 'bg-emerald-600 text-white' : 'bg-white/20 text-white'}`}>
                  {currentStep > 1 ? '✓' : '1'}
                </span>
                <span>Upload</span>
              </button>

              <span className="text-slate-300">→</span>

              {/* Step 2 */}
              <button
                type="button"
                onClick={() => {
                  if (parsedRows.length > 0 && !isProcessing) setCurrentStep(2);
                }}
                disabled={parsedRows.length === 0 || isProcessing}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  currentStep === 2
                    ? 'bg-[#C81E1E] text-white shadow-2xs'
                    : currentStep > 2
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                      : parsedRows.length > 0
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                        : 'text-slate-400'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${currentStep > 2 ? 'bg-emerald-600 text-white' : currentStep === 2 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {currentStep > 2 ? '✓' : '2'}
                </span>
                <span>Review & Correct</span>
              </button>

              <span className="text-slate-300">→</span>

              {/* Step 3 */}
              <button
                type="button"
                onClick={() => {
                  if (parsedRows.length > 0 && !isProcessing) setCurrentStep(3);
                }}
                disabled={parsedRows.length === 0 || isProcessing}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  currentStep === 3
                    ? 'bg-[#C81E1E] text-white shadow-2xs'
                    : 'text-slate-400'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${currentStep === 3 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  3
                </span>
                <span>Confirm</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              aria-label="Close bulk import dialog"
              onClick={onClose}
              disabled={isProcessing}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feedback & Error Alerts */}
          {errorMsg && (
            <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 font-medium shrink-0 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="flex-1">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {statusFeedback && (
            <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-medium shrink-0 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusFeedback}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: UPLOAD DATA                                                      */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
              {/* Header text */}
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Upload Your Inventory Spreadsheet</h3>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Drag and drop your spreadsheet or copy-paste directly from TallyPrime or Excel. TradeLedger automatically classifies groups, part numbers, and selling rates.
                </p>
              </div>

              {/* Method Switcher */}
              <div className="flex items-center justify-center">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUploadMethod('FILE')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                      uploadMethod === 'FILE'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#C81E1E]" />
                    <span>Upload Spreadsheet (.xlsx, .csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMethod('PASTE')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                      uploadMethod === 'PASTE'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quick Paste (Ctrl+V)</span>
                  </button>
                </div>
              </div>

              {/* Primary Dropzone */}
              {uploadMethod === 'FILE' ? (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-[#C81E1E] bg-slate-50/60 hover:bg-red-50/20 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-white group-hover:bg-red-50 text-slate-500 group-hover:text-[#C81E1E] border border-slate-200 group-hover:border-red-200 flex items-center justify-center transition shadow-2xs">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-[#C81E1E] transition">
                        Click to browse or drag & drop inventory file here
                      </div>
                      <div className="text-xs text-slate-500">
                        Supports Tally Stock Summary exports, Excel spreadsheets, and CSV price lists.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 pt-1">
                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 font-medium">Tally Excel (.xlsx)</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 font-medium">Excel 97-2003 (.xls)</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 font-medium">Standard CSV (.csv)</span>
                    </div>
                  </div>

                  {file && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-slate-800">{file.name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      {isProcessing && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C81E1E]" />
                          <span>Parsing inventory hierarchy...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Quick Paste Textarea */
                <div className="space-y-3">
                  <textarea
                    rows={9}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`Particulars\tClosing Balance Qty\tRate\tValue\nACCURA\t\t\t14905.81\nACR.HLV,DIS 100 ( RED )\t\t\t\nACR.HLV, D-YUGA (BLK/GREY)\t1 PCS\t180.70\t180.70\nAS. 6003 BEARING\t9 PCS\t33.50\t301.50`}
                    className="w-full p-4 font-mono text-xs bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:border-[#C81E1E] focus:ring-1 focus:ring-red-200 outline-hidden transition resize-y"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">
                      Copy rows directly from open Tally screen or Excel table (Ctrl+C) and paste here.
                    </p>
                    <button
                      type="button"
                      onClick={handlePasteSubmit}
                      disabled={isProcessing || !pasteText.trim()}
                      className="h-8.5 px-4 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Analyze Pasted Data</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Discreet Utility Links */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="hover:text-[#C81E1E] underline transition cursor-pointer flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Download sample CSV template</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFormatGuideOpen(!isFormatGuideOpen)}
                  className="hover:text-slate-900 transition cursor-pointer flex items-center gap-1 text-slate-500"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isFormatGuideOpen ? 'Hide format tips' : 'View Tally format guide'}</span>
                </button>
              </div>

              {/* Collapsible Format Guide Drawer */}
              {isFormatGuideOpen && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-3 animate-in fade-in duration-150">
                  <div className="font-bold text-slate-800">Tally & Excel Ingestion Guidelines</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-white border border-slate-200/80 rounded-lg">
                      <div className="font-bold text-slate-800 mb-1">1. Auto-Hierarchy</div>
                      <p className="text-[11px] text-slate-500">Parent rows with totals are detected as Brands / Stock Groups automatically.</p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200/80 rounded-lg">
                      <div className="font-bold text-slate-800 mb-1">2. Smart Deduplication</div>
                      <p className="text-[11px] text-slate-500">Existing catalog products update only when rate or stock changed. Unchanged items are skipped.</p>
                    </div>
                    <div className="p-3 bg-white border border-slate-200/80 rounded-lg">
                      <div className="font-bold text-slate-800 mb-1">3. Unpriced Items</div>
                      <p className="text-[11px] text-slate-500">Items with blank prices or stock are queued for on-the-fly pricing during POS billing.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: REVIEW AND CORRECT                                               */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3.5 sm:p-5 space-y-3">
              {/* Dataset Header Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-slate-900 text-sm">
                    {tallyResult?.companyTitle || file?.name || 'Inventory Dataset'}
                  </span>
                  {tallyResult?.dateRange && (
                    <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {tallyResult.dateRange}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({parsedRows.length.toLocaleString('en-IN')} total extracted)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsColumnMapperOpen(!isColumnMapperOpen)}
                    className="h-7 px-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                    <span>{isColumnMapperOpen ? 'Hide Column Settings' : 'Column Settings'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="h-7 px-2.5 text-xs text-slate-600 hover:text-slate-900 underline transition cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Column Mapping Drawer (Optional / Collapsible) */}
              {isColumnMapperOpen && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shrink-0 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Assign Column Mappings Manually:</span>
                    <button
                      type="button"
                      onClick={generatePreviewFromManualMappings}
                      className="h-7 px-3 bg-[#C81E1E] text-white rounded text-xs font-bold transition hover:bg-[#A81818]"
                    >
                      Re-apply Mappings
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    {columnMappings.map((col, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-[11px] font-bold text-slate-800 truncate" title={col.rawHeader}>{col.rawHeader}</div>
                        <select
                          value={col.targetField}
                          onChange={(e) => {
                            const updated = [...columnMappings];
                            updated[idx].targetField = e.target.value as TargetField;
                            setColumnMappings(updated);
                          }}
                          className="w-full h-6 text-[11px] bg-slate-50 border border-slate-300 rounded px-1"
                        >
                          <option value="NAME">Product Name</option>
                          <option value="STOCK_QTY">Quantity</option>
                          <option value="MRP">MRP (₹)</option>
                          <option value="SALE_PRICE">Selling Rate (₹)</option>
                          <option value="AMOUNT">Amount (₹)</option>
                          <option value="COST_PRICE">Cost Price (₹)</option>
                          <option value="PART_NUMBER">Part / SKU</option>
                          <option value="BRAND">Brand</option>
                          <option value="CATEGORY">Category</option>
                          <option value="UNIT">Unit</option>
                          <option value="GST_RATE">GST %</option>
                          <option value="HSN_CODE">HSN</option>
                          <option value="IGNORE">Ignore</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4 Summary Metric Cards (Compact) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">Selected to Sync</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {includedCount.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-400">/ {parsedRows.length}</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">New Products</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                    +{newCount.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">Rate/Stock Updates</div>
                  <div className="text-base font-bold text-amber-700 font-mono mt-0.5">
                    {updateCount.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 font-mono">Skipped (Unchanged)</div>
                  <div className="text-base font-bold text-slate-600 font-mono mt-0.5">
                    {unchangedCount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 border border-slate-200 rounded-xl shrink-0">
                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      previewFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] font-mono opacity-80">({parsedRows.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('TO_SYNC')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      previewFilter === 'TO_SYNC'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <span>To Sync</span>
                    <span className="text-[10px] font-mono opacity-80">({includedCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('NEW')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      previewFilter === 'NEW'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <span>New</span>
                    <span className="text-[10px] font-mono opacity-80">({newCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('UPDATED')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      previewFilter === 'UPDATED'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <span>Updates</span>
                    <span className="text-[10px] font-mono opacity-80">({updateCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('UNCHANGED')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      previewFilter === 'UNCHANGED'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Skipped</span>
                    <span className="text-[10px] font-mono opacity-80">({unchangedCount})</span>
                  </button>

                  {unpricedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('UNPRICED')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        previewFilter === 'UNPRICED'
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                      }`}
                    >
                      <span>Unpriced</span>
                      <span className="text-[10px] font-mono opacity-80">({unpricedCount})</span>
                    </button>
                  )}
                </div>

                {/* Right controls: Optional Group Filter & Search */}
                <div className="flex items-center gap-2">
                  {availableGroups.length > 1 && (
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                      <FolderTree className="w-3 h-3 text-slate-400" />
                      <select
                        value={selectedGroupFilter}
                        onChange={(e) => setSelectedGroupFilter(e.target.value)}
                        className="bg-transparent font-medium text-slate-700 text-xs focus:outline-none max-w-[150px] truncate"
                      >
                        <option value="ALL">All Groups ({parsedRows.length})</option>
                        {availableGroups.map(([grp, data]) => (
                          <option key={grp} value={grp}>
                            {grp} ({data.count})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      placeholder="Search items..."
                      className="h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#C81E1E] outline-hidden w-48 sm:w-56"
                    />
                  </div>
                </div>
              </div>

              {/* Selection Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <CheckSquare className="w-3 h-3 text-emerald-600" />
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Square className="w-3 h-3 text-slate-400" />
                    <span>Deselect All</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteUnselected}
                    className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 rounded-md border border-rose-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Delete Unselected</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    Reset Edits
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Showing {filteredPreview.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredPreview.length)} of {filteredPreview.length} items
                </div>
              </div>

              {/* Review Table (Paginated / Fast Scroll) */}
              <div className="border border-slate-200 rounded-xl overflow-auto flex-1 min-h-0 bg-white shadow-2xs">
                <table className="min-w-[1050px] w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={paginatedRows.length > 0 && paginatedRows.every(r => r.isIncluded)}
                          onChange={(e) => {
                            const check = e.target.checked;
                            setParsedRows(prev => prev.map(r => paginatedRows.some(pr => pr.id === r.id) ? { ...r, isIncluded: check } : r));
                          }}
                          className="rounded border-slate-300 text-[#C81E1E] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-2 text-center w-24">Status</th>
                      <th className="py-2.5 px-3 min-w-[300px]">Product Name (Click to edit)</th>
                      <th className="py-2.5 px-2 min-w-[140px]">Group / Category</th>
                      <th className="py-2.5 px-2 min-w-[100px]">Brand</th>
                      <th className="py-2.5 px-2 text-center w-16">Stock</th>
                      <th className="py-2.5 px-2 text-center w-14">Unit</th>
                      <th className="py-2.5 px-2 text-right w-22">MRP (₹)</th>
                      <th className="py-2.5 px-2 text-right w-22">Rate (₹)</th>
                      <th className="py-2.5 px-2 text-right w-24">Amount (₹)</th>
                      <th className="py-2.5 px-2 text-center w-12">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-mono">
                    {paginatedRows.map((row) => (
                      <tr 
                        key={row.id} 
                        className={`transition ${
                          !row.isIncluded 
                            ? 'bg-slate-50/70 opacity-40' 
                            : row.syncStatus === 'UPDATED'
                            ? 'bg-amber-50/20 hover:bg-amber-50/40'
                            : row.syncStatus === 'NEW'
                            ? 'hover:bg-emerald-50/20'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.isIncluded}
                            onChange={() => handleToggleInclude(row.id)}
                            className="rounded border-slate-300 text-[#C81E1E] focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Status Badge */}
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {row.syncStatus === 'NEW' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                New
                              </span>
                            ) : row.syncStatus === 'UPDATED' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title={row.statusReason}>
                                Update
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200" title={row.statusReason}>
                                Skipped
                              </span>
                            )}
                            {row.isUnpriced && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Unpriced item">
                                Unpriced
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Product Name (Editable) */}
                        <td className="py-1.5 px-3 font-sans">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateRowCell(row.id, 'name', e.target.value)}
                            className="w-full text-xs font-medium text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1.5 py-0.5 outline-hidden transition"
                          />
                        </td>

                        {/* Subcategory & Category (Editable) */}
                        <td className="py-1.5 px-2 font-sans">
                          <input
                            type="text"
                            value={row.subcategory || row.category}
                            onChange={(e) => handleUpdateRowCell(row.id, 'subcategory', e.target.value)}
                            className="w-full text-[11px] text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
                          />
                        </td>

                        {/* Brand (Editable) */}
                        <td className="py-1.5 px-2 font-sans">
                          <input
                            type="text"
                            value={row.brand}
                            onChange={(e) => handleUpdateRowCell(row.id, 'brand', e.target.value)}
                            className="w-full text-[11px] font-semibold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
                          />
                        </td>

                        {/* Stock Qty (Editable) */}
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="number"
                            value={row.isUnpriced && row.stockQty === 0 ? '' : row.stockQty}
                            placeholder={row.isUnpriced ? '—' : '0'}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              handleUpdateRowCell(row.id, 'stockQty', isNaN(val) ? 0 : val);
                              if (!isNaN(val) && val > 0) {
                                handleUpdateRowCell(row.id, 'isUnpriced', false);
                              }
                            }}
                            className="w-14 text-center text-xs font-bold font-mono text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
                          />
                        </td>

                        {/* Unit (Editable) */}
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleUpdateRowCell(row.id, 'unit', e.target.value.toLowerCase())}
                            className="w-12 text-center text-[11px] font-mono text-slate-600 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
                          />
                        </td>

                        {/* MRP (Editable) */}
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="text"
                            value={row.mrpRupees || ''}
                            placeholder={row.isUnpriced ? '—' : '0.00'}
                            onChange={(e) => handleUpdateRowCell(row.id, 'mrpRupees', e.target.value)}
                            className="w-18 text-right text-xs font-mono text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition tabular-nums"
                          />
                        </td>

                        {/* Rate (Editable) */}
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="text"
                            value={row.salePriceRupees || ''}
                            placeholder={row.isUnpriced ? '—' : '0.00'}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleUpdateRowCell(row.id, 'salePriceRupees', v);
                              if (parseFloat(v) > 0) {
                                handleUpdateRowCell(row.id, 'isUnpriced', false);
                              }
                            }}
                            className="w-18 text-right text-xs font-bold font-mono text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition tabular-nums"
                          />
                        </td>

                        {/* Amount (Editable) */}
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="text"
                            value={row.amountRupees || ''}
                            placeholder={row.isUnpriced ? '—' : '0.00'}
                            onChange={(e) => handleUpdateRowCell(row.id, 'amountRupees', e.target.value)}
                            className="w-20 text-right text-xs font-mono font-semibold text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/50 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1.5 py-0.5 outline-hidden transition tabular-nums"
                          />
                        </td>

                        {/* Delete Action */}
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            title="Remove row"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {paginatedRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-xs text-slate-400 font-sans">
                          No product items match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 text-xs font-semibold bg-white border border-slate-300 rounded-md px-2 focus:outline-hidden"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition flex items-center gap-1 font-semibold cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <span className="px-2 text-[11px] font-mono text-slate-600">
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition flex items-center gap-1 font-semibold cursor-pointer shadow-2xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: CONFIRM IMPORT                                                   */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 max-w-3xl mx-auto w-full">
              {!importCompleted ? (
                <>
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Review & Confirm Synchronization</h3>
                    <p className="text-xs text-slate-500">
                      Verify the summary below before applying changes to your inventory catalog.
                    </p>
                  </div>

                  {/* Summary Breakdown Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="font-bold text-xs uppercase tracking-wider text-slate-600 font-mono">
                      Ingestion Impact Summary
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">New Products to Add:</span>
                          <span className="font-bold font-mono text-emerald-700">+{newCount.toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Fresh items not currently in catalog</p>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Existing Items to Update:</span>
                          <span className="font-bold font-mono text-amber-700">{updateCount.toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Stock quantity or rate changed in file</p>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Unchanged Items Skipped:</span>
                          <span className="font-bold font-mono text-slate-600">{unchangedCount.toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Identical rate & stock already recorded</p>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Total Quantity to Sync:</span>
                          <span className="font-bold font-mono text-slate-900">{totalUnits.toLocaleString('en-IN')} units</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Valuation: ₹{totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {unpricedCount > 0 && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800 flex items-center gap-2">
                        <Info className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>
                          <strong>{unpricedCount} unpriced items</strong> will be added to the catalog so you can enter rates at the counter during sales.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Operational Safeguards & Consent */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs text-amber-900">
                        <div className="font-bold">Catalog Synchronization Safeguard</div>
                        <p className="text-amber-800 leading-relaxed text-[11px]">
                          This action will apply updates to your store catalog in batches of 500 items. Inventory quantities and wholesale prices will be updated in your database.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 text-xs text-slate-800 pt-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={confirmAcknowledged}
                        onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                        className="rounded border-slate-300 text-[#C81E1E] focus:ring-0 cursor-pointer w-4 h-4"
                      />
                      <span className="font-semibold">
                        I have reviewed the summary and confirm syncing {includedCount.toLocaleString('en-IN')} items.
                      </span>
                    </label>
                  </div>

                  {/* Syncing Progress Bar */}
                  {isProcessing && syncProgress && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-700 font-semibold font-mono">
                        <span>Synchronizing items in batches...</span>
                        <span>{syncProgress.current.toLocaleString()} / {syncProgress.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#C81E1E] h-full transition-all duration-300"
                          style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Success State */
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Import Successful!</h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Successfully imported and updated <strong>{syncedCountTotal.toLocaleString('en-IN')} products</strong> into your TradeLedger inventory catalog.
                    </p>
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-9 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                    >
                      Done / View Inventory
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sticky Footer */}
          {!importCompleted && (
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              {/* Back / Cancel button */}
              <div>
                {currentStep === 1 ? (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="h-8.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => (s - 1) as WizardStep)}
                    disabled={isProcessing}
                    className="h-8.5 px-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}
              </div>

              {/* Primary Forward Action */}
              <div>
                {currentStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (parsedRows.length > 0) setCurrentStep(2);
                    }}
                    disabled={parsedRows.length === 0 || isProcessing}
                    className="h-8.5 px-5 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Continue to Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : currentStep === 2 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={includedCount === 0 || isProcessing}
                    className="h-8.5 px-5 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Review & Confirm ({includedCount.toLocaleString('en-IN')})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={!confirmAcknowledged || includedCount === 0 || isProcessing}
                    className="h-8.5 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>
                      {isProcessing
                        ? 'Synchronizing Products...'
                        : `Commit Import (${includedCount.toLocaleString('en-IN')} Items)`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ClientPortal>
  );
}
