# 13. File Reference & Responsibility Index

| File Path | Primary Responsibility | Key Functions / Exports | Dependent Files |
|---|---|---|---|
| `server/lib/tax.ts` | Authoritative GST, HSN, line discount, and roundoff calculation | `calculateInvoiceTax()`, `formatPaiseToRupees()`, `parseRupeesToPaise()` | `app/pos/page.tsx`, `app/api/v1/invoices/route.ts`, `InvoicePreviewModal.tsx` |
| `server/lib/allocation.ts` | Pure FIFO payment allocation engine | `allocatePayment()` | `app/api/v1/payments/route.ts`, `server/lib/allocation.test.ts` |
| `server/lib/store.ts` | Atomic local JSON fallback storage (~12MB cache) | `localStore` singleton (`getInvoices`, `createInvoice`, `addLedgerEntry`, etc.) | All `app/api/v1/*` routes |
| `server/lib/prisma.ts` | Prisma client singleton & connection healthcheck | `prisma`, `isPostgresAvailable()` | All API routes, `auth.ts`, `cloudSync.ts` |
| `server/lib/auth.ts` | Session token verification, user retrieval, password hashing | `getAuthenticatedUser()`, `verifyToken()`, `signToken()` | All API route handlers, `AuthContext.tsx` |
| `server/lib/razorpay.ts` | Razorpay payment link creation and webhook signature validation | `createPaymentLink()`, `verifyRazorpaySignature()` | `app/api/v1/payments/razorpay/*`, `webhooks/razorpay` |
| `server/lib/cloudSync.ts` | Background product catalog synchronization worker | `queueCloudSync()` | `app/api/v1/products/bulk-import/route.ts`, `BulkImportModal.tsx` |
| `app/lib/creditScore.ts` | Deterministic 300-900 explainable credit risk calculation | `calculateCustomerCreditScore()` | `app/customers/page.tsx`, `app/customers/[id]/page.tsx`, `app/pos/page.tsx` |
| `app/lib/tallyParser.ts` | Multi-regex parser for legacy Tally XML and Excel sheets | `parseTallyFile()`, `extractPartNumberAndCompatibility()` | `BulkImportModal.tsx`, `BulkOpeningBalanceModal.tsx` |
| `app/lib/tallySearch.ts` | Fast fuzzy token search for automotive SKUs and bike names | `searchTallyItems()`, `getHighlightedTallySegments()` | `app/pos/page.tsx`, `app/products/page.tsx` |
| `app/pos/page.tsx` | Point-of-Sale counter billing user interface | `PosPage` component (cart, split payment, thermal preview) | `tax.ts`, `InvoicePreviewModal.tsx`, `AddCustomerModal.tsx` |
| `app/components/InvoicePreviewModal.tsx` | Formats bills for 80mm thermal slip printers and A4 tax invoices | `InvoicePreviewModal` | `app/pos/page.tsx`, `app/invoices/page.tsx` |
| `app/components/ZReportModal.tsx` | Day-end settlement reconciliation modal | `ZReportModal` | `app/settlement/page.tsx` |
| `app/components/BulkImportModal.tsx` | Bulk spreadsheet / Tally import wizard with field mapping | `BulkImportModal` | `app/products/page.tsx`, `cloudSync.ts` |
| `app/portal/page.tsx` | Mobile-first B2B mechanic self-service portal | `PortalPage` component | `app/api/v1/portal/*` |
| `electron/main.js` | Electron desktop lifecycle, splash window, server monitoring | Main process | `electron/preload.js`, `Launch-AutoLedger-ERP.bat` |
| `middleware.ts` | Edge rate limiter for `/api/*` endpoints | `middleware` function | Next.js runtime |
| `prisma/schema.prisma` | PostgreSQL relational data model and constraints | 27 models, 11 enums | Prisma Client, PostgreSQL |
