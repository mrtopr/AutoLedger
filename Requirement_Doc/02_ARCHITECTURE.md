# 02. Architecture

## 1. System overview
```
Browser / mobile web (Next.js UI)
        │ HTTPS
Next.js server (API routes + server actions)
        │
 ┌──────┼───────────────┬─────────────────┐
 Postgres (Prisma)   Redis + BullMQ    S3 storage (PDFs, backups, exports)
                         │
              Workers: reminders, PDF render, backup, score recompute, webhooks
                         │
        Adapters: WhatsApp/SMS provider, payment gateway, OCR/vision (Phase 2)
```
Modular monolith. One repo, one deployable web app, one worker process. Split services only if scale demands it.

## 2. Modules (server/)
| Module | Responsibility |
|---|---|
| `tenants`, `auth` | Tenant, users, roles, OTP login, sessions |
| `customers` | CRM, credit limit, consent flags |
| `catalog`, `inventory` | Products, compatibility, stock movements |
| `invoicing` | Numbering, tax calc, lifecycle, PDF, share links |
| `payments` | Payments, allocation engine, reversals |
| `ledger` | Append-only entries, balances, aging, statements |
| `reminders` | Rules, scheduler, templates, send log |
| `messaging` | Provider adapters, webhook handling (delivery, replies, opt-out) |
| `credit` | Metrics, status/score, limit suggestion, overrides |
| `reports`, `exports` | Dashboards, CSV/XLSX/PDF, full data export |
| `backup` | Scheduled dumps, verification, status |
| `audit` | Audit log writer + viewer |

Each module exposes a service interface; routes call services, services call repositories. No cross-module direct DB access.

## 3. Key design decisions
1. **Money in integer paise.** GST calculation in a single `tax.ts` util with unit tests (rounding rules documented).
2. **Ledger as source of truth.** `ledger_entries` rows: `INVOICE` (debit), `PAYMENT` (credit), `CREDIT_NOTE` (credit), `DEBIT_NOTE` (debit), `ADJUSTMENT`. Customer balance = SUM. Cached balance columns are allowed only as derived values refreshed in the same transaction and verified by a nightly reconciliation job.
3. **Allocation engine:** pure function `allocate(payment, openInvoices, strategy)` → list of `{invoiceId, amount}`. Strategies: `OLDEST_FIRST`, `MANUAL`. Heavy unit tests.
4. **Invoice immutability:** service-layer guard + DB trigger rejecting UPDATE/DELETE on issued invoices except for status/paid fields via a controlled function. Edits create `invoice_versions`.
5. **Numbering:** `invoice_series` table row locked with `SELECT ... FOR UPDATE` inside the issue transaction.
6. **Idempotency:** all webhook handlers and payment creation endpoints accept an idempotency key.
7. **Provider adapters:** `MessagingProvider { send(template, to, params) , parseWebhook() }`, `PaymentProvider { createLink(), verifyWebhook() }`. Mock implementations for dev/test.
8. **Public links:** random 128-bit token, stored hashed, optional expiry, revocable, rate-limited, shows only that invoice/statement.
9. **Multi-tenancy:** `tenant_id` on all tables, Prisma middleware to inject filter, Postgres RLS as a second line of defence.
10. **Explainable credit:** metrics are computed into `customer_metrics` snapshots; status/score derived from the snapshot with reason codes saved alongside.

## 4. Background jobs
| Job | Schedule | Notes |
|---|---|---|
| `reminder.scan` | every 15 min | Finds due reminders per rules, enqueues sends, honours quiet hours |
| `reminder.send` | on demand | Retry 3x with exponential backoff, logs cost |
| `invoice.pdf` | on issue | Renders, stores in S3, saves checksum |
| `metrics.recompute` | nightly + on payment | Updates `customer_metrics`, status |
| `ledger.reconcile` | nightly | Compares cached vs computed balances, alerts on mismatch |
| `backup.db` | daily | pg_dump → encrypted → other-region bucket, log in `backup_runs` |
| `backup.verify` | weekly | Restore to scratch DB, run checksum queries |
| `link.expire` | daily | Expire share tokens |

## 5. Security
- OTP login with rate limits; owner TOTP 2FA; session rotation; secure cookies.
- RBAC middleware (see PRD permissions matrix); deny-by-default.
- Input validation with Zod on every route. Parameterised queries only.
- PII encrypted at rest (disk + column-level for GSTIN/bank if stored). Secrets via env/secret manager.
- Webhook signature verification. CSRF protection. Security headers. Dependency audit in CI.
- Audit log is append-only; no UI to edit it.

## 6. Environments and deployment
- `dev` (docker-compose: Postgres, Redis, MinIO, mock providers), `staging`, `prod`.
- CI (GitHub Actions): install, lint, typecheck, unit tests, e2e on staging, migration dry run.
- Hosting suggestion: a managed Postgres (backups + PITR), a container host for web + worker, S3-compatible storage in an India region where possible.
- Observability: structured JSON logs, error tracking (Sentry), uptime check, job-failure alerts to owner WhatsApp/email.

## 7. Backup and DR design
- Managed DB PITR (≥ 7 days) + daily logical dump kept 30+ days in a second region.
- PDFs stored write-once (object lock / versioning on).
- Monthly full export (CSV + PDFs zip) emailed/downloadable to owner.
- Quarterly restore drill checklist in `docs/runbooks/restore.md` (create during Milestone 9).

## 8. Testing strategy
- Unit: tax calc, allocation engine, numbering, aging, scoring rules.
- Integration: invoice → payment → ledger → reminder flow with mock providers.
- E2E (Playwright): the five flows in PRD section 8.
- Property tests: for any sequence of invoices and payments, ledger balance = Σ invoices − Σ payments − Σ credit notes, and allocations never exceed amounts.
