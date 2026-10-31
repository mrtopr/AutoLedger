import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { formatPaiseToRupees, parseRupeesToPaise } from '@/server/lib/tax';

describe('Fix 18: Bill Format Redesign + Subtle UI Animations', () => {
  const rootDir = process.cwd();
  const modalPath = path.join(rootDir, 'app/components/InvoicePreviewModal.tsx');
  const cssPath = path.join(rootDir, 'app/globals.css');

  it('verifies InvoicePreviewModal strictly preserves neutral Non-GST Sales Bill / Cash Receipt terminology', () => {
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    // Positive terminology checks
    expect(modalCode).toContain('SALES BILL / CASH RECEIPT');
    expect(modalCode).toContain('Sales Bill Preview');
    expect(modalCode).toContain('80mm Thermal Receipt');
    expect(modalCode).toContain('A4 Sheet');

    // Negative terminology checks: No GST tax invoice claims or tax calculation headers
    expect(modalCode).not.toContain('Tax Invoice (Under GST)');
    expect(modalCode).not.toContain('GST Tax Invoice');
    expect(modalCode).not.toContain('GSTIN:');
  });

  it('verifies both A4 and 80mm thermal receipt formats are supported with proper print page rules', () => {
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    expect(modalCode).toContain("size: ${isThermal ? '80mm auto' : 'A4 portrait'}");
    expect(modalCode).toContain("margin: ${isThermal ? '3mm 4mm' : '8mm 10mm'}");
    expect(modalCode).toContain("font-family: ${isThermal ? \"'JetBrains Mono', monospace\"");
    expect(modalCode).toContain('break-inside: avoid !important');
    expect(modalCode).toContain('page-break-inside: avoid !important');
  });

  it('verifies graceful handling of walk-in customers and missing optional fields', () => {
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    // Handles walk-in customer gracefully without URP or N/A clutter
    expect(modalCode).toContain('isWalkIn');
    expect(modalCode).toContain('Walk-in Retail Customer');
    expect(modalCode).toContain('Counter Retail Customer');
    expect(modalCode).not.toContain('URP (Unregistered Dealer)');
  });

  it('verifies support for line discounts and totals breakdown in bill preview', () => {
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    expect(modalCode).toContain('hasDiscounts');
    expect(modalCode).toContain('discountTotalPaise');
    expect(modalCode).toContain('Items Subtotal:');
    expect(modalCode).toContain('Grand Total:');
    expect(modalCode).toContain('Paid at Counter:');
    expect(modalCode).toContain('Khata Balance Due');
  });

  it('verifies subtle button animations, pressed feedback, and reduced-motion safety in globals.css', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    // Button transitions and active press feedback
    expect(css).toContain('button:not(:disabled), .btn:not(:disabled)');
    expect(css).toContain('transition: all 150ms cubic-bezier');
    expect(css).toContain('button:active:not(:disabled), .btn:active:not(:disabled)');
    expect(css).toContain('transform: scale(0.98)');
    expect(css).toContain('button:disabled, .btn:disabled');

    // Subtle dialog/receipt fade-slide animation
    expect(css).toContain('@keyframes subtleFadeSlide');
    expect(css).toContain('.animate-subtle-slide');

    // prefers-reduced-motion safety
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('transform: none !important');

    // Print media disables all animations and transitions
    expect(css).toContain('@media print');
    expect(css).toContain('animation: none !important');
    expect(css).toContain('transition: none !important');
  });

  it('verifies monetary calculations and currency formatting accuracy for multiple items', () => {
    // 3 items with exact paise calculations
    const item1Paise = 25000n; // ₹250.00
    const item2Paise = 18550n; // ₹185.50
    const item3Paise = 120000n; // ₹1200.00
    const totalPaise = item1Paise + item2Paise + item3Paise;

    expect(formatPaiseToRupees(totalPaise)).toBe('₹1,635.50');

    // Partial payment simulation: paid ₹1000, due ₹635.50
    const paidPaise = 100000n;
    const duePaise = totalPaise - paidPaise;
    expect(formatPaiseToRupees(paidPaise)).toBe('₹1,000.00');
    expect(formatPaiseToRupees(duePaise)).toBe('₹635.50');
  });
});
