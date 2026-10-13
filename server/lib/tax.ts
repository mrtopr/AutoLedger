/**
 * Currency & Invoice Helper Utilities
 * Provides monetary conversion between Indian Rupees (INR) and Paise (integers)
 * to prevent floating point inaccuracies across Ledger, Khata, and POS billing.
 */

export interface LineItemInput {
  productId?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  rate?: number | bigint;
  ratePaise?: number | bigint;
  pricePaise?: number | bigint;
  taxRate?: number;
  discountPaise?: number | bigint;
  discountPercent?: number | string;
  gstRateBp?: number;
  isTaxInclusive?: boolean;
  [key: string]: any;
}

export interface ComputedLineItem {
  qty: number;
  rate: bigint;
  discount: bigint;
  taxableValue: bigint;
  gstRateBp: number;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  taxAmount: bigint;
  lineTotal: bigint;
}

export interface InvoiceTaxSummary {
  items?: ComputedLineItem[];
  subtotal: bigint;
  discountTotal: bigint;
  taxableValue: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  totalTax: bigint;
  roundOff: bigint;
  grandTotal: bigint;
}

/**
 * Parses a rupee input (string, number, or bigint) into an exact bigint paise amount.
 * Example: "100.50" -> 10050n, 50 -> 5000n, "50000" -> 5000000n
 */
export function parseRupeesToPaise(val: string | number | bigint | null | undefined): bigint {
  if (val === null || val === undefined) return 0n;
  if (typeof val === 'bigint') return val;
  const str = String(val).trim().replace(/,/g, '');
  if (!str) return 0n;
  const num = Number(str);
  if (isNaN(num)) return 0n;
  const isNegative = str.startsWith('-');
  const absStr = isNegative ? str.slice(1) : str;
  const [wholePart, fracPart = ''] = absStr.split('.');
  const whole = BigInt(wholePart || '0');
  const fraction = BigInt((fracPart + '00').slice(0, 2));
  const result = whole * 100n + fraction;
  return isNegative ? -result : result;
}

/**
 * Formats a paise amount into an Indian Rupee formatted string (e.g. ₹50,000.00).
 */
export function formatPaiseToRupees(
  paise: bigint | number | string | null | undefined,
  showSymbol = true
): string {
  if (paise === null || paise === undefined) return showSymbol ? '₹0.00' : '0.00';
  let p: bigint;
  try {
    p = typeof paise === 'bigint' ? paise : BigInt(Math.round(Number(paise) || 0));
  } catch {
    p = 0n;
  }
  const isNegative = p < 0n;
  const absP = isNegative ? -p : p;
  const whole = absP / 100n;
  const frac = absP % 100n;
  const rupeesNumber = Number(whole) + Number(frac) / 100;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupeesNumber);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Calculates invoice totals and tax breakdown for POS billing and invoices.
 * Supports both signatures:
 *   calculateInvoiceTax(items, '27', placeOfSupply, invoiceDiscountPaise)
 *   calculateInvoiceTax(items, isInterState, roundOff)
 */
export function calculateInvoiceTax(
  items: LineItemInput[] = [],
  tenantOrInterState: string | boolean = '27',
  placeOfSupplyOrRoundOff: string | boolean = '27',
  invoiceDiscountPaise: bigint = 0n
): InvoiceTaxSummary {
  const isInterState = typeof tenantOrInterState === 'boolean'
    ? tenantOrInterState
    : tenantOrInterState !== placeOfSupplyOrRoundOff;

  let totalSubtotal = 0n;
  let totalLineDiscounts = 0n;
  let totalTaxableValue = 0n;
  let totalCgst = 0n;
  let totalSgst = 0n;
  let totalIgst = 0n;

  const computedItems: ComputedLineItem[] = items.map((item) => {
    const qtyCount = Number(item.quantity ?? item.qty ?? 1);
    const qtyBigInt = BigInt(Math.max(1, Math.round(qtyCount * 1000)));
    const rate = BigInt(item.ratePaise ?? item.pricePaise ?? item.rate ?? 0);
    const rawAmount = (qtyBigInt * rate) / 1000n;

    let discount = BigInt(item.discountPaise || 0);
    const discPctNum = Number(item.discountPercent || 0);
    if (discPctNum > 0) {
      const pctDiscount = (rawAmount * BigInt(Math.round(discPctNum * 100))) / 10000n;
      discount += pctDiscount;
    }
    if (discount > rawAmount) {
      discount = rawAmount;
    }

    const gstRateBp = item.gstRateBp !== undefined
      ? Number(item.gstRateBp)
      : (item.taxRate !== undefined ? Math.round(Number(item.taxRate) * 100) : 0);

    let taxableValue: bigint;
    let taxAmount: bigint;

    if (item.isTaxInclusive && gstRateBp > 0) {
      const netInclusive = rawAmount - discount;
      taxableValue = (netInclusive * 10000n) / BigInt(10000 + gstRateBp);
      taxAmount = netInclusive - taxableValue;
    } else {
      taxableValue = rawAmount - discount;
      taxAmount = gstRateBp > 0 ? (taxableValue * BigInt(gstRateBp)) / 10000n : 0n;
    }

    let cgst = 0n;
    let sgst = 0n;
    let igst = 0n;

    if (isInterState) {
      igst = taxAmount;
    } else {
      cgst = taxAmount / 2n;
      sgst = taxAmount - cgst;
    }

    const lineTotal = taxableValue + taxAmount;

    totalSubtotal += rawAmount;
    totalLineDiscounts += discount;
    totalTaxableValue += taxableValue;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    return {
      qty: qtyCount,
      rate,
      discount,
      taxableValue,
      gstRateBp,
      cgst,
      sgst,
      igst,
      taxAmount,
      lineTotal,
    };
  });

  let finalTaxableValue = totalTaxableValue - invoiceDiscountPaise;
  if (finalTaxableValue < 0n) finalTaxableValue = 0n;

  const totalTax = totalCgst + totalSgst + totalIgst;
  const unroundedGrandTotal = finalTaxableValue + totalTax;

  let roundOff = 0n;
  const shouldRoundOff = typeof placeOfSupplyOrRoundOff === 'boolean' ? placeOfSupplyOrRoundOff : true;
  if (shouldRoundOff) {
    const remainder = unroundedGrandTotal % 100n;
    if (remainder !== 0n) {
      if (remainder >= 50n) {
        roundOff = 100n - remainder;
      } else {
        roundOff = -remainder;
      }
    }
  }

  const grandTotal = unroundedGrandTotal + roundOff;

  return {
    items: computedItems,
    subtotal: totalSubtotal,
    discountTotal: totalLineDiscounts + invoiceDiscountPaise,
    taxableValue: finalTaxableValue,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    totalTax,
    roundOff,
    grandTotal,
  };
}
