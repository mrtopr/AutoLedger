import { z } from 'zod';

export const InvoiceItemInputSchema = z.object({
  productId: z.string().optional().nullable(),
  name: z.string().optional(),
  description: z.string().optional(),
  partNumber: z.string().optional().nullable(),
  qty: z.union([z.number(), z.string()]).optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  ratePaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  rateRupees: z.union([z.number(), z.string()]).optional(),
  unitPricePaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  unitPrice: z.union([z.number(), z.string()]).optional(),
  discountPaise: z.union([z.number(), z.string(), z.bigint()]).optional().nullable(),
  discountRupees: z.union([z.number(), z.string()]).optional().nullable(),
  discountPercent: z.union([z.number(), z.string()]).optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  gstRateBp: z.union([z.number(), z.string()]).optional(),
  unit: z.string().optional(),
  taxablePaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  totalPaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
});

export const CreateInvoiceSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerGstin: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().default('27'),
  items: z.array(InvoiceItemInputSchema).optional().default([]),
  cashPaidPaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  upiPaidPaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  paidNowPaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  paidNowRupees: z.union([z.number(), z.string()]).optional(),
  upiRef: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  seriesCode: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  clientRequestId: z.string().optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof InvoiceItemInputSchema>;

export interface InvoiceItemDTO {
  id: string;
  name: string;
  partNumber: string;
  qty: number;
  unit: string;
  ratePaise: string;
  discountPaise: string;
  hsnCode: string;
  taxablePaise: string;
  cgstPaise: string;
  sgstPaise: string;
  totalPaise: string;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  customerShop: string;
  customerPhone: string;
  customerGstin: string | null;
  customerAddress: string;
  status: string;
  cancelReason?: string | null;
  grandTotalPaise: string;
  subtotalPaise: string;
  paidNowPaise: string;
  amountPaidPaise: string;
  creditBalancePaise: string;
  balanceDuePaise: string;
  taxableValuePaise: string;
  totalTaxPaise: string;
  cgstPaise: string;
  sgstPaise: string;
  items: InvoiceItemDTO[];
  createdAt?: string;
}
