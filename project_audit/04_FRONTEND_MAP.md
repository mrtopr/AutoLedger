# 04. Frontend Routes & UI Component Map

## 1. Route Inventory

| Route | File Path | Purpose & Primary Interactions | Auth Required | Data Dependencies |
|---|---|---|---|---|
| `/` | `app/page.tsx` (871 lines) | Executive Dashboard: KPI cards, 7-day revenue trend, overdue defaulters table, low-stock warnings, quick action buttons. | Yes (Staff) | `GET /api/v1/dashboard` |
| `/pos` | `app/pos/page.tsx` (2015 lines) | High-Speed Counter POS: Part search, barcode scan, bike model filter chips, cart table, split cash/UPI/credit payment, thermal invoice generation. | Yes (Staff) | `GET /api/v1/products`, `GET /api/v1/customers`, `GET /api/v1/bike-models`, `POST /api/v1/invoices` |
| `/customers` | `app/customers/page.tsx` (40KB) | Customer Directory: Search, credit status filter (Green/Yellow/Red), total outstanding, aging indicators, customer creation modal. | Yes (Staff) | `GET /api/v1/customers` |
| `/customers/[id]` | `app/customers/[id]/page.tsx` (56KB) | Customer Khata Ledger: Chronological statement timeline, direct payment entry modal, WhatsApp statement sharing, credit limit adjust. | Yes (Staff) | `GET /api/v1/customers/[id]`, `GET /api/v1/customers/[id]/ledger`, `POST /api/v1/payments` |
| `/products` | `app/products/page.tsx` (52KB) | Product Catalog: SKU list, bike compatibility chips, price edits (purchase, sale, MRP), bulk import trigger. | Yes (Staff) | `GET/POST /api/v1/products`, `GET /api/v1/bike-models` |
| `/inventory` | `app/inventory/page.tsx` (68KB) | Stock Control: Stock levels, reorder thresholds, manual stock adjustments (PURCHASE, ADJUSTMENT), stock movement audit trail. | Yes (Staff) | `GET /api/v1/products`, `POST /api/v1/products/[id]/stock` |
| `/invoices` | `app/invoices/page.tsx` (29KB) | Historical Invoices: Filter by date/customer, invoice preview modal, reprint thermal/A4, invoice cancellation with reason. | Yes (Staff) | `GET /api/v1/invoices`, `DELETE /api/v1/invoices` |
| `/settlement` | `app/settlement/page.tsx` (37KB) | Day-End Cash Settlement: Cash drawer reconciliation, physical cash count by denomination, shortage/excess calculation, Z-Report print. | Yes (Staff) | `GET/POST /api/v1/reports/settlement` |
| `/portal` | `app/portal/page.tsx` (95KB) | B2B Mechanic Self-Service Portal: Mobile-first interface for garage owners to view balance, browse catalog, order parts, pay via Razorpay. | Yes (Customer OTP) | `app/api/v1/portal/*` |
| `/staff` | `app/staff/page.tsx` (32KB) | Team Management: Manage counter staff, assign roles (OWNER, MANAGER, COUNTER_STAFF), activate/deactivate users. | Yes (Owner/Manager) | `GET/POST /api/v1/staff` |
| `/settings` | `app/settings/page.tsx` (45KB) | Business Configuration: Legal name, GSTIN, UPI ID, bank account details, 80mm thermal slip printer header/footer notes. | Yes (Owner) | `GET/POST /api/v1/tenant` |
| `/login` | `app/login/page.tsx` | Staff Authentication: Phone/Password or OTP login with session cookie. | Public | `POST /api/v1/auth/login` |
| `/signup` | `app/signup/page.tsx` | New Tenant Registration: Create business account, owner user, initial tenant. | Public | `POST /api/v1/auth/signup` |
| `/onboarding` | `app/onboarding/page.tsx` | First-Run Wizard: Guides new wholesaler through company details, initial catalog, and first customer setup. | Yes (Staff) | `POST /api/v1/onboarding/complete` |

---

## 2. Reusable UI Components & Modals

| Component | File Path | Size | Key Functionality |
|---|---|---|---|
| `InvoicePreviewModal` | `app/components/InvoicePreviewModal.tsx` | 31KB | Dual-view printing: Standard A4 GST Tax Invoice and 3-inch (80mm) thermal counter receipt with live UPI payment QR. |
| `BulkImportModal` | `app/components/BulkImportModal.tsx` | 85KB | Multi-format catalog importer (Excel, CSV, Tally XML) with column mapper, preview table, validation rules, and background cloud sync. |
| `BulkOpeningBalanceModal` | `app/components/BulkOpeningBalanceModal.tsx` | 19KB | Batch opening balance importer for migrating existing customer credit ledgers. |
| `ZReportModal` | `app/components/ZReportModal.tsx` | 30KB | Day-end settlement summary modal displaying opening cash, sales breakdown, payment modes, physical cash count, and variance. |
| `RazorpayModal` | `app/components/RazorpayModal.tsx` | 26KB | Embeds Razorpay checkout with live QR code display and status polling (`/api/v1/payments/razorpay/status`). |
| `CommandPalette` | `app/components/CommandPalette.tsx` | 28KB | Global `Ctrl+K` quick switcher for keyboard-first navigation between POS, Customers, Products, and Settings. |
| `AddCustomerModal` | `app/components/AddCustomerModal.tsx` | 14KB | Fast customer creation modal with phone duplicate check and initial credit limit. |
| `AddLedgerEntryModal`| `app/components/AddLedgerEntryModal.tsx`| 11KB | Records direct payments (Cash, UPI, Cheque, Bank Transfer) or manual Khata adjustments. |
| `Sidebar` & `Topbar` | `app/components/Sidebar.tsx`, `Topbar.tsx` | 13KB | Main navigation shell with responsive drawer, connection status badge, and tenant branding. |
| `LanguageToggle` | `app/components/LanguageToggle.tsx` | 1KB | Switches interface language between English and हिन्दी. |

---

## 3. Global Context & State Management
1. **`AuthContext` (`app/context/AuthContext.tsx`)**:
   - Manages currently logged-in user profile, role, tenant details, and logout flow.
   - Restores session automatically from `/api/v1/auth/me`.
2. **`LanguageContext` (`app/context/LanguageContext.tsx`)**:
   - Provides translation dictionary (`t('dashboard')`, `t('pos')`, `t('customers')`, etc.) between English and Hindi.
   - Stores preference in browser `localStorage`.
