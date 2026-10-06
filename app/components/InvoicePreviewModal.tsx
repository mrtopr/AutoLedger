'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  MessageCircle, 
  FileText,
  Phone, 
  MapPin, 
  CreditCard,
  Building2,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Download,
  Loader2
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
  invoiceNumber: string;
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

// Dynamically load html2pdf from CDN if not already on window
async function loadHtml2Pdf(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).html2pdf) return (window as any).html2pdf;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('html2pdf-cdn-script');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).html2pdf));
      existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf script')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'html2pdf-cdn-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve((window as any).html2pdf);
    script.onerror = () => reject(new Error('Failed to load html2pdf script'));
    document.head.appendChild(script);
  });
}

export default function InvoicePreviewModal({ isOpen, onClose, invoice }: Props) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen || !invoice) return null;

  const showroomName = invoice.tenant?.name || 'Shree Vishwakarma Honda';
  const showroomLegal = invoice.tenant?.legalName || 'Shree Honda';
  const showroomAddress = invoice.tenant?.address || 'Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125';
  const showroomGst = invoice.tenant?.gstin || '10ABCDE1234F1Z5';
  const showroomPhone = invoice.tenant?.phone || '+91 9822100001';
  const showroomEmail = invoice.tenant?.email || 'honda@gmail.com';
  
  // Extract clean state name (e.g. "10 - Bihar" -> "Bihar")
  const rawState = invoice.tenant?.stateCode || 'Bihar';
  const cleanState = (s?: string) => s ? s.replace(/^\d{1,2}\s*[-–—]\s*/, '').trim() || s : 'Bihar';
  const stateDisplay = cleanState(rawState);
  const placeOfSupplyDisplay = cleanState(invoice.placeOfSupply || rawState);

  const bankName = invoice.tenant?.bankName || 'HDFC Bank';
  const accountNo = invoice.tenant?.accountNumber || '50200012345678';
  const ifscCode = invoice.tenant?.ifscCode || 'HDFC0001234';
  const upiId = invoice.tenant?.upiId || 'hondarishi@okhdfcbank';

  const customerName = invoice.customer?.name || invoice.customer?.shopName || 'Walk-in Customer';
  const customerShop = invoice.customer?.shopName || invoice.customer?.name || 'Walk-in Customer';
  const customerPhone = invoice.customer?.phone || '';
  const customerAddress = invoice.customer?.address || 'Bhubaneswar, Odisha';
  const customerGstin = invoice.customer?.gstin || 'URP (Unregistered Dealer)';

  const invoiceDate = invoice.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const invoiceTime = invoice.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const grandTotal = BigInt(invoice.grandTotalPaise || 0);
  const paidNow = BigInt(invoice.paidNowPaise || 0);
  const creditBalance = BigInt(invoice.creditBalancePaise || (grandTotal > paidNow ? grandTotal - paidNow : 0));
  const cgstVal = BigInt(invoice.cgstPaise || 0);
  const sgstVal = BigInt(invoice.sgstPaise || 0);
  const totalTax = BigInt(invoice.totalTaxPaise || (cgstVal + sgstVal));
  const taxableVal = BigInt(invoice.taxableValuePaise || (grandTotal - totalTax));

  // Trigger professional single-page A4 print
  const handlePrint = () => {
    window.print();
  };

  // Direct 1-Page High-Definition PDF Download
  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-invoice-container');
    if (!element) return;

    try {
      setIsGeneratingPdf(true);
      const html2pdf = await loadHtml2Pdf();
      
      if (!html2pdf) {
        // Fallback to print if script fails to load
        window.print();
        setIsGeneratingPdf(false);
        return;
      }

      const opt = {
        margin: [5, 5, 5, 5],
        filename: `Tax_Invoice_${invoice.invoiceNumber || 'INV'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // WhatsApp Share Handler
  const handleWhatsAppShare = () => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const message = `*TAX INVOICE - ${showroomName.toUpperCase()}*\n` +
      `--------------------------------\n` +
      `*Invoice No:* ${invoice.invoiceNumber}\n` +
      `*Date:* ${invoiceDate} (${invoiceTime})\n` +
      `*Customer:* ${customerShop}\n` +
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
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:w-full print:block print:h-auto">
      
      {/* Modal Card Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none print:block print:p-0 print:m-0">
        
        {/* Top Modal Controls (Strictly Hidden on Print) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-[#F8FAFC] rounded-t-2xl print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#DC2626] flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Tax Invoice Preview</span>
                <span className="text-xs font-mono font-bold text-[#DC2626] bg-red-50 px-2 py-0.5 rounded border border-red-100">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                1-Page A4 PDF & Print Ready · GST Compliant
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-semibold rounded-lg shadow-2xs transition"
              title="Share invoice on WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-2xs transition"
              title="Download 1-Page A4 PDF directly"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-lg shadow-2xs transition"
              title="Print or Save A4 PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print A4</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================
            STANDALONE 1-PAGE PROFESSIONAL GST INVOICE SHEET
           ============================================================ */}
        <div 
          id="printable-invoice-container"
          className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-3.5 text-slate-900 bg-white print:p-0 print:m-0 print:overflow-visible print:space-y-2.5 print:text-[11px]"
        >
          
          {/* 1. COMPANY HEADER & TAX INVOICE METADATA */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
            {/* Top-Left: Company Logo & Identity */}
            <div className="space-y-1 max-w-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#DC2626] flex items-center justify-center shrink-0 shadow-xs">
                  <HondaWingIcon className="w-5 h-5" color="#FFFFFF" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none uppercase">
                    {showroomName}
                  </h1>
                  {showroomLegal && showroomLegal !== showroomName && (
                    <div className="text-[10px] font-semibold text-slate-500 tracking-wide mt-0.5">
                      {showroomLegal}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 pt-1.5 leading-tight">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{showroomAddress}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="font-mono">{showroomPhone}</span>
                  </span>
                  {showroomEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{showroomEmail}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] pt-0.5 text-slate-700 font-medium">
                  <span>
                    <span className="text-slate-500">GSTIN:</span>{' '}
                    <strong className="font-mono font-bold text-slate-900">{showroomGst}</strong>
                  </span>
                  <span>
                    <span className="text-slate-500">State:</span>{' '}
                    <strong className="font-semibold text-slate-900">{stateDisplay}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Top-Right: Tax Invoice Tag & Meta Details */}
            <div className="text-right space-y-0.5">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-xs rounded uppercase tracking-wider">
                TAX INVOICE
              </div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                Original for Recipient
              </div>

              <div className="text-[11px] space-y-1 pt-1.5 leading-tight">
                <div>
                  <span className="text-slate-500">Invoice No: </span>
                  <span className="font-mono font-black text-slate-900 text-xs">{invoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500">Date: </span>
                  <span className="font-semibold text-slate-900">{invoiceDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Time: </span>
                  <span className="font-mono text-slate-700">{invoiceTime}</span>
                </div>
                <div>
                  <span className="text-slate-500">Place of Supply: </span>
                  <span className="font-semibold text-slate-900">{placeOfSupplyDisplay}</span>
                </div>
                <div>
                  <span className="text-slate-500">Reverse Charge: </span>
                  <span className="font-semibold text-slate-900">No</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. BILLED TO / CUSTOMER INFORMATION */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-lg p-2.5 grid grid-cols-2 gap-3 text-[11px] leading-tight">
            <div className="space-y-0.5">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                Billed To (Customer / Garage)
              </div>
              <div className="font-bold text-slate-900 text-xs">{customerShop}</div>
              {customerName !== customerShop && (
                <div className="text-slate-600">Attn: {customerName}</div>
              )}
              <div className="text-slate-600 truncate">{customerAddress}</div>
              <div className="text-slate-600 font-mono">Phone: {customerPhone || 'N/A'}</div>
            </div>

            <div className="text-right flex flex-col justify-between space-y-1">
              <div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  Customer GSTIN
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                  {customerGstin}
                </div>
              </div>

              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  creditBalance === 0n 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : paidNow > 0n
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {creditBalance === 0n ? '● Fully Paid' : paidNow > 0n ? '● Partially Paid' : '● Due on Khata'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. ITEM DETAILS TABLE */}
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-900 text-white font-semibold">
                  <th className="py-1.5 px-2.5 w-8 text-center">#</th>
                  <th className="py-1.5 px-2.5">Item Description & OEM Part No.</th>
                  <th className="py-1.5 px-2 w-16 text-center">HSN</th>
                  <th className="py-1.5 px-2 w-14 text-center">Qty</th>
                  <th className="py-1.5 px-2.5 w-20 text-right">Rate (₹)</th>
                  <th className="py-1.5 px-2 w-14 text-center">GST</th>
                  <th className="py-1.5 px-2.5 w-24 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {invoice.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400">
                      No spare parts recorded
                    </td>
                  </tr>
                ) : (
                  invoice.items.map((item, idx) => {
                    const rateRupees = item.rateRupees || (Number(item.ratePaise || 0) / 100).toFixed(2);
                    const totalPaise = BigInt(item.totalPaise || (Number(item.ratePaise || 0) * (item.qty || 1)));
                    const gstPercent = (item.gstRateBp || 1800) / 100;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900">
                          <div>{item.name}</div>
                          {item.partNumber && (
                            <div className="text-[9px] text-slate-500 font-mono font-normal">
                              SKU: {item.partNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                          {item.hsnCode || '8714'}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono font-bold">
                          {item.qty} {item.unit || 'pcs'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono-numeric">
                          {rateRupees}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                          {gstPercent}%
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono-numeric font-bold text-slate-900">
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
          <div className="grid grid-cols-12 gap-3 pt-1 text-[11px]">
            {/* Left: Words, Bank & Terms (7 cols) */}
            <div className="col-span-7 space-y-2">
              {/* Words */}
              <div className="bg-[#F8FAFC] p-2 rounded border border-slate-200 leading-tight">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                  Amount In Words:
                </span>
                <span className="font-semibold text-slate-900 italic text-[11px]">
                  {numberToWordsINR(grandTotal)}
                </span>
              </div>

              {/* Direct Bank Settlement */}
              <div className="border border-slate-200 p-2 rounded space-y-1 text-[10px] text-slate-600">
                <div className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                  <CreditCard className="w-3 h-3 text-blue-600" />
                  <span>Direct Bank Settlement Details:</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
                  <div>Bank: <span className="font-semibold text-slate-800">{bankName}</span></div>
                  <div>IFSC: <span className="font-semibold text-slate-800">{ifscCode}</span></div>
                  <div>A/C No: <span className="font-semibold text-slate-800">{accountNo}</span></div>
                  <div>UPI: <span className="font-semibold text-slate-800">{upiId}</span></div>
                </div>
              </div>

              {/* Terms */}
              <div className="text-[9px] text-slate-500 space-y-0.5 leading-tight">
                <div className="font-bold text-slate-700">Terms & Conditions:</div>
                <div>1. Goods once sold will not be accepted back without original tax invoice.</div>
                <div>2. Parts covered under OEM warranty only. Interest @ 18% p.a. on overdue credit.</div>
              </div>
            </div>

            {/* Right: Tax Breakdown Summary (5 cols) */}
            <div className="col-span-5 space-y-1 bg-[#F8FAFC] p-2.5 rounded-lg border border-slate-200 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono-numeric font-semibold text-slate-800">
                  {formatPaiseToRupees(taxableVal)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>CGST (9%):</span>
                <span className="font-mono-numeric font-semibold text-slate-800">
                  {formatPaiseToRupees(cgstVal || totalTax / 2n)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>SGST (9%):</span>
                <span className="font-mono-numeric font-semibold text-slate-800">
                  {formatPaiseToRupees(sgstVal || totalTax / 2n)}
                </span>
              </div>

              <div className="border-t border-slate-300 pt-1.5 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 text-xs">Grand Total:</span>
                <span className="text-base font-black text-slate-900 font-mono-numeric">
                  {formatPaiseToRupees(grandTotal)}
                </span>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-1 space-y-0.5 text-[10px]">
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Paid at Counter:</span>
                  <span className="font-mono-numeric font-bold">{formatPaiseToRupees(paidNow)}</span>
                </div>
                {creditBalance > 0n && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Balance on Khata:</span>
                    <span className="font-mono-numeric font-bold">{formatPaiseToRupees(creditBalance)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. DUAL SIGNATURE SECTION (CUSTOMER SIGNATURE & COMPANY AUTHORIZED SIGNATORY) */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300">
            {/* Left: Customer / Receiver Signature */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                Customer / Receiver Signature
              </div>
              <div className="h-10 flex items-end">
                <div className="border-b border-slate-400 w-44" />
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Name & Date: ____________________
              </div>
            </div>

            {/* Right: Company Authorized Signatory & Official Stamp */}
            <div className="text-right flex flex-col items-end space-y-1">
              <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                For {showroomName}
              </div>
              <div className="h-10 flex items-center justify-center">
                <span className="text-[9px] text-slate-400 font-mono italic border border-dashed border-slate-300 px-3 py-1 rounded">
                  [ Authorized Signatory & Stamp ]
                </span>
              </div>
              <div className="border-b border-slate-400 w-44 mt-0.5" />
              <div className="text-[10px] font-semibold text-slate-700">
                Authorized Signatory
              </div>
            </div>
          </div>

          <div className="text-center text-[9px] text-slate-400 border-t border-slate-100 pt-1.5 font-mono">
            Thank you for choosing {showroomName}! Computer-generated GST tax invoice.
          </div>
        </div>
      </div>
    </div>
    </ClientPortal>
  );
}
