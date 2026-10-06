/**
 * Tax Calculation Engine (GST India)
 * All monetary calculations strictly executed in integer paise (BigInt).
 * 100 paise = 1 INR.
 */

export interface LineItemInput {
  qty: number;
  rate: bigint; // unit rate in paise
  discountPaise?: bigint; // flat discount in paise
  discountPercent?: number; // percentage discount (e.g. 5 for 5%)
  gstRateBp: number; // basis points (1800 = 18%, 2800 = 28%, 1200 = 12%, 500 = 5%)
  isTaxInclusive?: boolean; // if rate already includes GST
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
  items: ComputedLineItem[];
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
 * Calculates line-level and invoice-level GST breakdown.
 * @param items List of invoice line items
 * @param tenantStateCode 2-digit state code of wholesaler (e.g. "27" for Maharashtra)
 * @param placeOfSupplyStateCode 2-digit state code of delivery/customer (e.g. "27")
 * @param invoiceDiscountPaise Optional overall invoice discount in paise
 */
export function calculateInvoiceTax(
  items: LineItemInput[],
  tenantStateCode: string = '27',
  placeOfSupplyStateCode: string = '27',
  invoiceDiscountPaise: bigint = 0n
): InvoiceTaxSummary {
  const isInterstate = tenantStateCode !== placeOfSupplyStateCode;

  let totalSubtotal = 0n;
  let totalLineDiscounts = 0n;
  let totalTaxableValue = 0n;
  let totalCgst = 0n;
  let totalSgst = 0n;
  let totalIgst = 0n;

  const computedItems: ComputedLineItem[] = items.map((item) => {
    const qtyBigInt = BigInt(Math.round(item.qty * 1000)); // 3 decimal precision
    const rawAmount = (qtyBigInt * item.rate) / 1000n;

    // Calculate line discount
    let discount = item.discountPaise || 0n;
    if (item.discountPercent && item.discountPercent > 0) {
      const pctDiscount = (rawAmount * BigInt(Math.round(item.discountPercent * 100))) / 10000n;
      discount += pctDiscount;
    }
    if (discount > rawAmount) {
      discount = rawAmount;
    }

    let taxableValue: bigint;
    let taxAmount: bigint;

    if (item.isTaxInclusive && item.gstRateBp > 0) {
      // Reverse calculate base taxable value: netAmount / (1 + rate)
      const netInclusive = rawAmount - discount;
      taxableValue = (netInclusive * 10000n) / BigInt(10000 + item.gstRateBp);
      taxAmount = netInclusive - taxableValue;
    } else {
      taxableValue = rawAmount - discount;
      taxAmount = (taxableValue * BigInt(item.gstRateBp)) / 10000n;
    }

    let cgst = 0n;
    let sgst = 0n;
    let igst = 0n;

    if (isInterstate) {
      igst = taxAmount;
    } else {
      cgst = taxAmount / 2n;
      sgst = taxAmount - cgst; // handles odd paise split without loss
    }

    const lineTotal = taxableValue + taxAmount;

    totalSubtotal += rawAmount;
    totalLineDiscounts += discount;
    totalTaxableValue += taxableValue;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    return {
      qty: item.qty,
      rate: item.rate,
      discount,
      taxableValue,
      gstRateBp: item.gstRateBp,
      cgst,
      sgst,
      igst,
      taxAmount,
      lineTotal,
    };
  });

  // Apply invoice level discount if present
  let finalTaxableValue = totalTaxableValue - invoiceDiscountPaise;
  if (finalTaxableValue < 0n) finalTaxableValue = 0n;

  const totalTax = totalCgst + totalSgst + totalIgst;
  const unroundedGrandTotal = finalTaxableValue + totalTax;

  // Round off to nearest rupee (100 paise)
  // Example: 231840 paise -> mod is 40 -> roundOff is -40 -> 231800 paise (₹2,318.00)
  // Example: 231860 paise -> mod is 60 -> roundOff is +40 -> 231900 paise (₹2,319.00)
  const remainder = unroundedGrandTotal % 100n;
  let roundOff = 0n;
  if (remainder !== 0n) {
    if (remainder >= 50n) {
      roundOff = 100n - remainder;
    } else {
      roundOff = -remainder;
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

/**
 * Format BigInt paise to INR currency display string (e.g. ₹1,234.50)
 */
export function formatPaiseToRupees(paise: bigint | number | null | undefined): string {
  if (paise === null || paise === undefined) return '₹0.00';
  const val = typeof paise === 'bigint' ? Number(paise) : paise;
  const inRupees = val / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(inRupees);
}

/**
 * Parse a standard rupee input string into BigInt paise.
 * e.g. "1250.50" -> 125050n
 */
export function parseRupeesToPaise(rupeesInput: string | number): bigint {
  if (!rupeesInput) return 0n;
  const clean = typeof rupeesInput === 'number' ? rupeesInput.toString() : rupeesInput.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0n;
  return BigInt(Math.round(parsed * 100));
}
