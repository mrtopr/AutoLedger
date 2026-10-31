# 00. Executive Summary — AutoLedger ERP (TradeLedger)

## 1. Project Identification
- **Project Name**: TradeLedger ERP / AutoLedger ERP / AutoPulse DMS
- **Repository Location**: `d:\CODING\My Projects\B2B_Platform`
- **Application Type**: B2B Wholesale Dealership Management System (DMS), POS Counter Billing, Inventory Control, and Digital Khata (Credit Ledger) Platform
- **Target Audience**: Indian motorcycle & scooter spare parts wholesalers, regional distributors, two-wheeler multi-brand garages, and workshop counter billing operators
- **Operating Environment**: High-velocity counter billing environments, noisy garage service bays, dusty stockrooms, and multi-terminal wholesale shops with frequent network fluctuations

---

## 2. Core Vision & Business Objectives
AutoLedger ERP is designed to solve the chronic operating inefficiencies in the informal Indian automotive parts supply chain:
1. **Eliminate Informal Paper Slips ("Kacchi Raseed")**: Replace untracked paper chits with professional, immutable B2B tax invoices and 80mm thermal slips.
2. **Sub-30-Second Counter Billing**: Enable counter clerks with zero accounting background to search parts by SKU, description, or vehicle compatibility (e.g. *Hero Splendor*, *Honda Activa*, *Bajaj Pulsar*), scan barcodes, and generate bills in under 10 seconds.
3. **Automated Khata Credit Ledger & Recovery**: Maintain an append-only double-entry ledger with real-time aging buckets (0–30, 31–60, 61–90, 90+ days), credit risk scoring (Green/Yellow/Red status), and automated WhatsApp balance reminder dispatch with embedded UPI QR codes.
4. **Zero-Downtime Counter Resilience**: Provide a dual-engine architecture that allows counter sales to proceed uninterrupted via an atomic local JSON store (`db_store.json`) when PostgreSQL or the internet goes down, with cloud synchronization.

---

## 3. Actual Implementation Status Summary
| Layer / Domain | Planned in PRD | Implemented in Code | Status |
|---|---|---|---|
| **Tech Stack** | Next.js 14, TS, Tailwind, Prisma, Postgres, Redis, BullMQ | Next.js 14, TS, Tailwind, Prisma, Postgres, Local JSON Store, Electron | **IMPLEMENTED (Redis/BullMQ pending)** |
| **POS Counter Billing** | Sub-30s billing, bike model filtering, split payments, thermal print | Full cart, bike model chips, split payment (Cash+UPI+Credit), thermal & A4 modal preview | **IMPLEMENTED & VERIFIED** |
| **Digital Khata & Ledger** | Append-only ledger, balance = Σ(Dr - Cr), FIFO payment allocation | Pure FIFO engine, ledger timeline, customer statements, balance calculation | **IMPLEMENTED & VERIFIED** |
| **Vehicle Compatibility** | Many-to-many bike models to products | Many-to-many schema relation, filter chips on POS, fuzzy highlighted search | **IMPLEMENTED & VERIFIED** |
| **Tax & GST Engine** | CGST, SGST, IGST, HSN, Line Discounts, Paise Math | Full `tax.ts` integer paise calculator with roundoff and intra/inter-state split | **IMPLEMENTED & VERIFIED** |
| **End-of-Day Settlement** | Daily cash drawer audit, Z-Report | Full Z-report reconciliation, physical cash count, denomination tally, discrepancy detection | **IMPLEMENTED & VERIFIED** |
| **Tally & Excel Migration** | Parse Tally XML & Excel ledgers | Full multi-pattern Tally XML/Excel parser, opening balance modal, stock importer | **IMPLEMENTED & VERIFIED** |
| **B2B Customer Portal** | Mobile-first self-service portal for mechanics | Mobile portal with OTP login, catalog browser, live ledger, Razorpay dues payment | **IMPLEMENTED & VERIFIED** |
| **Desktop Packaging** | Electron desktop app for Windows | Electron wrapper (`electron/main.js`), single-instance lock, launcher batch scripts | **IMPLEMENTED & VERIFIED** |
| **Automated Reminders** | BullMQ scheduled jobs, WhatsApp Business API, SMS DLT | Empty directories (`app/reminders`, `app/api/v1/reminders`), manual WhatsApp link only | **PLANNED BUT NOT IMPLEMENTED** |
| **Credit Notes & Returns** | Return-in items with auto restock and customer credit | Reversal logic exists in invoice deletion; dedicated Credit Note creation UI missing | **PARTIALLY IMPLEMENTED** |
| **Invoice Numbering** | Gapless sequential DB-transaction numbering | Currently uses `Math.random()` pseudo-numbering (`INV/2026-27/${random}`) | **DEFECT / HIGH RISK** |

---

## 4. Top 5 Critical Findings

1. **Gapless Invoice Numbering Defect (CRITICAL - Financial / Compliance)**
   - *Evidence*: `app/api/v1/invoices/route.ts:166` generates numbers via:
     `const invoiceNumber = \`INV/2026-27/${String(Math.floor(1000 + Math.random() * 9000))}\`;`
   - *Risk*: Generates duplicate numbers, collision errors, and skips numbers, violating Rule #3 of `AGENTS.md` and statutory Indian GST Rule 46(b) (which mandates consecutive serial numbering).
2. **Razorpay Webhook Missing Mandatory Signature & Idempotency (CRITICAL - Security / Financial)**
   - *Evidence*: `app/api/v1/webhooks/razorpay/route.ts:16-22` only verifies signatures if `process.env.RAZORPAY_WEBHOOK_SECRET` is defined. If undefined or omitted, verification is bypassed. Furthermore, duplicate webhook retries are not deduplicated against existing payment IDs, allowing duplicate ledger credits.
3. **Missing Role Authorization on Invoice Deletion/Cancellation (HIGH - Security / Governance)**
   - *Evidence*: `app/api/v1/invoices/route.ts:461-571` (`DELETE` method) performs invoice cancellation and ledger reversal without checking `authUser.role`. Counter staff can cancel invoices despite the PRD explicitly restricting this to `OWNER` and `MANAGER`.
4. **Dual-Store Code Duplication & Asymmetric Sync (HIGH - Architectural Fragility)**
   - *Evidence*: Every route handler (`customers`, `invoices`, `payments`, `settlement`) independently writes branching logic: `if (hasDb) { ... prisma ... } else { ... localStore ... }`. Moreover, offline transactions written to `localStore` are never synchronized back to PostgreSQL when connectivity resumes; `cloudSync.ts` only synchronizes bulk product imports.
5. **In-Memory Volatile Queues & Missing Background Worker (MEDIUM - Reliability)**
   - *Evidence*: `server/lib/cloudSync.ts:30` maintains `syncQueue` as an in-memory JS array (`let syncQueue: Array<...> = [];`). If the server process restarts or crashes, pending sync tasks are permanently lost. Redis and BullMQ dependencies exist in `package.json` but have not been hooked up.

---

## 5. Immediate Recommended Action
Prioritize fixing the **Sequential Gapless Invoice Generator** (`InvoiceSeries` table row locking with `SELECT ... FOR UPDATE` in a Prisma transaction) and enforce **Razorpay Webhook Signature Verification & Idempotency** before moving to automated reminder integrations.
