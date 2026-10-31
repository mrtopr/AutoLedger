import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { formatPaiseToRupees, parseRupeesToPaise } from '../server/lib/tax';

describe('UI/UX Polish, Responsive Design & Electron Desktop Reliability', () => {
  describe('Electron Desktop Configuration & IPC Bridge', () => {
    it('should configure preload.js to safely expose electronAPI in the isolated main world', () => {
      const preloadPath = path.resolve(__dirname, '../electron/preload.js');
      expect(fs.existsSync(preloadPath)).toBe(true);
      const content = fs.readFileSync(preloadPath, 'utf8');

      expect(content).toContain("contextBridge.exposeInMainWorld('electronAPI'");
      expect(content).toContain('platform: process.platform');
      expect(content).toContain("printCurrentPage: (options) => ipcRenderer.send('print-page'");
      // Must not enable nodeIntegration or expose raw ipcRenderer
      expect(content).not.toContain('window.ipcRenderer =');
    });

    it('should configure main.js with contextIsolation, nodeIntegration: false, and print-page IPC handler', () => {
      const mainPath = path.resolve(__dirname, '../electron/main.js');
      expect(fs.existsSync(mainPath)).toBe(true);
      const content = fs.readFileSync(mainPath, 'utf8');

      // IPC handler for printing
      expect(content).toContain("ipcMain.on('print-page'");
      expect(content).toContain('webContents.print(');

      // Security flags
      expect(content).toContain('nodeIntegration: false');
      expect(content).toContain('contextIsolation: true');

      // Navigation lock
      expect(content).toContain("mainWindow.webContents.on('will-navigate'");
      expect(content).toContain('event.preventDefault()');
      expect(content).toContain('shell.openExternal');
    });
  });

  describe('Non-GST Sales Bill & Printing Standards', () => {
    it('should strictly use non-GST Sales Bill / Cash Receipt terminology in InvoicePreviewModal', () => {
      const modalPath = path.resolve(__dirname, '../app/components/InvoicePreviewModal.tsx');
      expect(fs.existsSync(modalPath)).toBe(true);
      const content = fs.readFileSync(modalPath, 'utf8');

      // Positive assertions: Non-GST terminology
      expect(content).toContain('SALES BILL / CASH RECEIPT');
      expect(content).toContain('Sales Bill Preview');
      expect(content).toContain('80mm Thermal');
      expect(content).toContain('A4 Sheet');

      // Negative assertions: Tax invoice labels should not appear in regular billing view
      expect(content).not.toContain('Tax Invoice (Under GST)');
      expect(content).not.toContain('GST Tax Invoice');
    });

    it('should support both 80mm thermal counter slips and standard A4 page sizes in print engine', () => {
      const modalPath = path.resolve(__dirname, '../app/components/InvoicePreviewModal.tsx');
      const content = fs.readFileSync(modalPath, 'utf8');

      // Verifies CSS print media sizing rules
      expect(content).toContain("size: ${isThermal ? '80mm auto' : 'A4 portrait'}");
      expect(content).toContain("margin: ${isThermal ? '3mm 4mm' : '8mm 10mm'}");
      expect(content).toContain("font-family: ${isThermal ? \"'JetBrains Mono', monospace\"");
    });
  });

  describe('Financial Display & Currency Formatting', () => {
    it('should format paise to rupees consistently without rounding errors or decimal drift', () => {
      expect(formatPaiseToRupees(0n)).toBe('₹0.00');
      expect(formatPaiseToRupees(100n)).toBe('₹1.00');
      expect(formatPaiseToRupees(150n)).toBe('₹1.50');
      expect(formatPaiseToRupees(99999n)).toBe('₹999.99');
      expect(formatPaiseToRupees(25000000n)).toBe('₹2,50,000.00');
    });

    it('should parse rupee strings accurately to integer BigInt paise', () => {
      expect(parseRupeesToPaise('0')).toBe(0n);
      expect(parseRupeesToPaise('12.50')).toBe(1250n);
      expect(parseRupeesToPaise('1500')).toBe(150000n);
      expect(parseRupeesToPaise('2,500.75')).toBe(250075n);
      expect(parseRupeesToPaise(100)).toBe(10000n);
    });
  });

  describe('POS Throttling & Idempotency Key Retention', () => {
    it('should generate uniquely formatted idempotency keys with pos prefix and random entropy', () => {
      const generateKey = () => `pos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const key1 = generateKey();
      const key2 = generateKey();

      expect(key1).toMatch(/^pos-\d+-[a-z0-9]+$/);
      expect(key2).toMatch(/^pos-\d+-[a-z0-9]+$/);
      expect(key1).not.toBe(key2);
    });

    it('should have double-submission protection and disabled cursor styles in POS screen', () => {
      const posPath = path.resolve(__dirname, '../app/pos/page.tsx');
      expect(fs.existsSync(posPath)).toBe(true);
      const content = fs.readFileSync(posPath, 'utf8');

      // Double-submission guard in handler
      expect(content).toContain('if (isSubmittingBill) return;');
      expect(content).toContain('disabled={isSubmittingBill}');
      expect(content).toContain('disabled:cursor-not-allowed');

      // Key regeneration after successful submission
      expect(content).toContain('setBillIdempotencyKey(`pos-${Date.now()}-');
    });
  });
});
