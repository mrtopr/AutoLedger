# 🏍️ AutoLedger ERP — Automotive Dealership, Workshop & B2B Khata Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Neon%20Serverless-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Electron](https://img.shields.io/badge/Desktop-Electron%20Windows%20App-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)

**AutoLedger ERP** is an enterprise-grade Dealership Management System (DMS), Fast Counter POS Billing, and B2B Khata Ledger platform engineered for automotive dealerships, two-wheeler workshops, spare parts distributors, and multi-brand service centers.

---

## 📑 Table of Contents

- [Key Highlights](#-key-highlights)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Core Functional Modules](#-core-functional-modules)
  - [1. Executive Dealership Dashboard](#1-executive-dealership-dashboard-)
  - [2. Quick POS & Counter Billing](#2-quick-pos--counter-billing-pos)
  - [3. Customer Khata & Digital Ledger](#3-customer-khata--digital-ledger-customers)
  - [4. Parts Catalog & Stock Inventory](#4-parts-catalog--stock-inventory-products--inventory)
  - [5. Invoices & Billing History](#5-invoices--billing-history-invoices)
  - [6. Daily Cash Settlement & GST Reports](#6-daily-cash-settlement--gst-reports-reports)
  - [7. Dealership Settings & Full System Backups](#7-dealership-settings--full-system-backups-settings)
- [Dual-Engine Data Resilience (Zero Downtime)](#-dual-engine-data-resilience-zero-downtime)
- [Multi-Language Support (English & हिन्दी)](#-multi-language-support-english--हिन्दी)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Web Platform](#running-the-web-platform)
  - [Running the Desktop App (Electron)](#running-the-desktop-app-electron)
- [Production Deployment & SaaS Commercialization](#-production-deployment--saas-commercialization)
- [Project Directory Structure](#-project-directory-structure)
- [License](#-license)

---

## ⚡ Key Highlights

* **Sub-10ms Counter Billing:** Ultra-fast part search with barcode scanning, SKU lookup, and vehicle compatibility filters (*Activa, Shine, Splendor, Pulsar, etc.*).
* **Dual-Engine Zero-Downtime Mode:** Connects to PostgreSQL (Neon Serverless) for cloud sync, with an instant fallback to an atomic local store (`.data/db_store.json`) when offline.
* **Dual GST Tax Engine:** Real-time intra-state (CGST 9% + SGST 9%) and inter-state (IGST 18%) computations with HSN validation and itemized tax breakdowns.
* **Strict Khata Credit Guardrails:** Real-time credit limits, overdue day tracking (30/60/90+ days), and automated credit status classification (`GREEN`, `YELLOW`, `RED`).
* **Multi-Format Invoices:** Instant A4 / A5 Tax Invoices and 3-inch Thermal Receipts with dynamic UPI payment QR codes and bank details.
* **1-Click WhatsApp Invoicing:** Instant dispatch of payment receipts, tax invoices, and Khata balance reminders directly to customer mobile numbers.
* **Full Database Backup & Disaster Recovery:** 1-click JSON database backup and restore directly from the settings panel.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18 | High-speed server & client rendering with streaming states |
| **Styling** | Tailwind CSS, Lucide Icons | Responsive design system with dark slate & crimson accents |
| **Desktop Client**| Electron 44 + Electron Builder | Native Windows `.exe` desktop application with splash loader |
| **Backend API** | Next.js Route Handlers (`app/api/v1`) | RESTful JSON endpoints with Zod schema validation |
| **Cloud Database**| PostgreSQL + Prisma ORM 5.22 | Relational schema with index optimization for ledger and stock queries |
| **Local Fallback**| Atomic LocalStore (`.data/db_store.json`) | Atomic file-persisted store for offline counter operations |
| **Authentication**| JWT + HTTP-Only Cookies | Secure session tokens with bcrypt password hashing & UUID validation |

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
* **Real-Time A4 & Thermal Print:** Instant modal preview and dual print support (3-inch Thermal Slip or A4 Tax Invoice).

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
* **Central Billing Registry:** Search and filter invoices by invoice number, customer name, date, or status.
* **Interactive GST A4 Preview:** Official GST tax invoice with showroom details, buyer GSTIN, HSN breakdown, bank details, and dynamic payment QR code.
* **Direct Actions:** Print, Download, or Share via WhatsApp.

### 6. Daily Cash Settlement & GST Reports (`/reports`)
* **Day-End Cash Reconciliation:** Realized cash in drawer, UPI collections, credit given, and credit recovered.
* **GSTR-1 & GSTR-3B Tax Summaries:** Taxable values, CGST, SGST, IGST totals formatted for tax filing.

### 7. Dealership Settings & Full System Backups (`/settings`)
* **Business Profile:** Configure showroom name, legal entity name, GSTIN, contact numbers, and bank account details.
* **Complete System Backup:** Download entire database snapshot as a timestamped JSON file (`AutoLedger_ERP_Backup_*.json`).
* **Crash Recovery / Restore:** Upload and restore from any previously exported backup file.

---

## 🔄 Dual-Engine Data Resilience (Zero Downtime)

AutoLedger ERP implements an intelligent **Dual-Engine Architecture**:
1. **PostgreSQL Mode:** When connected to cloud database (Neon/Supabase), all reads and writes sync across devices.
2. **LocalStore Fallback:** If PostgreSQL is unreachable or offline, the platform automatically routes requests to `.data/db_store.json`. The POS counter never stops billing.

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
git clone <your-repo-url>
cd B2B_Platform

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
Or simply double-click **`Launch-AutoLedger-ERP.bat`** for 1-click startup!

---

## 💼 Production Deployment & SaaS Commercialization

To sell AutoLedger ERP to automotive dealerships and workshop owners:

1. **Deploy the Web & API Engine:**
   - Host on **[Vercel](https://vercel.com)** or **Railway**.
   - Connect to a managed PostgreSQL database on **[Neon.tech](https://neon.tech)**.
2. **Configure Production URL in Electron:**
   - In `electron/main.js`, point `APP_URL` to your production domain (e.g. `https://app.autoledger-erp.com`).
3. **Build the Client Installer (.exe):**
   ```powershell
   npm run electron:build
   ```
   Distribute `AutoLedger ERP Setup 1.0.0.exe` (found in `/dist`) to clients.

---

## 📁 Project Directory Structure

```
B2B_Platform/
├── app/                        # Next.js 14 App Router
│   ├── api/v1/                 # Backend RESTful API endpoints
│   │   ├── auth/               # Login, session, token verification
│   │   ├── backup/             # Full JSON database export & restore
│   │   ├── customers/          # Khata ledger, payments, credit limits
│   │   ├── invoices/           # POS bill creation & tax invoices
│   │   ├── products/           # Inventory catalog & stock adjustments
│   │   └── settings/           # Dealership profile & GST configurations
│   ├── components/             # Reusable UI components & Topbar/Sidebar
│   ├── context/                # Auth & Bilingual Language Contexts
│   ├── pos/                    # High-speed POS Counter Billing
│   ├── customers/              # Customer Khata & Digital Ledger
│   ├── inventory/              # Spare Parts Catalog & Stock Management
│   ├── invoices/               # Invoice History & GST Printables
│   ├── reports/                # Daybook & GST Tax Summaries
│   └── settings/               # Dealership Settings & Database Backup
├── electron/                   # Desktop application wrapper
│   ├── main.js                 # Electron main process & splash screen
│   └── preload.js              # IPC bridge
├── prisma/                     # Database schema & migrations
│   └── schema.prisma           # Prisma Data Model (Paise monetary columns)
├── server/lib/                 # Backend utility libraries
│   ├── auth.ts                 # JWT verification & password hashing
│   ├── prisma.ts               # Resilient Prisma client singleton
│   ├── store.ts                # Atomic offline LocalStore engine
│   └── tax.ts                  # GST tax calculation engine
├── Launch-AutoLedger-ERP.bat   # 1-Click Windows Desktop Launcher
└── package.json                # Project dependencies & build scripts
```

---

## 📄 License

Proprietary — All Rights Reserved © 2026 AutoLedger ERP.
