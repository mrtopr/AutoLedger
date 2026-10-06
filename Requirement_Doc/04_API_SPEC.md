# 04. API Specification (REST, JSON)

Base: `/api/v1`. Auth: `Authorization: Bearer <jwt>`. All money fields are **integer paise**. Dates ISO-8601. Errors: `{ "error": { "code": "STRING", "message": "...", "details": {} } }`. List endpoints: `?page=&limit=&q=&sort=`. Mutating endpoints accept `Idempotency-Key` header.

## Auth
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/otp/request | `{phone}` → sends OTP |
| POST | /auth/otp/verify | `{phone, otp}` → `{token, user}` |
| POST | /auth/2fa/verify | Owner TOTP |
| GET | /me | Current user + tenant |

## Customers
| Method | Path | Notes |
|---|---|---|
| GET/POST | /customers | Create returns 409 on duplicate phone |
| GET/PATCH | /customers/:id | |
| GET | /customers/:id/ledger?from=&to= | Entries + running balance |
| GET | /customers/:id/statement.pdf?from=&to= | |
| GET | /customers/:id/purchases | Per-product history |
| GET | /customers/:id/credit | Current metrics, status, reasons, suggested limit |
| POST | /customers/:id/credit/override | OWNER only `{status, reason}` |
| PATCH | /customers/:id/credit-limit | OWNER only `{limit, reason}` |
| POST | /customers/:id/promises | `{invoiceId?, amount, promisedDate}` |
| POST | /customers/:id/messaging/pause | `{until}` |

## Catalog and inventory
| Method | Path |
|---|---|
| GET/POST | /products ; GET/PATCH /products/:id |
| GET | /products?bikeModel=&partNumber=&q= |
| GET/POST | /bike-models |
| GET | /inventory/stock | Current stock per product |
| POST | /inventory/movements | Purchase-in, adjustment `{productId, qty, reason, unitCost}` |
| GET | /inventory/low-stock |

## Invoices
| Method | Path | Notes |
|---|---|---|
| POST | /invoices | Create DRAFT: `{customerId?, type, items[], discount?, paidNow?, dueDate?, notes?}` |
| PATCH | /invoices/:id | DRAFT only |
| POST | /invoices/:id/issue | Assigns number, writes ledger, stock-out, records `paidNow` as payment, enqueues PDF + message. Returns 422 `CREDIT_LIMIT_EXCEEDED` / `OVERDUE_BLOCK` unless `{override:true}` by permitted role |
| POST | /invoices/:id/cancel | `{reason}` MANAGER+ |
| POST | /invoices/:id/credit-note | `{items[] or amount, reason, restock}` |
| POST | /invoices/:id/duplicate | Copy for repeat order → new DRAFT |
| GET | /invoices | Filter: status, customerId, from, to, overdue=true |
| GET | /invoices/:id | Includes items, allocations, events |
| GET | /invoices/:id/pdf?format=a4\|thermal80\|a5 | |
| POST | /invoices/:id/send | `{channels:["whatsapp","sms","email"]}` |
| POST | /invoices/:id/share-link | → `{url, expiresAt}` |
| POST | /invoices/:id/dispute | `{reason}` |

## Payments
| Method | Path | Notes |
|---|---|---|
| POST | /payments | `{customerId, amount, mode, reference?, receivedOn, allocation?:{strategy:"OLDEST_FIRST"\|"MANUAL", lines?:[{invoiceId, amount}]}}` |
| GET | /payments | |
| GET | /payments/:id | With allocations |
| POST | /payments/:id/reverse | `{reason}` for bounced cheque etc. |
| POST | /payments/links | `{invoiceId or customerId, amount}` → UPI/payment link via gateway |
| POST | /webhooks/payments | Gateway callback, signature verified, idempotent |
| GET | /payments/:id/receipt.pdf | |

## Reminders and messaging
| Method | Path |
|---|---|
| GET/POST/PATCH | /reminder-rules |
| GET/POST/PATCH | /message-templates |
| GET | /messages?customerId=&status= |
| POST | /messages/send | Manual send `{customerId, templateKey, params}` |
| POST | /reminders/preview | Shows who gets what today |
| POST | /webhooks/messaging | Delivery receipts, inbound replies (STOP → opt-out) |

## Public (token, no login)
| GET | /public/i/:token | Invoice view + pay button |
| GET | /public/s/:token | Customer statement + balance |
| POST | /public/i/:token/ack | Customer confirms/acknowledges receipt |
| POST | /public/i/:token/dispute | Customer raises dispute |

## Reports and exports
| GET | /reports/dashboard |
| GET | /reports/aging |
| GET | /reports/collections?from=&to= |
| GET | /reports/sales?groupBy=customer\|product\|month |
| GET | /reports/stock-valuation |
| POST | /exports/full | Async job → zip of CSV + PDFs, link when ready |
| GET | /exports/:id |

## Admin
| GET/POST/PATCH | /users |
| GET | /audit-log?entity=&userId=&from=&to= |
| GET | /backups | Status of recent runs |
| GET/PATCH | /settings | Reminder hours, credit policy, defaults |

## Key error codes
`VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_CUSTOMER`, `CREDIT_LIMIT_EXCEEDED`, `OVERDUE_BLOCK`, `INVOICE_IMMUTABLE`, `ALLOCATION_EXCEEDS_PAYMENT`, `ALLOCATION_EXCEEDS_INVOICE`, `INSUFFICIENT_STOCK_WARNING`, `TEMPLATE_NOT_APPROVED`, `CUSTOMER_OPTED_OUT`.

## Event names (internal bus / webhooks to future integrations)
`invoice.issued`, `invoice.paid`, `invoice.overdue`, `payment.received`, `payment.reversed`, `credit_note.created`, `reminder.sent`, `reminder.failed`, `customer.status_changed`.
