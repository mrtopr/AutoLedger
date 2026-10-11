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
  Car,
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
  Table as TableIcon,
  FolderTree
} from 'lucide-react';
import ClientPortal from './ClientPortal';
import { 
  parseTallyInventorySheet, 
  TallyParseResult, 
  TallyParsedItem 
} from '@/app/lib/tallyParser';

// Fields that columns can be mapped to
export type TargetField = 
  | 'NAME' 
  | 'PART_NUMBER' 
  | 'BRAND' 
  | 'CATEGORY' 
  | 'SALE_PRICE' 
  | 'COST_PRICE' 
  | 'MRP' 
  | 'STOCK_QTY' 
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

type PreviewFilterType = 'ALL' | 'TO_SYNC' | 'NEW' | 'UPDATED' | 'UNCHANGED' | 'UNPRICED';

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'PASTE' | 'MAPPER' | 'PREVIEW' | 'GUIDE'>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  
  // Raw 2D table extracted from file or clipboard
  const [rawTableRows, setRawTableRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  
  // Tally Auto-Detection State
  const [tallyResult, setTallyResult] = useState<TallyParseResult | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  
  // Default values for missing columns
  const [defaultBrand, setDefaultBrand] = useState('Standard');
  const [defaultCategory, setDefaultCategory] = useState('Automobile Spares');
  const [defaultGstPercent, setDefaultGstPercent] = useState('18');
  
  // Final preview parsed rows with interactive state
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [originalRows, setOriginalRows] = useState<ParsedProductRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilterType>('ALL');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewViewMode, setPreviewViewMode] = useState<'TABLE' | 'GROUPS'>('TABLE');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  
  // Direct text paste state
  const [pasteText, setPasteText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
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
      setActiveTab('UPLOAD');
    }
  }, [isOpen]);

  // Sample CSV Template download
  const sampleCSV = `Item Description,Pack / Qty,MRP (INR),Net Rate (INR),Part No,Brand,Category,GST %
Castrol 4T 20W40 900ml,24,410,350,CAS-20W40,Castrol,Lubricants & Oils,18
Front Brake Shoe Set,40,270,220,BS-ACT-01,Honda Genuine,Brakes & Friction,18
LED Headlight Bulb H4,15,599,480,LED-H4-35W,Philips,Electrical,18
Drive V-Belt,20,380,310,BLT-ACT-99,Bando,Belts & Chains,18
Clutch Cable Complete,30,165,120,CC-HON-110,Endurance,Control Cables,18`;

  const handleDownloadSample = () => {
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

  // Dynamically load SheetJS for reading binary .xlsx / .xls files in browser
  const loadSheetJS = async (): Promise<any> => {
    if (typeof window !== 'undefined' && (window as any).XLSX) {
      return (window as any).XLSX;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = () => reject(new Error('Failed to load Excel parsing engine.'));
      document.head.appendChild(script);
    });
  };

  // Column name pattern match
  const guessTargetField = (header: string, sampleVal: string): TargetField => {
    const h = (header ? String(header) : '').toLowerCase();
    if (h.includes('name') || h.includes('desc') || h.includes('item') || h.includes('particular')) return 'NAME';
    if (h.includes('part') || h.includes('sku') || h.includes('code') || h.includes('oem')) return 'PART_NUMBER';
    if (h.includes('qty') || h.includes('quantity') || h.includes('stock') || h.includes('balance') || h.includes('closing')) return 'STOCK_QTY';
    if (h.includes('unit') || h.includes('uom') || h.includes('pkg')) return 'UNIT';
    if (h.includes('mrp') || h.includes('retail') || h.includes('maxretail')) return 'MRP';
    if (h.includes('cost') || h.includes('purchase') || h.includes('buy') || h.includes('cp') || h.includes('dp')) return 'COST_PRICE';
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
        setActiveTab('PREVIEW');
      } else {
        // Fallback to manual column mapper
        setActiveTab('MAPPER');
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

      const salePrice = saleCol ? cleanNum(row[saleCol.colIndex], '') : '';
      const mrp = mrpCol ? cleanNum(row[mrpCol.colIndex], '') : salePrice;
      const costPrice = costCol ? cleanNum(row[costCol.colIndex], '') : salePrice;
      const stock = stockCol ? parseInt(cleanNum(row[stockCol.colIndex], '0'), 10) || 0 : 0;
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
    setActiveTab('PREVIEW');
  };

  // ==========================================
  // Interactive In-Place Editing & Deletion
  // ==========================================
  const handleUpdateRowCell = (id: string, field: keyof ParsedProductRow, val: any) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };

      // Auto-recalculate amount when rate or quantity is edited
      if (field === 'stockQty' || field === 'salePriceRupees') {
        const q = field === 'stockQty' ? Number(val || 0) : r.stockQty;
        const p = field === 'salePriceRupees' ? parseFloat(val || '0') : parseFloat(r.salePriceRupees || '0');
        if (!isNaN(q) && !isNaN(p) && p > 0) {
          updated.amountRupees = (q * p).toFixed(2);
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
      setErrorMsg('No items selected for sync. Please select at least one row using the checkboxes.');
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

      // Chunk in batches of 1,000 to keep network payloads fast, responsive & visible
      const CHUNK_SIZE = 1000;
      let totalSynced = 0;
      setSyncProgress({ current: 0, total: payloadItems.length });

      for (let i = 0; i < payloadItems.length; i += CHUNK_SIZE) {
        const chunk = payloadItems.slice(i, i + CHUNK_SIZE);
        const res = await fetch('/api/v1/products/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: chunk }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Bulk import failed');

        const count = (data.importedCount || 0) + (data.updatedCount || 0);
        totalSynced += count;
        setSyncProgress({
          current: Math.min(i + chunk.length, payloadItems.length),
          total: payloadItems.length,
        });
      }

      onSuccess(totalSynced);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit inventory feed.');
    } finally {
      setIsProcessing(false);
      setSyncProgress(null);
    }
  };

  // Filter rows for interactive preview
  const filteredPreview = useMemo(() => {
    return parsedRows.filter(r => {
      // Group filter (e.g. ACCURA, AS, CASTROL)
      if (selectedGroupFilter !== 'ALL') {
        const itemGroup = r.groupHeading || r.brand || 'Uncategorized';
        if (itemGroup !== selectedGroupFilter) return false;
      }

      // Status filter
      if (previewFilter === 'TO_SYNC' && !r.isIncluded) return false;
      if (previewFilter === 'NEW' && r.syncStatus !== 'NEW') return false;
      if (previewFilter === 'UPDATED' && r.syncStatus !== 'UPDATED') return false;
      if (previewFilter === 'UNCHANGED' && r.syncStatus !== 'UNCHANGED') return false;
      if (previewFilter === 'UNPRICED' && !r.isUnpriced) return false;

      // Text search
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

  // Available groups for clean dropdown and sidebar explorer
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

  const filteredAvailableGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return availableGroups;
    const q = groupSearchQuery.toLowerCase();
    return availableGroups.filter(([grp]) => grp.toLowerCase().includes(q));
  }, [availableGroups, groupSearchQuery]);

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
  const totalValuation = parsedRows.filter(r => r.isIncluded).reduce((sum, r) => sum + (Number(r.salePriceRupees || 0) * r.stockQty), 0);

  if (!isOpen) return null;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-7xl w-full h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8F9FA] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#C81E1E] border border-red-200 flex items-center justify-center font-bold shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#0F172A]">Tally Stock Summary & Inventory Feeder</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Auto-Hierarchy & Smart Sync</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-5 border-b border-[#E2E8F0] bg-white flex items-center justify-between overflow-x-auto gap-2">
            <div className="flex items-center space-x-1 sm:space-x-2 text-xs font-semibold py-1.5">
              <button
                onClick={() => setActiveTab('UPLOAD')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'UPLOAD'
                    ? 'bg-red-50 text-[#C81E1E] font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>1. Upload Sheet</span>
              </button>

              <button
                onClick={() => setActiveTab('PASTE')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'PASTE'
                    ? 'bg-red-50 text-[#C81E1E] font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Quick Paste (Ctrl+V)</span>
              </button>

              {parsedRows.length > 0 && (
                <button
                  onClick={() => setActiveTab('PREVIEW')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'PREVIEW'
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Interactive Preview ({parsedRows.length})</span>
                </button>
              )}

              {rawTableRows.length > 0 && (
                <button
                  onClick={() => setActiveTab('MAPPER')}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'MAPPER'
                      ? 'bg-red-50 text-[#C81E1E] font-bold'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Column Mapper</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('GUIDE')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'GUIDE'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Format Guide</span>
              </button>
            </div>

            {/* Template Download */}
            <button
              onClick={handleDownloadSample}
              className="text-[11px] font-semibold text-slate-600 hover:text-[#C81E1E] transition underline cursor-pointer shrink-0 hidden sm:inline-block"
            >
              Download Sample CSV
            </button>
          </div>

          {/* Modal Body */}
          <div className={`flex-1 p-3.5 sm:p-4 space-y-3 ${activeTab === 'PREVIEW' ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-y-auto'}`}>
            
            {/* Notifications / Alerts */}
            {errorMsg && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#B91C1C] flex items-center gap-2 font-medium animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span className="flex-1">{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-700 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {statusFeedback && (
              <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs text-[#15803D] flex items-center gap-2 font-medium animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>{statusFeedback}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: UPLOAD FILE                                       */}
            {/* ======================================================== */}
            {activeTab === 'UPLOAD' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#CBD5E1] hover:border-[#C81E1E] bg-[#F8F9FA] hover:bg-red-50/20 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-white group-hover:bg-red-50 text-[#64748B] group-hover:text-[#C81E1E] border border-[#E2E8F0] group-hover:border-red-200 flex items-center justify-center transition shadow-2xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0F172A] group-hover:text-[#C81E1E] transition">
                      Click to browse or drag & drop your Tally / Excel inventory export here
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 max-w-lg mx-auto">
                      Directly handles <strong>TallyPrime Stock Summary</strong> spreadsheets, multi-level headers, and price sheets.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-slate-500 pt-1">
                    <span className="px-2 py-0.5 rounded bg-white border border-[#E2E8F0]">Tally Excel (.xlsx)</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-[#E2E8F0]">Excel 97-2003 (.xls)</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-[#E2E8F0]">CSV (.csv)</span>
                  </div>
                </div>

                {isProcessing && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C81E1E]" />
                    <span>Analyzing Tally hierarchy, comparing with existing stock...</span>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: QUICK PASTE                                       */}
            {/* ======================================================== */}
            {activeTab === 'PASTE' && (
              <div className="space-y-4">
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 text-xs text-[#1E40AF] flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Instant Copy-Paste from Tally or Excel</div>
                    <p className="text-[#3B82F6] mt-0.5">
                      Copy rows directly from your open Tally screen or Excel sheet (<strong>Ctrl+C</strong>) and paste here (<strong>Ctrl+V</strong>).
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={8}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`Particulars\tClosing Balance Qty\tRate\tValue\nACCURA\t\t\t14905.81\nACR.HLV,DIS 100 ( RED )\t\t\t\nACR.HLV, D-YUGA (BLK/GREY)\t1 PCS\t180.70\t180.70\nAS. 6003 BEARING\t9 PCS\t33.50\t301.50`}
                    className="w-full p-3 font-mono text-xs bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl focus:bg-white focus:border-[#C81E1E] outline-hidden transition resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handlePasteSubmit}
                      disabled={isProcessing || !pasteText.trim()}
                      className="h-8 px-4 bg-[#C81E1E] hover:bg-[#A81818] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Analyze Pasted Data</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: COLUMN MAPPER (Fallback)                          */}
            {/* ======================================================== */}
            {activeTab === 'MAPPER' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  Assign each column manually if your spreadsheet does not follow standard Tally formatting:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {columnMappings.map((col, idx) => (
                    <div key={idx} className="p-3 border border-[#E2E8F0] rounded-xl bg-white space-y-1.5">
                      <div className="text-[11px] font-bold text-[#0F172A] truncate" title={col.rawHeader}>
                        {col.rawHeader}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate" title={col.sampleValue}>
                        Sample: {col.sampleValue || '—'}
                      </div>
                      <select
                        value={col.targetField}
                        onChange={(e) => {
                          const updated = [...columnMappings];
                          updated[idx].targetField = e.target.value as TargetField;
                          setColumnMappings(updated);
                        }}
                        className="w-full h-7 text-xs bg-slate-50 border border-slate-300 rounded-md px-2 font-medium"
                      >
                        <option value="NAME">Product Name / Particulars</option>
                        <option value="STOCK_QTY">Quantity</option>
                        <option value="SALE_PRICE">Selling Rate (₹)</option>
                        <option value="COST_PRICE">Purchase / Cost Price (₹)</option>
                        <option value="MRP">MRP (₹)</option>
                        <option value="PART_NUMBER">Part / SKU Number</option>
                        <option value="BRAND">Brand / Make</option>
                        <option value="CATEGORY">Category</option>
                        <option value="UNIT">Unit (PCS, NOS, SET)</option>
                        <option value="GST_RATE">GST Rate (%)</option>
                        <option value="HSN_CODE">HSN Code</option>
                        <option value="IGNORE">— Ignore Column —</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={generatePreviewFromManualMappings}
                    className="h-8 px-4 bg-[#C81E1E] hover:bg-[#A81818] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>Proceed to Interactive Preview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: INTERACTIVE PREVIEW & CORRECTION (Main Engine)    */}
            {/* ======================================================== */}
            {activeTab === 'PREVIEW' && (
              <div className="space-y-2.5 animate-in fade-in flex-1 flex flex-col min-h-0">
                
                {/* 1. Executive Top Bar: Company Info + Group Dropdown + View Switcher */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {tallyResult?.companyTitle || 'Tally Stock Summary'}
                    </span>
                    {tallyResult?.dateRange && (
                      <span className="text-[11px] font-mono font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {tallyResult.dateRange}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      ({parsedRows.length.toLocaleString('en-IN')} SKUs parsed)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Group Filter Dropdown */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] font-semibold text-slate-500">Group:</span>
                      <select
                        value={selectedGroupFilter}
                        onChange={(e) => setSelectedGroupFilter(e.target.value)}
                        className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[190px] truncate"
                      >
                        <option value="ALL">All Groups ({parsedRows.length})</option>
                        {availableGroups.map(([grp, data]) => (
                          <option key={grp} value={grp}>
                            {grp} ({data.count})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* View Switcher: Table vs Groups */}
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                      <button
                        onClick={() => setPreviewViewMode('TABLE')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewViewMode === 'TABLE'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <TableIcon className="w-3.5 h-3.5 text-[#C81E1E]" />
                        <span>Table</span>
                      </button>
                      <button
                        onClick={() => setPreviewViewMode('GROUPS')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewViewMode === 'GROUPS'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                        <span>Groups</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Unified Live Filter Chips + Search Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl shrink-0">
                  {/* Status Pills with Dynamic Counts */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      onClick={() => setPreviewFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                        previewFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>All</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${previewFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {parsedRows.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewFilter('TO_SYNC')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                        previewFilter === 'TO_SYNC'
                          ? 'bg-[#16A34A] text-white shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <span>To Sync</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${previewFilter === 'TO_SYNC' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                        {includedCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewFilter('NEW')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                        previewFilter === 'NEW'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>New</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${previewFilter === 'NEW' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                        +{newCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewFilter('UPDATED')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                        previewFilter === 'UPDATED'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Updates</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${previewFilter === 'UPDATED' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                        {updateCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewFilter('UNCHANGED')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                        previewFilter === 'UNCHANGED'
                          ? 'bg-slate-700 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>Skipped</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${previewFilter === 'UNCHANGED' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {unchangedCount}
                      </span>
                    </button>

                    {unpricedCount > 0 && (
                      <button
                        onClick={() => setPreviewFilter('UNPRICED')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                          previewFilter === 'UNPRICED'
                            ? 'bg-purple-700 text-white shadow-2xs'
                            : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>Unpriced</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${previewFilter === 'UNPRICED' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700'}`}>
                          {unpricedCount}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full lg:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      placeholder="Search items, models, brands..."
                      className="w-full h-7.5 pl-8 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#C81E1E] outline-hidden transition"
                    />
                  </div>
                </div>

                {/* 3. Batch Action & Counter Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectAll(true)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select All</span>
                    </button>
                    <button
                      onClick={() => handleSelectAll(false)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deselect All</span>
                    </button>
                    <button
                      onClick={handleDeleteUnselected}
                      className="px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded-md border border-red-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete Unselected</span>
                    </button>
                    <button
                      onClick={handleResetToOriginal}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                    >
                      Reset Edits
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    Showing {filteredPreview.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredPreview.length)} of {filteredPreview.length} items
                  </div>
                </div>

                {/* 4. Main Body: Split View (Group Explorer) OR Full-Width Table */}
                <div className={`flex-1 min-h-0 ${previewViewMode === 'GROUPS' ? 'grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch' : 'flex flex-col'}`}>
                  
                  {/* Left Sidebar: Groups & Brands (Shown only in Group Explorer mode) */}
                  {previewViewMode === 'GROUPS' && (
                    <div className="md:col-span-1 border border-slate-200 rounded-xl bg-white p-2.5 space-y-2 flex flex-col h-full shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                          <span>Stock Groups ({availableGroups.length})</span>
                        </span>
                        <button
                          onClick={() => setSelectedGroupFilter('ALL')}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition ${
                            selectedGroupFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          All ({parsedRows.length})
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          placeholder="Search groups..."
                          className="w-full h-7 pl-6 pr-2 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-[#C81E1E] outline-hidden"
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50 text-xs">
                        <button
                          onClick={() => setSelectedGroupFilter('ALL')}
                          className={`w-full text-left p-2 rounded-lg transition cursor-pointer flex items-center justify-between ${
                            selectedGroupFilter === 'ALL'
                              ? 'bg-red-50 text-[#C81E1E] border border-red-200 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="truncate">All Groups & Items</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 shrink-0">
                            {parsedRows.length}
                          </span>
                        </button>

                        {filteredAvailableGroups.map(([grp, data]) => (
                          <button
                            key={grp}
                            onClick={() => setSelectedGroupFilter(grp)}
                            className={`w-full text-left p-2 rounded-lg transition cursor-pointer flex items-center justify-between ${
                              selectedGroupFilter === grp
                                ? 'bg-red-50 text-[#C81E1E] border border-red-200 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="truncate font-semibold text-[11px]">{grp}</div>
                              {data.totalValuation > 0 && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  ₹{data.totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                              )}
                            </div>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 shrink-0">
                              {data.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Right Main Column (or Full Width): Table */}
                  <div className={`flex flex-col min-h-0 flex-1 ${previewViewMode === 'GROUPS' ? 'md:col-span-3' : 'w-full'}`}>
                    
                    {/* Interactive Paginated Data Table */}
                    <div className="border border-[#E2E8F0] rounded-xl overflow-auto flex-1 min-h-0 bg-white shadow-2xs">
                      <table className="min-w-[1150px] w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-[#F8F9FA] z-10 border-b border-[#E2E8F0]">
                          <tr className="text-[#64748B] text-[10px] uppercase font-semibold">
                            <th className="py-2.5 px-2 text-center w-10">
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
                            <th className="py-2.5 px-3 min-w-[340px]">Product Name (Click to Edit)</th>
                            <th className="py-2.5 px-2 min-w-[160px]">Subcategory / Category</th>
                            <th className="py-2.5 px-2 min-w-[110px]">Brand</th>
                            <th className="py-2.5 px-2 min-w-[160px]">Model</th>
                            <th className="py-2.5 px-2 text-center w-16">Stock</th>
                            <th className="py-2.5 px-2 text-center w-14">Unit</th>
                            <th className="py-2.5 px-2 text-right w-24">Rate (₹)</th>
                            <th className="py-2.5 px-2 text-right w-24">Amount (₹)</th>
                            <th className="py-2.5 px-2 text-center w-12">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] text-xs">
                          {paginatedRows.map((row) => (
                            <tr 
                              key={row.id} 
                              className={`transition ${
                                !row.isIncluded 
                                  ? 'bg-slate-50/70 opacity-50' 
                                  : row.syncStatus === 'UPDATED'
                                  ? 'bg-amber-50/30 hover:bg-amber-50/60'
                                  : row.syncStatus === 'NEW'
                                  ? 'hover:bg-[#F0FDF4]/30'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.isIncluded}
                                  onChange={() => handleToggleInclude(row.id)}
                                  className="rounded border-slate-300 text-[#C81E1E] focus:ring-0 cursor-pointer"
                                />
                              </td>

                              {/* Sync Action Badge */}
                              <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {row.syncStatus === 'NEW' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                                      New
                                    </span>
                                  ) : row.syncStatus === 'UPDATED' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title={row.statusReason}>
                                      Updated
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300" title={row.statusReason}>
                                      Skipped
                                    </span>
                                  )}
                                  {row.isUnpriced && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Unpriced item — rate entered during billing">
                                      Unpriced
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Product Name (Editable) */}
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={row.name}
                                  title={row.name}
                                  onChange={(e) => handleUpdateRowCell(row.id, 'name', e.target.value)}
                                  className="w-full text-xs font-semibold text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1.5 py-0.5 outline-hidden transition"
                                />
                                {row.warnings.filter(w => !w.toLowerCase().includes('rate & qty missing')).length > 0 && (
                                  <div className="text-[10px] text-amber-600 px-1.5 font-medium truncate">
                                    {row.warnings.filter(w => !w.toLowerCase().includes('rate & qty missing')).join('; ')}
                                  </div>
                                )}
                              </td>

                              {/* Subcategory & Category (Editable) */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.subcategory || row.category}
                                  title={row.subcategory || row.category}
                                  onChange={(e) => handleUpdateRowCell(row.id, 'subcategory', e.target.value)}
                                  className="w-full text-[11px] font-medium text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
                                />
                              </td>

                              {/* Brand (Editable) */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.brand}
                                  title={row.brand}
                                  onChange={(e) => handleUpdateRowCell(row.id, 'brand', e.target.value)}
                                  className="w-full text-[11px] font-semibold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
                                />
                              </td>

                              {/* Compatible Models (Editable) */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.models.join(', ')}
                                  title={row.models.join(', ')}
                                  onChange={(e) => handleUpdateRowCell(row.id, 'models', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                  className="w-full text-[11px] font-medium text-blue-700 bg-transparent hover:bg-blue-50/50 focus:bg-white focus:border-blue-400 border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition"
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

                              {/* Rate (Editable) */}
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="text"
                                  value={row.salePriceRupees}
                                  placeholder={row.isUnpriced ? '—' : '0.00'}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    handleUpdateRowCell(row.id, 'salePriceRupees', v);
                                    handleUpdateRowCell(row.id, 'purchasePriceRupees', v);
                                    if (parseFloat(v) > 0) {
                                      handleUpdateRowCell(row.id, 'isUnpriced', false);
                                    }
                                  }}
                                  className="w-18 text-right text-xs font-bold font-mono text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition tabular-nums"
                                />
                              </td>

                              {/* Amount (Auto or Editable) */}
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="text"
                                  value={row.amountRupees || ''}
                                  placeholder={row.isUnpriced ? '—' : '0.00'}
                                  onChange={(e) => handleUpdateRowCell(row.id, 'amountRupees', e.target.value)}
                                  className="w-18 text-right text-xs font-mono text-slate-600 bg-transparent hover:bg-slate-100 focus:bg-white focus:border-[#C81E1E] border border-transparent focus:border rounded px-1 py-0.5 outline-hidden transition tabular-nums"
                                />
                              </td>

                              {/* Delete Action */}
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  onClick={() => handleDeleteRow(row.id)}
                                  title="Delete row from import batch"
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {paginatedRows.length === 0 && (
                            <tr>
                              <td colSpan={11} className="py-12 text-center text-xs text-slate-500">
                                No items match your active filter or search criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Navigation Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 shrink-0 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">Rows per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="h-7 text-xs font-semibold bg-white border border-slate-300 rounded-md px-2"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={250}>250</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition flex items-center gap-1 font-semibold cursor-pointer shadow-2xs"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Previous</span>
                        </button>
                        <span className="px-2.5 text-[11px] font-mono text-slate-600">
                          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                        </span>
                        <button
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
                </div>

              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 5: FORMAT GUIDE                                      */}
            {/* ======================================================== */}
            {activeTab === 'GUIDE' && (
              <div className="space-y-4">
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 text-xs text-[#1E40AF] flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">Automated TallyPrime Dissection & Synchronization</div>
                    <p className="text-[#3B82F6] leading-relaxed">
                      TradeLedger parses your detailed Tally Stock Summary directly without needing reformatting. It understands parent groups like <code>ACCURA</code>, sub-categories like <code>HLV</code> (Head Light Visor), vehicle models like <code>DIS 100</code>, and respects items with missing rates by queuing them for billing.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#C81E1E]" />
                      <span>1. Group Headings</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Parent rows like <code>ACCURA</code> or <code>AS</code> with total valuations are recognized as Brands & Groups, not products.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      <span>2. Smart Deduplication</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      If an item is already present in TradeLedger, it updates only when rates or quantities change. Unchanged items are automatically skipped!
                    </p>
                  </div>

                  <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5 text-purple-600" />
                      <span>3. Missing Rates & Stock</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Items with blank rates or quantities are added as valid catalog items so you can assign prices on the fly during counter billing.
                    </p>
                  </div>
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
                  className="h-8 px-3 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="h-8 px-4 bg-white hover:bg-[#F8F9FA] text-[#475569] border border-[#CBD5E1] rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>

              {activeTab === 'PREVIEW' ? (
                <button
                  onClick={handleCommitImport}
                  disabled={isProcessing || includedCount === 0}
                  className="h-8 px-5 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>
                    {isProcessing
                      ? (syncProgress
                          ? `Syncing ${syncProgress.current.toLocaleString()} / ${syncProgress.total.toLocaleString()}...`
                          : 'Synchronizing...')
                      : `Confirm & Sync (${includedCount.toLocaleString()} Items)`}
                  </span>
                </button>
              ) : activeTab === 'MAPPER' ? (
                <button
                  onClick={generatePreviewFromManualMappings}
                  className="h-8 px-5 bg-[#C81E1E] hover:bg-[#A81818] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Preview Ingestion</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

        </div>
      </div>
    </ClientPortal>
  );
}
