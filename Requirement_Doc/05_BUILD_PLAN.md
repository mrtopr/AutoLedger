# 05. Build Plan: milestones and agent-ready tasks

How to use with Antigravity: open the repo, make sure `AGENTS.md` and `docs/` are present, then give the agent one milestone prompt at a time. Review the plan/artifacts it produces, run tests, merge, move to the next. Each milestone has a "Definition of Done" (DoD).

---
## M0. Foundation (week 1)
**Prompt:** "Read AGENTS.md and docs/. Scaffold the Next.js + TypeScript + Tailwind project, Prisma with PostgreSQL, docker-compose (Postgres, Redis, MinIO), ESLint/Prettier, Vitest, Playwright, GitHub Actions CI, `.env.example`, and a seed script with fake data (1 tenant, 20 customers, 100 products with bike compatibility)."
**DoD:** `docker compose up` + `npm run dev` works; CI green; seed runs.

## M1. Auth, tenants, roles, audit (week 1-2)
**Prompt:** "Implement phone-OTP auth (mock SMS provider in dev), JWT sessions, tenant scoping middleware, RBAC per the PRD permissions matrix, audit-log writer utility, and Postgres RLS policies. Add tests for permission denial."
**DoD:** Counter staff cannot cancel invoices or change limits; every write path logs to audit_log.

## M2. Customers and catalog (week 2-3)
**Prompt:** "Build customer CRUD (duplicate phone detection, credit limit, terms, consent flags) and product CRUD with bike-model compatibility and search by part number/bike model. Mobile-first list and form screens."
**DoD:** Create, search and edit on a 360px-wide screen; e2e test passes.

## M3. Invoicing core (week 3-5)
**Prompt:** "Implement tax calculation util (CGST/SGST/IGST, line discounts, rounding) with unit tests; invoice draft → issue flow with gapless FY numbering in a transaction; paidNow handling; immutability guard (service + DB trigger); invoice_versions for cancel/credit-note; stock-out movements; 'copy last invoice'. Build the Quick Bill screen targeting <30 s entry."
**DoD:** Issue ₹20,000 invoice with ₹2,000 paid → balance ₹18,000; numbering gapless under concurrent requests (test); update/delete of issued invoice rejected.

## M4. Payments, allocation, ledger (week 5-6)
**Prompt:** "Implement the pure `allocate()` engine (OLDEST_FIRST, MANUAL) with property tests; payments API; reversal flow; append-only ledger_entries; customer ledger screen with running balance; aging report; nightly reconciliation job."
**DoD:** The PRD flow 1 and 2 (₹20k/₹2k then ₹30k/₹5k) produce correct balances and allocations; reconcile job reports zero mismatch.

## M5. PDFs and sharing (week 6-7)
**Prompt:** "Render A4 professional invoice, 80mm thermal and A5 retail templates, payment receipt and customer statement as PDF; store in S3 with sha256; implement tokenised public view links (hashed, expiring, revocable, rate limited) with the customer view page showing balance and UPI QR."
**DoD:** PDFs match the PRD invoice contents; link works without login; view events recorded.

## M6. Messaging and reminders (week 7-9)
**Prompt:** "Create the MessagingProvider adapter with a mock and one real provider; template management with approval status; reminder rules engine and BullMQ jobs (scan every 15 min, send with retry/backoff); quiet hours; opt-out via inbound STOP; delivery webhooks; message log with cost. Seed English and Hinglish templates."
**DoD:** Overdue invoice triggers messages on the configured offsets in staging with the mock provider; opted-out customers are skipped; quiet hours respected.

## M7. Dashboard and reports (week 9-10)
**Prompt:** "Build the owner dashboard (outstanding, overdue, collected today/week/month, top defaulters, due soon) and reports: aging, collections, sales by customer/product, stock valuation, with CSV/XLSX export."
**DoD:** Dashboard numbers equal ledger sums (test).

## M8. Backup, export, hardening (week 10-11)
**Prompt:** "Implement daily encrypted pg_dump job to a second bucket, backup_runs logging and status page, weekly restore-verify job to a scratch DB, one-click full export (CSV + PDFs zip), owner TOTP 2FA, security headers, rate limits, and a restore runbook in docs/runbooks/restore.md."
**DoD:** Restore from a backup reproduces dashboard totals; failure alerts sent.

## M9. Pilot (week 11-14)
- Deploy to staging then production; import real customers via CSV importer.
- Run with 5-10 real mechanics for 4 weeks. Track: bill time, reminder delivery, collections, bugs, feedback.
- Fix and decide go/no-go for Phase 2.

---
## Phase 2 prompts (after pilot)
1. **Credit status:** implement `06_CREDIT_SCORING_SPEC.md` rules, metrics snapshots, reason codes, limit suggestion, override UI.
2. **Promise-to-pay:** log promises, follow-up reminders, kept/broken tracking.
3. **Credit notes and returns:** UI + restock + customer notification.
4. **Payment gateway:** payment links, webhook reconcile, auto allocation.
5. **Photo-to-entry:** upload slip photo → vision model extraction into a DRAFT invoice with mandatory human confirmation.
6. **WhatsApp text/voice entry:** parse Hinglish messages into drafts, confirm before issue.
7. **Offline mode:** queue bills locally, sync with conflict rules.

## Phase 3 prompts
Customer portal, installment plans, interest/late-fee rules (with written-consent flag), GST reports, Tally export, multi-wholesaler network with customer consent model, partner-financing data export.

---
## Cost and tooling checklist (non-code tasks for the owner)
- [ ] GST/e-invoicing format confirmed with CA
- [ ] WhatsApp Business API provider chosen, number verified, templates submitted
- [ ] SMS DLT registration (entity, header, templates)
- [ ] Payment gateway account (Razorpay/Cashfree) KYC
- [ ] Domain, hosting, managed Postgres, S3 bucket, Sentry
- [ ] Terms of service, privacy policy, customer consent wording (lawyer review)
- [ ] 5-10 pilot mechanics identified and informed

## Risk register (short)
| Risk | Mitigation |
|---|---|
| Data entry slower than paper | Quick Bill mode, copy-last-invoice, barcode/part search, time the flow in pilot |
| Template approvals delay messaging | Start approvals in week 1; SMS fallback |
| Wrong credit decisions | Rules only, explainable, owner override, warn-not-block default |
| Ledger errors | Append-only ledger, property tests, nightly reconcile |
| Data loss | Layered backups and restore drills |
| Regulatory exposure | Keep to trade credit; legal review before lending or score sharing |
