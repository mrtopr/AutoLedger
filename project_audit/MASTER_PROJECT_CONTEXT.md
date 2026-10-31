# MASTER PROJECT CONTEXT — AutoLedger ERP (TradeLedger)

> **FOR AI CODING ASSISTANTS (ChatGPT / Claude / Antigravity)**:  
> This is the single, authoritative, self-contained handoff and context document for **AutoLedger ERP** (TradeLedger). Read this document to understand the entire architecture, domain rules, file structure, financial invariants, and implementation priorities without guessing.

---

## 1. Domain & Vision Overview
AutoLedger ERP is a high-speed **B2B Dealership Management System (DMS), POS Counter Billing, and Digital Khata (Credit Ledger) Platform** built for **Indian two-wheeler spare parts wholesalers, regional distributors, and motorcycle garages**.

### Core Business Problems Solved:
- **Replaces Paper "Kacchi Raseed"**: Eliminates lost paper chits and disputed verbal credit.
- **Fast Counter Checkout**: Counter sales complete in **< 30 seconds** using live SKU search, barcode scanning, vehicle compatibility filters (e.g. *Activa*, *Splendor*, *Pulsar*), and 80mm thermal slip printing.
- **Credit Recovery**: Enforces credit limits, computes aging buckets (0–30d, 31–60d, 61–90d, 90+d), and generates WhatsApp payment reminder links with dynamic UPI payment QR codes.
- **Dual-Engine Zero Downtime**: Operates seamlessly offline via an atomic local JSON store (`db_store.json`) when PostgreSQL or internet drops.

---

## 2. Technical Stack
- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Lucide React icons.
- **Backend**: Next.js Route Handlers (`app/api/v1/*`), Server actions, Node.js runtime.
- **Database**: PostgreSQL with Prisma ORM (`prisma/schema.prisma` with 877 lines, 27 models, 11 enums).
- **Offline Storage**: Local atomic JSON store (`server/lib/store.ts` backed by `.data/db_store.json`, ~12MB cache).
- **Desktop Application**: Electron wrapper (`electron/main.js` + `electron/preload.js`), single-instance lock, Windows launcher batch files (`Launch-AutoLedger-ERP.bat`).
- **Payment Gateway**: Razorpay UPI / Payment Links integration (`server/lib/razorpay.ts`).
- **Testing**: Vitest (`vitest run`). 14 tests passing across parser, search, and allocation engines.

---

## 3. Non-Negotiable Financial & Architectural Rules
1. **MONEY IS STORED IN INTEGER PAISE**: Never use floats for currency. All monetary fields in Prisma and localStore are `BigInt` or stringified paise (₹100.50 = 10050 paise). Conversion to Rupees is UI-only via `server/lib/tax.ts`.
2. **APPEND-ONLY LEDGER**: The `ledger_entries` table is the source of truth. Customer balance = $\sum(\text{debit}) - \sum(\text{credit})$. Reversals create new compensating entries (`entryType: PAYMENT_REVERSAL` or `ADJUSTMENT`). Never edit or delete ledger rows.
3. **FIFO PAYMENT ALLOCATION**: Payments settle open credit invoices oldest-first (`OLDEST_FIRST`). Remaining amounts become unallocated customer advances (`server/lib/allocation.ts`).
4. **INVOICE IMMUTABILITY**: Issued invoices cannot be edited or deleted. Cancellations mark status as `CANCELLED`, restore stock via `RETURN_IN`, and reverse ledger via credit adjustment.
5. **MULTI-TENANT ISOLATION**: Every table and query is isolated by `tenantId`.
6. **TIMEZONE & CURRENCY**: Timezone is UTC stored, `Asia/Kolkata` displayed. Currency is INR (₹). UI supports English and Hindi.

---

## 4. Key Directory & File Map
```
B2B_Platform/
├── app/
│   ├── pos/page.tsx               # Point-of-Sale counter billing UI (2015 lines)
│   ├── customers/page.tsx         # Khata CRM & debtor directory
│   ├── customers/[id]/page.tsx    # Customer ledger timeline, WhatsApp sharing, payments
│   ├── products/page.tsx          # Catalog, prices, bike compatibility
│   ├── inventory/page.tsx         # Stock movements, in/out adjustments, low-stock alerts
│   ├── settlement/page.tsx        # Daily cash drawer reconciliation & Z-Report
│   ├── portal/page.tsx            # B2B customer self-service mobile portal (95KB)
│   ├── components/
│   │   ├── InvoicePreviewModal.tsx# 80mm thermal receipt & A4 GST tax invoice print
│   │   ├── BulkImportModal.tsx    # Excel / CSV / Tally XML catalog importer (85KB)
│   │   ├── ZReportModal.tsx       # Day-end drawer cash count & discrepancy modal
│   │   └── CommandPalette.tsx     # Ctrl+K global shortcut launcher
│   └── api/v1/                    # REST API endpoints (16 resource modules)
├── server/lib/
│   ├── tax.ts                     # Authoritative GST, HSN, line discount, and roundoff math
│   ├── allocation.ts              # Pure FIFO payment allocation engine (tested)
│   ├── store.ts                   # Atomic local JSON database fallback (988 lines)
│   ├── prisma.ts                  # Prisma client & isPostgresAvailable() connection check
│   ├── auth.ts                    # JWT sessions & user role validation
│   └── razorpay.ts                # Payment link generation & signature verification
├── electron/main.js               # Native Windows desktop application wrapper
├── prisma/schema.prisma           # Relational schema (Invoices, Customers, Ledger, Stock)
└── project_audit/                 # 16 detailed audit reports and guides
```

---

## 5. Critical Technical Debt & Immediate Priorities

| Priority | Issue | Location | Recommended Fix |
|---|---|---|---|
| **P0** | **Random Invoice Numbering** | `app/api/v1/invoices/route.ts:166` | Replace `Math.random()` with sequential gapless counter locked on `InvoiceSeries` table inside Prisma transaction. |
| **P0** | **Razorpay Signature Bypass & Idempotency** | `app/api/v1/webhooks/razorpay/route.ts:16` | Make webhook secret check mandatory; deduplicate against `Payment.gatewayRef` to prevent double-crediting ledger. |
| **P0** | **RBAC Missing on Invoice Delete** | `app/api/v1/invoices/route.ts:461` | Add `authUser.role === 'OWNER' \|\| 'MANAGER'` guard to prevent unauthorized bill erasure by counter clerks. |
| **P1** | **Automated Reminders Engine** | `app/reminders/` (currently empty) | Connect BullMQ queue with WhatsApp Business API / MSG91 for automated scheduled payment reminders. |
| **P1** | **Partial Item Return / Credit Notes** | `app/invoices/` | Implement 1-click line item return flow with `CreditNote` generation, stock return, and ledger adjustment. |

---

## 6. How to Continue Development Safely
- Run tests: `npm test` (Vitest)
- Typecheck: `npx tsc --noEmit`
- Validate schema: `npx prisma validate`
- Consult detailed audit reports in `project_audit/` for comprehensive code citations and algorithms.
