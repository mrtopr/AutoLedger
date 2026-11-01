# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users
Primary users are automotive dealership owners, two-wheeler workshop managers, spare parts counter billing operators, and mechanics/garage accounts in India managing daily walk-ins, B2B credit ledger, and workshop repairs.

## Product Purpose
AutoLedger ERP is a high-speed dealership management system (DMS), POS counter billing system, and B2B Khata ledger tailored for two-wheeler workshops, spare parts distributors, and automotive multi-brand service centers. It eliminates billing bottlenecks and payment recovery delays while maintaining strict GST compliance.

## Positioning
Dual-engine resilience with instant offline fallback and cloud sync, ultra-fast (<10ms) counter billing with vehicle compatibility filtering (e.g., Activa, Splendor, Pulsar), dual GST calculation (CGST/SGST/IGST), and integrated WhatsApp Khata reminder & invoicing pipelines designed for Indian automotive businesses.

## Operating Context
Fast-paced dealership counters, noisy workshop service bays, parts stockrooms, and day-end cash reconciliation. Users operate barcode scanners, 3-inch thermal slip printers, standard A4 GST invoice printers, and desktop/touch screen interfaces.

## Capabilities and Constraints
- Sub-10ms counter billing with live SKU/part search and vehicle model compatibility filters
- Dual-engine zero-downtime architecture (PostgreSQL cloud database with atomic local JSON store fallback)
- Full Khata credit management with aging bucket analysis (0-30d, 31-60d, 61-90d, 90+ days) and automated credit limit guardrails (Green/Yellow/Red status)
- Real-time GST calculation with HSN validation and multi-format printing (A4 GST tax invoices & 3-inch thermal receipts with dynamic UPI payment QR codes)
- 1-click WhatsApp invoicing and ledger statement sharing
- Bilingual interface support (English and हिन्दी)
- Native Electron desktop packaging alongside responsive web app deployment

## Brand Commitments
- Name: AutoLedger ERP
- Aesthetic tone: High-performance, authoritative automotive dashboard with dark slate foundations, precision telemetry accents (crimson/amber), and clean high-contrast readability under workshop conditions.

## Evidence on Hand
- Complete Next.js 14 + Tailwind + Prisma codebase with established UI components (`app/components/`, `app/pos/`, `app/customers/`, `app/products/`, `app/invoices/`, `app/reports/`, `app/settings/`).
- Database models in `prisma/schema.prisma` and local atomic fallback in `.data/db_store.json`.
- Electron wrapper configurations in `electron/` and `package.json`.

## Product Principles
1. **Speed First at the Counter**: Billing, part searching, and receipt dispatch must complete in minimal keystrokes with zero lag.
2. **Never Block Commerce**: Offline fallback ensures uninterrupted counter sales even during internet outages or cloud disconnects.
3. **Transparent Financial Ledger**: Khata debits, credits, aging, and GST tax lines must be unambiguous, auditable, and instantly shareable.
4. **Resilient Workshop Usability**: High-contrast typography, clear status indicators, and keyboard-driven workflows that thrive in harsh, busy shop environments.

## Accessibility & Inclusion
- High contrast for readability in varying ambient showroom and garage lighting conditions.
- Keyboard-first navigation for high-velocity counter billing.
- Bilingual English and Hindi language support.
