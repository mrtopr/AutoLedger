# 05. Backend REST API Reference

All API routes are prefixed under `/api/v1/`. Rate limiting of 100 requests/minute per IP is enforced via `middleware.ts`.

---

## 1. Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Auth Required | Purpose | Payload / Response |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | None | Staff login via phone + password | Body: `{ phone, password }`<br>Response: Sets `auth_token` cookie; returns `{ success, user }` |
| `POST` | `/api/v1/auth/signup` | None | Register new tenant and owner user | Body: `{ name, phone, password, businessName }` |
| `GET` | `/api/v1/auth/me` | Cookie/Bearer | Returns current authenticated user profile | Response: `{ success, user: { id, name, phone, role, tenantId } }` |
| `POST` | `/api/v1/auth/logout` | None | Clears session cookie | Response: `{ success: true }` |
| `POST` | `/api/v1/auth/email-otp/send` | None | Dispatches OTP via email | Body: `{ email }` |
| `POST` | `/api/v1/auth/email-otp/verify`| None | Verifies email OTP | Body: `{ email, otp }` |
| `GET` | `/api/v1/auth/firebase-config` | None | Returns public Firebase config for SMS OTP | Response: `{ apiKey, authDomain, projectId... }` |
| `POST` | `/api/v1/auth/firebase-login` | None | Exchanges Firebase phone token for app session | Body: `{ idToken }` |

---

## 2. Invoicing Endpoints (`/api/v1/invoices`)

| Method | Endpoint | Auth Required | Purpose & Business Logic |
|---|---|---|---|
| `GET` | `/api/v1/invoices` | Staff | Returns historical invoices for the tenant. Includes line items, customer name, tax breakdown, and paid/balance status. |
| `POST` | `/api/v1/invoices` | Staff | **Creates and issues a new counter bill**: Recalculates tax via `calculateInvoiceTax()`, creates invoice record, deducts stock via `StockMovement`, creates debit entry in `LedgerEntry`, and if cash/upi paid > 0, records payment and credit ledger entry. |
| `DELETE`| `/api/v1/invoices` | Staff (**Role check missing!**) | **Cancels an invoice**: Updates status to `CANCELLED`, restores inventory via `RETURN_IN` stock movements, and creates an `ADJUSTMENT` credit entry reversing customer Khata balance. |

---

## 3. Payments & Allocation Endpoints (`/api/v1/payments`)

| Method | Endpoint | Auth Required | Purpose & Business Logic |
|---|---|---|---|
| `GET` | `/api/v1/payments` | Staff | Returns payment transactions, optionally filtered by `?customerId=`. |
| `POST` | `/api/v1/payments` | Staff | **Records payment and performs allocation**: Runs pure `allocatePayment()` FIFO engine across open invoices, updates invoice `balanceDue`, updates status (`PAID` or `PARTIALLY_PAID`), posts credit `LedgerEntry`, and recalculates customer credit risk status (`GREEN`/`YELLOW`). |
| `POST` | `/api/v1/payments/allocate` | Staff | Manually adjusts payment-to-invoice allocation lines. |
| `POST` | `/api/v1/payments/razorpay/link`| Staff/Portal | Creates a Razorpay UPI payment link with tenant and customer notes. |
| `GET` | `/api/v1/payments/razorpay/status`| Staff/Portal | Polls status of a specific Razorpay payment link. |

---

## 4. Customers & Khata Endpoints (`/api/v1/customers`)

| Method | Endpoint | Auth Required | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/customers` | Staff | Lists customers with current running balance, overdue amount, aging buckets, and credit status (`GREEN`/`YELLOW`/`RED`). |
| `POST` | `/api/v1/customers` | Staff | Creates customer with initial credit limit, payment terms, and optional opening balance ledger entry (`DUE` or `ADVANCE`). |
| `GET` | `/api/v1/customers/[id]` | Staff | Fetches customer profile, lifetime metrics, and credit limit. |
| `PUT` | `/api/v1/customers/[id]` | Staff | Updates customer contact info, shop name, address, GSTIN, and credit limit. |
| `GET` | `/api/v1/customers/[id]/ledger` | Staff | Returns chronological ledger entries (Debit for bills, Credit for payments) with calculated running balance. |
| `GET` | `/api/v1/customers/[id]/payments`| Staff | Returns list of payment receipts issued to this customer. |
| `POST` | `/api/v1/customers/bulk-opening-balance` | Staff | Bulk imports opening balances for multiple customers from Excel/Tally. |

---

## 5. Products & Inventory Endpoints (`/api/v1/products`)

| Method | Endpoint | Auth Required | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/products` | Staff/Portal | Searches product catalog by query, brand, category, or bike model ID. |
| `POST` | `/api/v1/products` | Staff | Creates new SKU with HSN, GST rate, prices, and bike model compatibility mappings. |
| `GET/PUT/DELETE`| `/api/v1/products/[id]`| Staff | Retrieves, updates, or soft-deletes a product SKU. |
| `POST` | `/api/v1/products/[id]/stock` | Staff | Records a manual stock movement (`PURCHASE`, `ADJUSTMENT`, `RETURN_IN`). |
| `POST` | `/api/v1/products/bulk-import` | Staff | Bulk creates/updates products from parsed spreadsheet/Tally items and enqueues cloud sync. |
| `POST` | `/api/v1/products/bulk-delete` | Staff | Bulk deactivates product SKUs. |

---

## 6. Settlement & Reports Endpoints (`/api/v1/reports`)

| Method | Endpoint | Auth Required | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/reports/settlement` | Staff | Returns daily cash drawer summary: Gross sales, Cash collected, UPI collected, Bank collected, Credit given, and previous saved settlement for the target date. |
| `POST` | `/api/v1/reports/settlement` | Staff | **Saves Day-End Z-Report**: Records opening cash, closing cash, physical cash note count breakdown (500x, 200x, 100x...), calculates discrepancy (cash shortage/excess), and closes the daily drawer. |

---

## 7. B2B Customer Portal Endpoints (`/api/v1/portal`)

| Method | Endpoint | Auth Required | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/portal/auth/send-otp` | None | Sends login OTP to mechanic/garage phone number. |
| `POST` | `/api/v1/portal/auth/verify-otp`| None | Verifies OTP and returns customer portal session token. |
| `GET` | `/api/v1/portal/me` | Customer Portal | Returns customer shop details, live Khata balance, credit limit, and recent orders. |
| `GET` | `/api/v1/portal/catalog` | Customer Portal | Returns wholesale parts catalog with customer-specific pricing and stock availability. |
| `POST` | `/api/v1/portal/orders` | Customer Portal | Submits restock order from mechanic directly to wholesaler. |
| `POST` | `/api/v1/portal/pay` | Customer Portal | Initiates Razorpay payment link for mechanic to pay outstanding dues. |

---

## 8. Webhook Endpoints (`/api/v1/webhooks`)

| Method | Endpoint | Auth Required | Purpose & Risk |
|---|---|---|---|
| `POST` | `/api/v1/webhooks/razorpay` | Signature Header | **Receives Razorpay events** (`payment.captured`, `payment.failed`, `refund.processed`). On success: automatically posts Credit `LedgerEntry` and marks invoice paid. **Security Warning**: Skips verification if `RAZORPAY_WEBHOOK_SECRET` is unset; lacks idempotency checks for duplicate webhooks. |
