# 🏍️ AutoLedger ERP — Automotive Dealership, Workshop & B2B Khata Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Neon%20Serverless-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Electron](https://img.shields.io/badge/Desktop-Electron%20Windows%20App-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)

**AutoLedger ERP** is an enterprise-grade Dealership Management System (DMS), Fast Counter POS Billing, and B2B Khata Ledger platform engineered specifically for automotive dealerships, two-wheeler workshops, spare parts distributors, and multi-brand service centers.

---

## 🌟 Live Interactive Demo & Instant Access

Experience AutoLedger ERP live in your browser with a fully pre-seeded automotive dealership:

| Parameter | Details |
| :--- | :--- |
| **Live Web App** | **[Launch AutoLedger Live Demo](https://auto-ledger-git-main-sachins-projects-01fef6f8.vercel.app/login)** |
| **Instant 1-Click Access** | Click **"Launch Demo"** directly on the login page for instant authentication |
| **Demo Owner Email** | `demo@autoledger.app` |
| **Demo Password** | `Demo@123` |
| **Pre-Seeded Data** | **1 Dealership Owner**, **3 Workshop Khata Accounts** (*Speed Motors, Sharma Auto Care, National Bike Point*), **10 Genuine Spare Parts** (*NGK, Motul, Rolon, Bosch, etc.*), and **2 Sample Sales Bills**. |

---

## 📸 Visual Product Tour

### 1. Executive Dealership Dashboard (`/`)
*Real-time visibility into daily gross billed sales, realized cash/UPI collections, overdue garage Khata aging, and critical reorder alerts.*
![Executive Dealership Dashboard](docs/screenshots/01_dashboard.jpg)

---

### 2. High-Speed Counter POS Billing (`/pos`)
*Sub-10ms part search with barcode scanning, OEM part number matching, instant cash/UPI split payments, and 3-inch thermal slip / A4 sales bill generation.*
![POS Counter Billing](docs/screenshots/02_pos_billing.jpg)

---

### 3. Customer Directory & B2B Garage Khata (`/customers`)
*Double-entry digital Khata ledger tracking running balances, payment settlements, aging brackets (0-30d, 31-60d, 90+d), and 1-click WhatsApp payment reminders.*
![Customer Khata & Digital Ledger](docs/screenshots/03_customer_khata.jpg)

---

### 4. Parts Catalog & Stock Inventory (`/inventory`)
*Wholesale valuation, SKU management, compatible bike models (Activa, Shine, Splendor, Pulsar), min-level thresholds, and batch inward/outward adjustments.*
![Inventory & Stock Management](docs/screenshots/04_inventory_catalog.jpg)

---

### 5. Day-End Cash Settlement & Audit Trail (`/settlement`)
*Shift till balancing, cash denomination counting, drawer variance tracking, non-GST sales bill reconciliation, and full system backup/restore.*
![Day-End Settlement & Audit Trail](docs/screenshots/05_day_end_settlement.jpg)

---

## 📑 Table of Contents

- [Live Interactive Demo](#-live-interactive-demo--instant-access)
- [Visual Product Tour](#-visual-product-tour)
- [Key Highlights](#-key-highlights)
- [Architecture & Dual-Engine Resilience](#-architecture--dual-engine-resilience)
- [Core Functional Modules](#-core-functional-modules)
- [Type-Safe API Boundary](#-type-safe-api-boundary)
- [Multi-Language Support (English & हिन्दी)](#-multi-language-support-english--हिन्दी)
- [Getting Started](#-getting-started)
- [Production Deployment & SaaS Commercialization](#-production-deployment--saas-commercialization)
- [Project Directory Structure](#-project-directory-structure)
- [License](#-license)

---

## ⚡ Key Highlights

* **Sub-10ms Counter Billing:** Ultra-fast part search with barcode scanning, SKU lookup, and vehicle compatibility filters (*Activa, Shine, Splendor, Pulsar, etc.*).
* **Dual-Engine Zero-Downtime Mode:** Connects to PostgreSQL (Neon Serverless) for cloud sync, with an instantaneous fallback to an atomic local store (`.data/db_store.json`) when offline.
* **Non-GST Sales Bill Engine:** Clean price calculation with line discounts, itemized quantities, and auto round-off adjustment without tax markup.
* **Strict Khata Credit Guardrails:** Real-time credit limits, overdue day tracking (30/60/90+ days), and automated credit status classification (`GREEN`, `YELLOW`, `RED`).
* **Multi-Format Sales Bills:** Instant A4 Sales Bills and 3-inch Thermal Receipts with dynamic UPI payment QR codes and bank details.
* **1-Click WhatsApp Invoicing:** Instant dispatch of payment receipts, sales bills, and Khata balance reminders directly to customer mobile numbers.
* **Full Database Backup & Disaster Recovery:** 1-click JSON database backup and restore directly from the settings panel.

---

## 🛠️ Architecture & Dual-Engine Resilience

> 📖 **Deep Dive Available:** For the complete architectural specification, conflict resolution invariants, and v2 roadmap, see [**`docs/ARCHITECTURE.md`**](docs/ARCHITECTURE.md).

AutoLedger ERP is designed specifically around the physical realities of automotive wholesale markets (e.g. Nana Peth Pune, Kashmiri Gate Delhi). During peak evening rush hours (6:30 PM), **the counter POS billing terminal must NEVER freeze on network hops or database cold starts**.

| Layer | Technology | Operational Function |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18 | High-speed server & client rendering with streaming states |
| **Styling** | Tailwind CSS, Lucide Icons | Responsive design system with dark slate & crimson accents |
| **Desktop Client**| Electron 44 + Electron Builder | Native Windows `.exe` desktop application with splash loader |
| **API Boundary** | Next.js Route Handlers + Zod | Strict runtime schema parsing and typed DTO boundaries |
| **Cloud Database**| PostgreSQL + Prisma ORM 5.22 | Relational source of truth on Neon Serverless |
| **Local Fallback**| Atomic LocalStore (`.data/db_store.json`) | Atomic file-persisted store for offline counter operations |
| **Authentication**| JWT + HTTP-Only Cookies | Secure session tokens with bcrypt password hashing & UUID validation |

### Consistency & Conflict Protection Invariants
1. **Append-Only Invoices:** Invoices are immutable business records. Adjustments occur via compensating credit notes or cancellation events, preventing overwrite conflicts.
2. **Monotonic Sequence Watermarking:** `InvoiceSeries` preserves a high-water mark sequence ($\max(\text{Cloud}, \text{Local}) + 1$) preventing duplicate bill numbers.
3. **Event-Sourced Delta Stock:** `StockMovement` logs commutative delta quantities ($\Delta \in \mathbb{Z}$), eliminating write-write clobbering.
4. **Durable Idempotency:** Client-generated UUIDv4 idempotency keys prevent duplicate bill creation or double stock deduction upon network retries.

---

## 🔒 Type-Safe API Boundary

All mutation boundaries are protected by **Zod-inferred Data Transfer Objects (DTOs)**, eliminating runtime type ambiguity across the route edge:

```typescript
// Example: Validated API Boundary in app/api/v1/invoices/route.ts
const parseResult = CreateInvoiceSchema.safeParse(body);
if (!parseResult.success) {
  return NextResponse.json({ error: parseResult.error.errors[0]?.message }, { status: 400 });
}
const validated: CreateInvoiceInput = parseResult.data;
```

* **Invoices Schema:** [`app/api/v1/invoices/schema.ts`](app/api/v1/invoices/schema.ts)
* **Customers Schema:** [`app/api/v1/customers/schema.ts`](app/api/v1/customers/schema.ts)
* **Products Schema:** [`app/api/v1/products/bulk-import/route.ts`](app/api/v1/products/bulk-import/route.ts)

---

## 📦 Core Functional Modules

### 1. Executive Dealership Dashboard (`/`)
* **Live KPI Counters:** Today's Billed Sales, Realized Cash/UPI Collections, Total Garage Khata Due, and Critical Low Stock alerts.
* **Sales & Collections Trend Chart:** Comparative chart tracking daily gross billing vs. realized cash & UPI collections.
* **Garage Khata Follow-up:** Quick list of top overdue garage accounts with 1-click WhatsApp collection reminders.
* **Fast-Moving Spares Restock Table:** Parts running below minimum reorder thresholds.

### 2. Quick POS & Counter Billing (`/pos`)
* **Live Part Lookup:** Search by SKU, Part Name, OEM Code, or Vehicle Model.
* **Cart Calculations:** Real-time discount (₹ or %), HSN codes, quantity controls, and auto round-off adjustment.
* **Split & Flexible Payments:** Accepts **CASH**, **UPI / QR**, **CREDIT (KHATA)**, or **SPLIT / MIXED**.
* **Real-Time A4 & Thermal Print:** Instant modal preview and dual print support (3-inch Thermal Slip or A4 Sales Bill).

### 3. Customer Khata & Digital Ledger (`/customers`)
* **360° Customer Profile:** Workshop, Retailer, and Walk-in customer management.
* **Running Balance Ledger:** Complete debit and credit history with running balance and transaction references.
* **Aging Bucket Analysis:** Tracks dues across Current (0-30d), 31-60d, 61-90d, and 90+ days.
* **Payment Settlement:** Instant payment entry with mode selection (Cash, UPI, Cheque, Bank).

### 4. Parts Catalog & Stock Inventory (`/products` & `/inventory`)
* **Comprehensive Spares Database:** SKU, Part Name, Category, MRP, Buy Price, Sell Price, and Stock Levels.
* **Stock Inward & Adjustments:** Add new stock, record returns, or adjust quantity with full audit logs.
* **Bike Model Compatibility:** Filter parts by compatible vehicle models.

### 5. Invoices & Billing History (`/invoices`)
* **Central Billing Registry:** Search and filter bills by bill number, customer name, date, or status.
* **Interactive A4 Sales Bill Preview:** Clean non-GST sales bill / cash receipt with showroom details, line items, net totals, bank details, and dynamic payment QR code.
* **Direct Actions:** Print, Download, or Share via WhatsApp.

### 6. Daily Cash Settlement & Reconciliation (`/reports` & `/settlement`)
* **Day-End Cash Reconciliation:** Realized cash in drawer, UPI collections, credit given, and credit recovered.
* **Cash Desk Balancing:** Fast end-of-day closing with denomination counting and variance tracking.

### 7. Dealership Settings & Disaster Recovery Backups (`/settings`)
* **Business Profile:** Configure showroom name, legal entity name, GSTIN, contact numbers, and bank account details.
* **Consistent System Backup (`GET /api/v1/backup`):** Exports a transactionally consistent snapshot using PostgreSQL `RepeatableRead` isolation.
* **Safe Idempotent Restore (`POST /api/v1/backup`):** Transactional idempotent restore inside a single database transaction with automatic 100% rollback on failure.

---

## 🌐 Multi-Language Support (English & हिन्दी)

AutoLedger ERP features full bilingual support:
- **English** (Default)
- **हिन्दी (Hindi)** (Optimized for local Indian workshop technicians and counter staff)
- Switch instantly via the language toggle in the navigation bar.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.17.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL Database** (Optional for local testing, required for cloud sync)

### Installation
```powershell
# 1. Clone repository
git clone https://github.com/mrtopr/AutoLedger.git
cd AutoLedger

# 2. Install dependencies
npm install

# 3. Push database schema (if PostgreSQL is configured)
npx prisma db push
```

### Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-secure-jwt-secret-key

# PostgreSQL Connection (Neon Serverless or Local Postgres)
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@host/neondb?sslmode=require"
```

### Running the Web Platform
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running the Desktop App (Electron)
```powershell
# Terminal 1: Start Next.js engine
npm run dev

# Terminal 2: Launch Electron Desktop Window
npm run electron:dev
```
Or simply double-click **`Launch-TradeLedger-ERP.bat`** for 1-click startup!

---

## 💼 Production Deployment & SaaS Commercialization

1. **Deploy the Web & API Engine:**
   - Host on **[Vercel](https://vercel.com)** or **Railway**.
   - Connect to a managed PostgreSQL database on **[Neon.tech](https://neon.tech)**.
2. **Configure Production URL in Electron:**
   - In `electron/main.js`, point `APP_URL` to your production domain.
3. **Build the Client Installer (.exe):**
   ```powershell
   npm run electron:build
   ```
   Distribute `TradeLedger ERP Setup 1.0.0.exe` (found in `/dist`) to clients.

---

## 📁 Project Directory Structure

```
B2B_Platform/
├── app/                        # Next.js 14 App Router
│   ├── api/v1/                 # Backend RESTful API endpoints with Zod DTOs
│   │   ├── auth/               # Login, demo access, OTP verification & password reset
│   │   ├── backup/             # Full JSON database export & restore
│   │   ├── customers/          # Khata ledger, payments, credit limits + schema.ts
│   │   ├── invoices/           # POS bill creation & sales bills + schema.ts
│   │   ├── products/           # Inventory catalog & stock adjustments
│   │   └── settings/           # Business profile & store configurations
│   ├── components/             # Reusable ERP modals & Topbar/Sidebar
│   ├── context/                # Auth & Bilingual Language Contexts
│   ├── pos/                    # High-speed POS Counter Billing
│   ├── customers/              # Customer Khata & Digital Ledger
│   ├── inventory/              # Product Catalog & Stock Management
│   ├── invoices/               # Bill History & Sales Bill Printables
│   ├── settlement/             # Day-End Settlement & Audit Trail
│   └── settings/               # System Settings & Database Backup
├── docs/                       # Operational runbooks & architecture docs
│   ├── ARCHITECTURE.md         # Comprehensive Dual-Engine architecture & conflict invariants
│   ├── screenshots/            # High-resolution production UI screenshots
│   ├── DESIGN.md               # UI design specification & style guide
│   ├── PRODUCT.md              # Product requirements & user stories
│   ├── OPERATIONAL_RUNBOOK.md  # Day-to-day operations & runbook
│   └── DISASTER_RECOVERY_PLAN.md# Backup, restore & DR procedures
├── electron/                   # Desktop application wrapper
│   ├── main.js                 # Electron main process & splash screen
│   └── preload.js              # IPC bridge
├── prisma/                     # Database schema & migrations
│   └── schema.prisma           # Prisma Data Model (Paise monetary columns)
├── public/                     # Static assets, brand media & screenshots
├── server/lib/                 # Backend utility libraries
│   ├── auth.ts                 # JWT verification & password hashing
│   ├── prisma.ts               # Resilient Prisma client singleton
│   ├── store.ts                # Atomic offline LocalStore engine
│   └── tax.ts                  # GST tax calculation engine
├── tests/                      # Vitest test suite (E2E, security, financial, idempotency)
├── LICENSE                     # MIT Open Source License
├── Launch-TradeLedger-ERP.bat  # 1-Click Windows Desktop Launcher
└── package.json                # Project dependencies & build scripts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free for use, modification, and commercialization.
