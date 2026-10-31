# 12. AI Implementation Guide & Architectural Guardrails

This guide is written specifically for AI coding assistants (such as ChatGPT, Claude, or Antigravity) continuing work on this codebase.

---

## 1. Non-Negotiable Architectural Rules

1. **NEVER USE FLOATS FOR MONEY**: All currency must be manipulated and stored as **integer paise** (`BigInt` or stringified BigInt). Never use `parseFloat()` or floating-point division for monetary calculations. Always import `formatPaiseToRupees()` and `parseRupeesToPaise()` from `server/lib/tax.ts`.
2. **MAINTAIN DUAL-ENGINE COMPATIBILITY**: Any new entity or write flow must either support both PostgreSQL (via Prisma) and the local store fallback (`server/lib/store.ts`), or be wrapped inside an abstract repository.
3. **GAPLESS NUMBERING INSIDE TRANSACTIONS**: Invoices, credit notes, and receipts must follow sequential numbering inside an atomic database lock.
4. **APPEND-ONLY LEDGER**: Never update or delete rows from `ledger_entries`. All balances must be recomputable from $\sum(\text{debit}) - \sum(\text{credit})$. Reversals must be inserted as new entries with `entryType: PAYMENT_REVERSAL` or `ADJUSTMENT`.
5. **MULTI-TENANT ENFORCEMENT**: Always scope database queries by `tenantId`. Never execute `findMany()` without a `where: { tenantId }` clause.

---

## 2. Fragile Code Areas (Handle With Care)

- `server/lib/store.ts` (988 lines): The local JSON store contains methods that directly manipulate in-memory JavaScript objects and serialize them synchronously to `.data/db_store.json`. Be careful with type conversions (numbers vs strings vs BigInts).
- `app/pos/page.tsx` (2015 lines): The POS billing state coordinates customer balance warnings, bike model filters, cart lines, discounts, and payment splits. Modifying cart line calculations without updating `calculateInvoiceTax()` will cause client-server total discrepancies.
- `app/api/v1/invoices/route.ts`: This file handles stock reduction, invoice creation, and initial payment in a single flow. Any changes must maintain transactional consistency.

---

## 3. Concrete Implementation Walkthroughs for Future Features

### Example 1: Implement Partial Item Return & Credit Note
- **Files to Inspect**:
  - `prisma/schema.prisma` (`CreditNote`, `CreditNoteItem`, `StockMovement`, `LedgerEntry`)
  - `server/lib/tax.ts` (`calculateInvoiceTax`)
  - `app/invoices/page.tsx` (UI trigger)
- **Implementation Steps**:
  1. Create a `POST /api/v1/credit-notes` route.
  2. Accept `{ invoiceId, returnedItems: [{ productId, qty, ratePaise }] }`.
  3. Generate sequential Credit Note number (`CN/2026-27/00001`).
  4. Create `StockMovement` records with `reason: 'RETURN_IN'`, restoring stock for returned parts.
  5. Create a `CreditNote` record and post a `LedgerEntry` with `entryType: 'CREDIT_NOTE'`, `credit: totalRefundPaise`, `debit: 0n`.
  6. Recalculate customer's running balance and credit status.
- **Tests to Run**: `npm test` + Vitest for credit note tax calculation.

### Example 2: Implement Automated WhatsApp Reminder Worker
- **Files to Inspect**:
  - `server/lib/prisma.ts`
  - `Requirement_Doc/07_MESSAGE_TEMPLATES_AND_UX.md`
  - `app/api/v1/reminders/`
- **Implementation Steps**:
  1. Add a BullMQ worker (`server/jobs/reminderScanner.ts`).
  2. Query `prisma.invoice.findMany` where `status: { in: ['ISSUED', 'PARTIALLY_PAID'] }` and `balanceDue > 0n`.
  3. Filter invoices where `dueDate + offsetDays == today` (e.g. -3d, 0d, +3d, +7d).
  4. Check customer `optInWhatsApp` flag and enforce quiet hours (only send between 09:00 and 20:00 IST).
  5. Dispatch message via WhatsApp Business API adapter and record status in `prisma.message`.

### Example 3: Build GSTR-1 Monthly Export
- **Files to Inspect**:
  - `app/api/v1/reports/`
  - `server/lib/tax.ts`
  - `app/settlement/page.tsx`
- **Implementation Steps**:
  1. Create `GET /api/v1/reports/gst/gstr1?month=2026-10`.
  2. Group invoices by:
     - Table 4 (B2B Tax Invoices with customer GSTIN).
     - Table 7 (B2C Large inter-state invoices > ₹2.5 Lakh).
     - Table 8 (B2C Small local walk-in retail sales).
     - Table 12 (HSN-wise summary: HSN code, description, UQC, total qty, taxable value, CGST, SGST, IGST).
  3. Format response as JSON ready for upload to the GST offline tool or export as `.xlsx`.

### Example 4: Add Purchase Order / Vendor Stock-In Workflow
- **Files to Inspect**:
  - `prisma/schema.prisma` (`PurchaseOrder`, `Supplier`, `StockMovement`)
  - `app/inventory/page.tsx`
- **Implementation Steps**:
  1. Create `app/purchases/page.tsx` and `app/api/v1/purchases/route.ts`.
  2. Counter clerk selects supplier and adds purchased part quantities and purchase rates.
  3. On submit, insert `GoodsReceipt` and increment inventory via `StockMovement` (`reason: 'PURCHASE'`).
  4. Update product `purchasePrice` and recalculate average landed unit cost.

### Example 5: Fix Gapless Invoice Numbering Generator
- **Files to Inspect**:
  - `prisma/schema.prisma` (`InvoiceSeries`)
  - `app/api/v1/invoices/route.ts:166`
- **Implementation Steps**:
  1. In `app/api/v1/invoices/route.ts`, remove `Math.random()`.
  2. Inside `prisma.$transaction(async (tx) => ...)`:
     ```ts
     const series = await tx.invoiceSeries.findUnique({
       where: { tenantId_seriesCode: { tenantId: dbTenantId, seriesCode: 'INV' } },
     });
     const nextVal = (series?.currentNumber || 0) + 1;
     await tx.invoiceSeries.update({
       where: { id: series.id },
       data: { currentNumber: nextVal },
     });
     const invoiceNumber = `INV/2026-27/${String(nextVal).padStart(5, '0')}`;
     ```
