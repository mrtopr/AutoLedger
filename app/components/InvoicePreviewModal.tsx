'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  MessageCircle,
  FileText,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Download,
  Loader2,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { HondaWingIcon } from './HondaLogo';
import { formatPaiseToRupees } from '@/server/lib/tax';
import ClientPortal from './ClientPortal';

export interface InvoicePreviewItem {
  id?: string;
  name: string;
  partNumber?: string;
  hsnCode?: string;
  qty: number;
  unit?: string;
  ratePaise?: string | number;
  rateRupees?: string;
  discountValue?: string;
  discountPaise?: string | number;
  discountType?: 'FLAT' | 'PERCENT';
  gstRateBp?: number;
  taxableValuePaise?: string | number;
  totalPaise?: string | number;
}

export interface InvoicePreviewData {
  id?: string;
  invoiceNumber: string;
  status?: string;
  cancelReason?: string;
  date?: string;
  time?: string;
  placeOfSupply?: string;
  customer?: {
    id?: string;
    name?: string;
    shopName?: string;
    phone?: string;
    address?: string;
    gstin?: string | null;
  };
  items: InvoicePreviewItem[];
  subtotalPaise?: string | number;
  discountTotalPaise?: string | number;
  taxableValuePaise?: string | number;
  cgstPaise?: string | number;
  sgstPaise?: string | number;
  totalTaxPaise?: string | number;
  roundOffPaise?: string | number;
  grandTotalPaise: string | number;
  paidNowPaise?: string | number;
  cashPaidPaise?: string | number;
  upiPaidPaise?: string | number;
  upiRef?: string;
  creditBalancePaise?: string | number;
  tenant?: {
    name?: string;
    legalName?: string;
    address?: string;
    gstin?: string;
    phone?: string;
    email?: string;
    stateCode?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoicePreviewData | null;
}

// Convert amount into Indian Currency Words
function numberToWordsINR(amountPaise: number | string | bigint): string {
  const amount = Math.floor(Number(amountPaise) / 100);
  if (amount <= 0) return 'Zero Rupees Only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return single[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + single[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    let res = '';
    if (h > 0) res += single[h] + ' Hundred';
    if (r > 0) res += (res ? ' and ' : '') + convertTwoDigits(r);
    return res;
  }

  const crores = Math.floor(amount / 10000000);
  let rem = amount % 10000000;
  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousands = Math.floor(rem / 1000);
  const hundreds = rem % 1000;

  let words = '';
  if (crores > 0) words += convertThreeDigits(crores) + ' Crore ';
  if (lakhs > 0) words += convertThreeDigits(lakhs) + ' Lakh ';
  if (thousands > 0) words += convertThreeDigits(thousands) + ' Thousand ';
  if (hundreds > 0) words += convertThreeDigits(hundreds);

  return 'Rupees ' + words.trim() + ' Only';
}

export default function InvoicePreviewModal({ isOpen, onClose, invoice }: Props) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const showroomName = invoice.tenant?.name || 'Shree Vishwakarma Honda';
  const showroomLegal = invoice.tenant?.legalName || '';
  const showroomAddress = invoice.tenant?.address || 'Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125';
  const showroomPhone = invoice.tenant?.phone || '+91 9822100001';
  const showroomEmail = invoice.tenant?.email || '';

  // Clean state name without codes
  const rawState = invoice.tenant?.stateCode || 'Bihar';
  const cleanState = (s?: string) => s ? s.replace(/^\d{1,2}\s*[-–—]\s*/, '').trim() || s : 'Bihar';
  const stateDisplay = cleanState(rawState);

  const bankName = invoice.tenant?.bankName || 'HDFC Bank';
  const accountNo = invoice.tenant?.accountNumber || '50200012345678';
  const ifscCode = invoice.tenant?.ifscCode || 'HDFC0001234';
  const upiId = invoice.tenant?.upiId || 'hondarishi@okhdfcbank';

  // Customer information handling
  const isWalkIn = !invoice.customer || (!invoice.customer.name && !invoice.customer.shopName) || invoice.customer.name === 'Walk-in Retail Customer' || invoice.customer.shopName?.includes('Walk-in');
  const customerDisplayName = invoice.customer?.shopName || invoice.customer?.name || 'Walk-in Retail Customer';
  const customerSecondaryName = (invoice.customer?.name && invoice.customer.shopName && invoice.customer.name !== invoice.customer.shopName) ? invoice.customer.name : '';
  const customerContact = invoice.customer?.phone ? invoice.customer.phone.replace(/^(\+91|91)/, '') : '';
  const customerAddress = invoice.customer?.address || '';

  const invoiceDate = invoice.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const invoiceTime = invoice.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Monetary Totals
  const grandTotal = BigInt(invoice.grandTotalPaise || 0);
  const paidNow = BigInt(invoice.paidNowPaise || 0);
  const cashPaid = BigInt(invoice.cashPaidPaise || 0);
  const upiPaid = BigInt(invoice.upiPaidPaise || 0);
  const creditBalance = BigInt(invoice.creditBalancePaise || (grandTotal > paidNow ? grandTotal - paidNow : 0));

  // Calculate subtotal and discounts safely
  const calculatedSubtotal = invoice.items.reduce((sum, it) => {
    const ratePaise = BigInt(it.ratePaise || (Number(it.rateRupees || 0) * 100));
    return sum + (ratePaise * BigInt(it.qty || 1));
  }, 0n);

  const calculatedDiscount = invoice.items.reduce((sum, it) => {
    if (it.discountPaise) return sum + BigInt(it.discountPaise);
    if (it.discountValue) {
      const val = parseFloat(it.discountValue);
      if (!isNaN(val) && val > 0) {
        if (it.discountType === 'PERCENT') {
          const ratePaise = BigInt(it.ratePaise || (Number(it.rateRupees || 0) * 100));
          const lineTotal = ratePaise * BigInt(it.qty || 1);
          return sum + ((lineTotal * BigInt(Math.round(val * 100))) / 10000n);
        } else {
          return sum + BigInt(Math.round(val * 100));
        }
      }
    }
    return sum;
  }, 0n);

  const subtotalPaise = invoice.subtotalPaise ? BigInt(invoice.subtotalPaise) : (calculatedSubtotal > grandTotal ? calculatedSubtotal : grandTotal);
  const discountTotalPaise = invoice.discountTotalPaise ? BigInt(invoice.discountTotalPaise) : calculatedDiscount;
  const hasDiscounts = discountTotalPaise > 0n || invoice.items.some(it => Boolean(it.discountValue || it.discountPaise));

  // High-Resolution Print Engine (Supports A4 and 80mm Thermal Receipt Formats)
  const handlePrint = () => {
    const isThermal = printFormat === 'THERMAL';
    const element = document.getElementById('printable-invoice-container');
    if (!element) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.printCurrentPage) {
        (window as any).electronAPI.printCurrentPage({ silent: false, printBackground: true });
        return;
      }
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', isThermal ? 'width=450,height=750' : 'width=900,height=1000');
    if (!printWindow) {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.printCurrentPage) {
        (window as any).electronAPI.printCurrentPage({ silent: false, printBackground: true });
        return;
      }
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${isThermal ? 'Receipt' : 'Sales Bill'} - ${invoice.invoiceNumber}</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap" />
          <script src="https://cdn.tailwindcss.com"></script>
          ${styles}
          <style>
            @page {
              size: ${isThermal ? '80mm auto' : 'A4 portrait'};
              margin: ${isThermal ? '3mm 4mm' : '8mm 10mm'};
            }
            html, body {
              background: #FFFFFF !important;
              color: #0F172A !important;
              font-family: ${isThermal ? "'JetBrains Mono', monospace" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0 !important;
              padding: 0 !important;
              ${isThermal ? 'width: 80mm !important; max-width: 80mm !important;' : ''}
            }
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
            .font-mono-numeric {
              font-family: 'JetBrains Mono', monospace;
              font-variant-numeric: tabular-nums;
            }
            tr, .print-avoid-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            #printable-invoice-container {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body class="bg-white text-slate-900 ${isThermal ? 'p-1' : 'p-4 sm:p-6'}">
          <div class="${isThermal ? 'w-full' : 'max-w-4xl mx-auto'}">
            ${element.innerHTML}
          </div>
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 350);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    handlePrint();
  };

  // WhatsApp Share Handler
  const handleWhatsAppShare = () => {
    const cleanPhone = customerContact.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const message = `*SALES BILL - ${showroomName.toUpperCase()}*\n` +
      `--------------------------------\n` +
      `*Bill No:* ${invoice.invoiceNumber}\n` +
      `*Date:* ${invoiceDate} (${invoiceTime})\n` +
      `*Customer:* ${customerDisplayName}\n` +
      `--------------------------------\n` +
      `*Total Amount:* ${formatPaiseToRupees(grandTotal)}\n` +
      `*Paid Amount:* ${formatPaiseToRupees(paidNow)}\n` +
      (creditBalance > 0n ? `*Balance on Khata:* ${formatPaiseToRupees(creditBalance)}\n` : '') +
      `--------------------------------\n` +
      `Thank you for choosing Honda!\n` +
      `*${showroomName}* | Tel: ${showroomPhone}`;

    const encoded = encodeURIComponent(message);
    const url = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

    window.open(url, '_blank');
  };

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200 print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:w-full print:block print:h-auto">

        {/* Modal Card Container */}
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-preview-modal-title"
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[96vh] animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none print:block print:p-0 print:m-0"
        >

          {/* Top Modal Controls (Strictly Hidden on Print) */}
          <div className="flex flex-wrap items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-[#F8FAFC] rounded-t-2xl print:hidden shrink-0 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#C81E1E] flex items-center justify-center font-bold shadow-2xs">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div id="invoice-preview-modal-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Sales Bill Preview</span>
                  <span className="text-xs font-mono font-bold text-[#C81E1E] bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {printFormat === 'THERMAL' ? '80mm Thermal Receipt · Counter POS' : '1-Page A4 Sheet · Non-GST Sales Bill'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Print Format Selector */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPrintFormat('A4')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer active:scale-95 ${
                    printFormat === 'A4' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A4 Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('THERMAL')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer active:scale-95 ${
                    printFormat === 'THERMAL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  80mm Slip
                </button>
              </div>

              {/* Direct Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C81E1E] hover:bg-[#A81818] active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                title={`Print ${printFormat === 'THERMAL' ? '80mm Thermal Receipt' : 'A4 Sales Bill'}`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print {printFormat === 'THERMAL' ? 'Slip' : 'A4'}</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                title="Share bill on WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 disabled:transform-none text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                title="Download PDF directly"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'PDF'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close bill preview"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 active:scale-95 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ============================================================
            STANDALONE 1-PAGE PROFESSIONAL SALES BILL SHEET (A4 OR THERMAL)
           ============================================================ */}
          <div
            id="printable-invoice-container"
            key={printFormat}
            className={`flex-1 overflow-y-auto p-4 sm:p-7 text-slate-900 bg-white relative print:p-0 print:m-0 print:overflow-visible animate-subtle-slide ${
              printFormat === 'THERMAL' ? 'space-y-2 text-xs flex justify-center' : 'space-y-4 print:space-y-3 print:text-[11px]'
            }`}
          >
            {printFormat === 'THERMAL' ? (
              /* THERMAL 80MM COUNTER SLIP */
              <div className="w-full max-w-[340px] mx-auto bg-white p-4 font-mono text-xs leading-tight text-slate-900 border border-dashed border-slate-300 rounded-xl shadow-xs print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full space-y-2.5">
                {/* Header */}
                <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-2.5">
                  <div className="font-black text-sm uppercase tracking-wide text-slate-900">{showroomName}</div>
                  {showroomLegal && showroomLegal !== showroomName && (
                    <div className="text-[10px] text-slate-600">{showroomLegal}</div>
                  )}
                  <div className="text-[10.5px] text-slate-600 leading-tight">{showroomAddress}</div>
                  <div className="text-[10.5px] font-semibold text-slate-800">Tel: {showroomPhone}</div>
                  
                  <div className="pt-1.5">
                    <span className="inline-block px-2.5 py-0.5 bg-slate-900 text-white font-bold text-[10.5px] uppercase rounded tracking-wider">
                      SALES BILL / CASH RECEIPT
                    </span>
                  </div>
                </div>

                {/* Cancelled Alert if Cancelled */}
                {invoice.status === 'CANCELLED' && (
                  <div className="bg-red-50 border border-red-300 p-1.5 rounded text-center text-red-800 text-[10px] font-bold">
                    *** CANCELLED BILL ***
                    {invoice.cancelReason && <div className="text-[9px] font-normal">{invoice.cancelReason}</div>}
                  </div>
                )}

                {/* Metadata */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Bill No:</span>
                    <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date & Time:</span>
                    <span className="font-medium text-slate-900">{invoiceDate} {invoiceTime}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-600">Customer:</span>
                    <span className="font-bold text-slate-900 text-right truncate max-w-[190px]">{customerDisplayName}</span>
                  </div>
                  {customerContact && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Contact:</span>
                      <span className="text-slate-900">{customerContact}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="border-b border-dashed border-slate-400 pb-2">
                  <table className="w-full text-left text-[10.5px]">
                    <thead>
                      <tr className="border-b border-slate-400 text-slate-700 font-bold uppercase">
                        <th className="py-1 text-left">Item Description</th>
                        <th className="py-1 text-center w-8">Qty</th>
                        <th className="py-1 text-right w-14">Rate</th>
                        <th className="py-1 text-right w-16">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-slate-200">
                      {invoice.items.map((it, idx) => {
                        const rateRupees = it.rateRupees || (Number(it.ratePaise || 0) / 100).toFixed(2);
                        const totalPaise = BigInt(it.totalPaise || (Number(it.ratePaise || 0) * (it.qty || 1)));
                        return (
                          <tr key={idx} className="leading-snug print-avoid-break">
                            <td className="py-1 pr-1 font-medium text-slate-900">
                              <div className="break-words">{it.name}</div>
                              {it.partNumber && <div className="text-[9px] text-slate-500 font-mono">#{it.partNumber}</div>}
                            </td>
                            <td className="py-1 text-center font-bold text-slate-800">{it.qty}</td>
                            <td className="py-1 text-right font-mono text-slate-700">{rateRupees}</td>
                            <td className="py-1 text-right font-mono font-bold text-slate-900">{formatPaiseToRupees(totalPaise)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-xs">
                  {hasDiscounts && discountTotalPaise > 0n && (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-mono">{formatPaiseToRupees(subtotalPaise)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-emerald-700 font-medium">
                        <span>Discount Total:</span>
                        <span className="font-mono">-{formatPaiseToRupees(discountTotalPaise)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-0.5 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatPaiseToRupees(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-800 font-semibold">
                    <span>Paid at Counter:</span>
                    <span className="font-mono font-bold">{formatPaiseToRupees(paidNow)}</span>
                  </div>
                  {creditBalance > 0n && (
                    <div className="flex justify-between text-[11px] text-amber-900 font-bold">
                      <span>Balance on Khata:</span>
                      <span className="font-mono">{formatPaiseToRupees(creditBalance)}</span>
                    </div>
                  )}
                </div>

                {/* Settlement Info & Footer */}
                <div className="pt-1 text-center space-y-1 text-[10px] text-slate-600">
                  {upiId && <div className="font-mono font-medium">UPI ID: {upiId}</div>}
                  <div className="font-bold text-slate-800">*** THANK YOU · VISIT AGAIN ***</div>
                  <div className="text-[9px] text-slate-500">Goods once sold will not be accepted back.</div>
                  <div className="text-[8.5px] text-slate-400 pt-0.5">TradeLedger ERP · Non-GST Counter Receipt</div>
                </div>
              </div>
            ) : (
              /* A4 SHEET NON-GST SALES BILL / CASH RECEIPT */
              <div className="space-y-4 print:space-y-3">
                {invoice.status === 'CANCELLED' && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between print:bg-red-100 shadow-2xs">
                    <div>
                      <span><strong>CANCELLED BILL:</strong> {invoice.cancelReason ? `Reason: ${invoice.cancelReason}` : 'This bill has been cancelled and reversed.'}</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                      Reversed on Ledger
                    </span>
                  </div>
                )}

                {invoice.status === 'CANCELLED' && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden z-20">
                    <div className="text-red-500/15 border-8 border-red-500/20 text-6xl sm:text-8xl font-black uppercase tracking-widest rotate-[-25deg] px-8 py-3 rounded-2xl select-none">
                      CANCELLED
                    </div>
                  </div>
                )}

                {/* 1. COMPANY HEADER & BILL METADATA */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3.5 print-avoid-break">
                  {/* Top-Left: Company Identity */}
                  <div className="space-y-1.5 max-w-md">
                    <div>
                      <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 leading-none uppercase">
                        {showroomName}
                      </h1>
                      {showroomLegal && showroomLegal !== showroomName && (
                        <div className="text-[11px] font-semibold text-slate-500 tracking-wide mt-0.5">
                          {showroomLegal}
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5 leading-tight">
                      <div>{showroomAddress}</div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-700">
                        <span>Tel: <strong className="font-mono font-medium text-slate-900">{showroomPhone}</strong></span>
                        {showroomEmail && (
                          <span>Email: <span className="font-medium text-slate-900">{showroomEmail}</span></span>
                        )}
                        <span>
                          State: <strong className="font-semibold text-slate-900">{stateDisplay}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top-Right: Bill Badge & Metadata */}
                  <div className="text-right space-y-1.5">
                    <div className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-xs rounded-lg uppercase tracking-wider shadow-2xs">
                      SALES BILL / CASH RECEIPT
                    </div>

                    <div className="text-[11px] space-y-1 pt-1 leading-tight">
                      <div>
                        <span className="text-slate-500">Bill No: </span>
                        <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">{invoice.invoiceNumber}</span>
                      </div>
                      <div className="bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-slate-200 mt-1 inline-block text-left shadow-2xs">
                        <div className="flex items-center gap-4 text-[11px] font-mono leading-tight">
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-sans block">Date:</span>
                            <span className="font-bold text-slate-900">{invoiceDate}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-sans block">Time:</span>
                            <span className="font-bold text-slate-900">{invoiceTime}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BILLED TO / CUSTOMER INFORMATION */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-3 text-[11px] leading-tight print-avoid-break shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Billed To (Customer / Client)
                    </div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">{customerDisplayName}</div>
                    {customerSecondaryName && (
                      <div className="text-slate-600">Attn: {customerSecondaryName}</div>
                    )}
                    {customerAddress ? (
                      <div className="text-slate-600 truncate">{customerAddress}</div>
                    ) : (
                      <div className="text-slate-500 italic">Counter Retail Customer</div>
                    )}
                    {customerContact && (
                      <div className="text-slate-700 font-mono font-medium">Contact: +91 {customerContact}</div>
                    )}
                  </div>

                  <div className="text-right flex flex-col justify-between space-y-1">
                    <div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Account Billing Status
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                        {customerContact ? `+91 ${customerContact}` : 'Counter Retail Cash'}
                      </div>
                    </div>

                    <div>
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                        creditBalance === 0n
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : paidNow > 0n
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {creditBalance === 0n ? 'Fully Paid (Cash Receipt)' : paidNow > 0n ? 'Partially Paid' : 'Khata Balance Due'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. ITEM DETAILS TABLE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-900 text-white font-semibold">
                        <th className="py-2 px-2.5 w-8 text-center">#</th>
                        <th className="py-2 px-2.5">Item Description & Part No.</th>
                        <th className="py-2 px-2 w-16 text-center">Qty</th>
                        <th className="py-2 px-2.5 w-24 text-right">Unit Rate (₹)</th>
                        {hasDiscounts && <th className="py-2 px-2.5 w-20 text-right">Discount</th>}
                        <th className="py-2 px-2.5 w-28 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {invoice.items.length === 0 ? (
                        <tr>
                          <td colSpan={hasDiscounts ? 6 : 5} className="py-4 text-center text-slate-400">
                            No spare parts recorded
                          </td>
                        </tr>
                      ) : (
                        invoice.items.map((item, idx) => {
                          const rateRupees = item.rateRupees || (Number(item.ratePaise || 0) / 100).toFixed(2);
                          const totalPaise = BigInt(item.totalPaise || (Number(item.ratePaise || 0) * (item.qty || 1)));

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors print-avoid-break">
                              <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2 px-2.5 font-medium text-slate-900 leading-snug">
                                <div className="font-semibold text-slate-900 break-words">{item.name}</div>
                                {item.partNumber && (
                                  <span className="inline-block mt-0.5 text-[9.5px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    #{item.partNumber}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">
                                {item.qty} <span className="text-[10px] text-slate-500 font-normal">{item.unit || 'pcs'}</span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono-numeric text-slate-700">
                                {rateRupees}
                              </td>
                              {hasDiscounts && (
                                <td className="py-2 px-2.5 text-right font-mono text-xs text-emerald-700 font-medium">
                                  {item.discountValue ? (item.discountType === 'PERCENT' ? `${item.discountValue}%` : `₹${item.discountValue}`) : '-'}
                                </td>
                              )}
                              <td className="py-2 px-2.5 text-right font-mono-numeric font-bold text-slate-900">
                                {formatPaiseToRupees(totalPaise)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. TOTALS, WORDS, AND BANK DETAILS */}
                <div className="grid grid-cols-12 gap-3.5 pt-1 text-[11px] print-avoid-break">
                  {/* Left: Words, Bank & Terms (7 cols) */}
                  <div className="col-span-7 space-y-2">
                    {/* Words */}
                    <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-200 leading-tight shadow-2xs">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Amount In Words:
                      </span>
                      <span className="font-semibold text-slate-900 italic text-xs">
                        {numberToWordsINR(grandTotal)}
                      </span>
                    </div>

                    {/* Direct Bank Settlement */}
                    <div className="border border-slate-200 p-2.5 rounded-xl space-y-1 text-[10px] text-slate-600 bg-white shadow-2xs">
                      <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                        Direct Bank & UPI Settlement Details:
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-slate-700">
                        <div>Bank: <span className="font-semibold text-slate-900">{bankName}</span></div>
                        <div>IFSC: <span className="font-semibold text-slate-900">{ifscCode}</span></div>
                        <div>A/C No: <span className="font-semibold text-slate-900">{accountNo}</span></div>
                        <div>UPI ID: <span className="font-semibold text-slate-900">{upiId}</span></div>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="text-[9.5px] text-slate-500 space-y-0.5 leading-tight pt-0.5">
                      <div className="font-bold text-slate-700">Terms & Conditions:</div>
                      <div>1. Goods once sold will not be accepted back without original sales receipt.</div>
                      <div>2. OEM spare parts are subject to manufacturer warranty terms.</div>
                    </div>
                  </div>

                  {/* Right: Net Breakdown Summary (5 cols) */}
                  <div className="col-span-5 space-y-1.5 bg-[#F8FAFC] p-3 rounded-xl border border-slate-200 text-[11px] shadow-2xs flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-mono-numeric font-semibold text-slate-800">
                          {formatPaiseToRupees(subtotalPaise)}
                        </span>
                      </div>

                      {hasDiscounts && discountTotalPaise > 0n && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span>Discount Total:</span>
                          <span className="font-mono-numeric">
                            -{formatPaiseToRupees(discountTotalPaise)}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-slate-300 pt-1.5 flex justify-between items-baseline">
                        <span className="font-bold text-slate-900 text-xs">Grand Total:</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 font-mono-numeric">
                          {formatPaiseToRupees(grandTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[10.5px]">
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Paid at Counter:</span>
                        <span className="font-mono-numeric font-bold">{formatPaiseToRupees(paidNow)}</span>
                      </div>

                      {cashPaid > 0n && (
                        <div className="flex justify-between text-slate-600 text-[10px] pl-1">
                          <span>Cash Paid:</span>
                          <span className="font-mono-numeric">{formatPaiseToRupees(cashPaid)}</span>
                        </div>
                      )}

                      {upiPaid > 0n && (
                        <div className="flex justify-between text-slate-600 text-[10px] pl-1">
                          <span>UPI Paid:</span>
                          <span className="font-mono-numeric">{formatPaiseToRupees(upiPaid)} {invoice.upiRef ? `(${invoice.upiRef})` : ''}</span>
                        </div>
                      )}

                      {creditBalance > 0n && (
                        <div className="flex justify-between text-amber-800 font-bold pt-0.5 border-t border-dotted border-amber-200">
                          <span>Khata Balance Due:</span>
                          <span className="font-mono-numeric">{formatPaiseToRupees(creditBalance)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. DUAL SIGNATURE & DIGITAL VERIFICATION SECTION */}
                <div className="grid grid-cols-2 gap-6 pt-3.5 border-t border-slate-300 print-avoid-break">
                  {/* Left: Customer / Receiver Acknowledgment */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                      Customer / Receiver Acknowledgment
                    </div>
                    <div className="h-9 flex items-end">
                      <div className="border-b border-slate-400 w-44" />
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Received in Good Condition · Signature & Date
                    </div>
                  </div>

                  {/* Right: Authorised Signatory */}
                  <div className="space-y-1 text-right flex flex-col items-end">
                    <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                      For {showroomName}
                    </div>
                    <div className="h-9 flex items-end justify-end">
                      <div className="border-b border-slate-400 w-44" />
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Authorised Signatory
                    </div>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="text-center pt-3 border-t border-slate-100 mt-2 print-avoid-break">
                  <div className="text-[9.5px] text-slate-400 font-mono">
                    Digitally generated sales bill & cash receipt. Physical signature not required.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ClientPortal>
  );
}
