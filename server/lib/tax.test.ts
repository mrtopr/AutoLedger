import { describe, it, expect } from 'vitest';
import { calculateInvoiceTax, formatPaiseToRupees, parseRupeesToPaise } from './tax';

describe('Tax Calculation Engine (tax.ts)', () => {
  it('should accurately calculate standard intrastate GST with 18% tax and line discounts', () => {
    const items = [
      {
        qty: 2,
        rate: 35000n, // ₹350.00
        discountPercent: 5, // 5% disc -> ₹35.00 disc -> taxable ₹665.00 (66500 paise)
        gstRateBp: 1800, // 18% GST -> ₹119.70 (11970 paise)
      },
      {
        qty: 1,
        rate: 120000n, // ₹1,200.00
        discountPaise: 5000n, // ₹50.00 disc -> taxable ₹1,150.00 (115000 paise)
        gstRateBp: 1800, // 18% GST -> ₹207.00 (20700 paise)
      },
    ];

    const result = calculateInvoiceTax(items, '27', '27');

    // Subtotal: (2 * 350) + 1200 = ₹1,900.00 (190000 paise)
    expect(result.subtotal).toBe(190000n);
    // Line Discounts: 3500 + 5000 = 8500 paise (₹85.00)
    expect(result.discountTotal).toBe(8500n);
    // Taxable Value: 190000 - 8500 = 181500 paise (₹1,815.00)
    expect(result.taxableValue).toBe(181500n);
    // Total Tax: 18% of 181500 = 32670 paise (₹326.70)
    expect(result.totalTax).toBe(32670n);
    // CGST: 16335 paise, SGST: 16335 paise
    expect(result.cgst).toBe(16335n);
    expect(result.sgst).toBe(16335n);
    expect(result.igst).toBe(0n);
    // Unrounded grand total: 181500 + 32670 = 214170 paise (₹2,141.70)
    // Round off: -70 paise (to ₹2,141.00) or +30 paise (if >= 50)
    // 70 >= 50 -> roundOff = +30 paise -> Grand total = 214200 paise (₹2,142.00)
    expect(result.roundOff).toBe(30n);
    expect(result.grandTotal).toBe(214200n);
  });

  it('should split GST into IGST for interstate transactions', () => {
    const items = [
      {
        qty: 1,
        rate: 100000n, // ₹1,000.00
        gstRateBp: 1800, // 18%
      },
    ];

    const result = calculateInvoiceTax(items, '27', '24'); // MH to Gujarat

    expect(result.cgst).toBe(0n);
    expect(result.sgst).toBe(0n);
    expect(result.igst).toBe(18000n);
    expect(result.grandTotal).toBe(118000n);
  });

  it('should reverse calculate base taxable value for tax-inclusive pricing', () => {
    const items = [
      {
        qty: 1,
        rate: 118000n, // ₹1,180.00 inclusive of 18% GST
        gstRateBp: 1800,
        isTaxInclusive: true,
      },
    ];

    const result = calculateInvoiceTax(items, '27', '27');

    expect(result.taxableValue).toBe(100000n); // ₹1,000.00
    expect(result.totalTax).toBe(18000n); // ₹180.00
    expect(result.grandTotal).toBe(118000n); // ₹1,180.00
  });

  it('should handle currency formatting and parsing accurately without float errors', () => {
    expect(formatPaiseToRupees(1500000n)).toContain('15,000.00');
    expect(formatPaiseToRupees(0n)).toContain('0.00');
    expect(parseRupeesToPaise('1,250.50')).toBe(125050n);
    expect(parseRupeesToPaise('₹ 25,000')).toBe(2500000n);
  });
});
