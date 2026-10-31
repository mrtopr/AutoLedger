# 11. Technical Debt & Prioritized Roadmap

## Priority 0 (P0) — Critical Data Loss, Financial Integrity & Security

### P0-1: Gapless Consecutive Invoice Numbering Generator
- **Problem**: Invoices are assigned random numbers via `Math.random()` in `app/api/v1/invoices/route.ts:166`.
- **Impact**: Violates Indian GST statutory regulations (Rule 46b mandates unique consecutive numbering) and risks duplicate invoice keys under concurrency.
- **Solution**: Increment `InvoiceSeries.currentNumber` inside a database transaction (`SELECT ... FOR UPDATE` in Prisma `$transaction`). Format as `INV/{FY}/{seriesCode}/{00001}`.
- **Complexity**: Medium (1–2 days).

### P0-2: Razorpay Webhook Signature Enforcement & Idempotency
- **Problem**: Signature validation is skipped if the secret is missing; duplicate webhooks duplicate credit entries.
- **Impact**: Financial loss via forged payment webhooks or double-crediting customer accounts.
- **Solution**: Require `RAZORPAY_WEBHOOK_SECRET`. Check for existing `Payment.gatewayRef` before mutating the ledger.
- **Complexity**: Small (0.5 day).

### P0-3: RBAC Enforcement on Invoice Cancellation
- **Problem**: Any user can issue `DELETE /api/v1/invoices` without role validation.
- **Impact**: Unauthorized erasure of sales and customer credit balances by counter clerks.
- **Solution**: Enforce `authUser.role === 'OWNER' || authUser.role === 'MANAGER'` guard.
- **Complexity**: Small (2 hours).

---

## Priority 1 (P1) — Essential Incomplete Core Workflows

### P1-1: Automated WhatsApp & SMS Reminders Pipeline
- **Problem**: `app/reminders` and `app/api/v1/reminders` are empty directories. Reminder rules (due day, overdue +3, +7, +15 days) cannot run automatically.
- **Impact**: Wholesalers fail to recover overdue receivables automatically.
- **Solution**: Implement BullMQ scheduled worker scanning overdue invoices every morning at 09:00 IST (honoring quiet hours 9 PM–8 AM), sending pre-approved WhatsApp Business API / MSG91 templates.
- **Complexity**: Large (3–4 days).

### P1-2: Dedicated Part Returns & Credit Notes Flow
- **Problem**: Returns can currently only be processed by cancelling the entire invoice. In real workshops, a mechanic often returns 1 out of 5 parts on a bill.
- **Impact**: Staff have to cancel and recreate entire invoices to process partial returns.
- **Solution**: Create a "Return Line Item / Issue Credit Note" modal. Generate a `CreditNote` document, restock the returned quantity via `StockMovement` (`RETURN_IN`), and post a credit entry to the customer ledger.
- **Complexity**: Medium (2 days).

### P1-3: Unified Repository Layer (Prisma vs LocalStore)
- **Problem**: Every route handler manually duplicates `if (hasDb) { ... } else { ... }` blocks.
- **Impact**: High maintenance overhead, code drift, and fragile database fallback.
- **Solution**: Create abstract repositories (`CustomerRepository`, `InvoiceRepository`, `PaymentRepository`) that encapsulate the fallback logic.
- **Complexity**: Large (3–5 days).

---

## Priority 2 (P2) — High-Value Product Capabilities

### P2-1: Bi-Directional Offline-to-Cloud Synchronization
- **Problem**: Invoices created while offline in `localStore` are never pushed to PostgreSQL.
- **Solution**: Build an offline outbox queue with sync markers (`isSynced: false`) that replays local transactions to PostgreSQL upon reconnection.
- **Complexity**: Large (4–5 days).

### P2-2: GSTR-1 & HSN Accounting Export
- **Problem**: Wholesalers must manually hand paper bills to their CA.
- **Solution**: Export monthly B2B, B2C, and HSN summary tables in Excel and JSON formats compatible with the GST portal.
- **Complexity**: Medium (2 days).

---

## Priority 3 (P3) — Maintainability & Polish

### P3-1: Decompose Monolithic Pages
- Break `app/pos/page.tsx` (2,015 lines) into `PosCartTable.tsx`, `PosCustomerBar.tsx`, and `PosItemSearch.tsx`.
- Break `app/portal/page.tsx` (95KB) into dedicated tab components.
- **Complexity**: Medium (2 days).

### P3-2: Commit ESLint Configuration
- Add `.eslintrc.json` extending `next/core-web-vitals` so `npm run lint` runs in CI without prompting.
- **Complexity**: Small (1 hour).
