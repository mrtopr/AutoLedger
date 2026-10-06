# AGENTS.md: Project rules for AI coding agents (Antigravity)

Place this file at the repo root. If your Antigravity version uses a rules folder, copy it to `.agent/rules/` too.
Read `docs/01_PRD.md`, `docs/02_ARCHITECTURE.md`, `docs/03_DATA_MODEL.sql`, `docs/04_API_SPEC.md` before writing code.

## Product in one line
Digital khata for motorbike-parts wholesalers: invoices, credit ledger, payment allocation, automatic WhatsApp/SMS reminders, simple explainable credit status.

## Stack (do not change without asking)
- TypeScript everywhere. Next.js (App Router) for web + API routes, mobile-first responsive UI, Tailwind.
- PostgreSQL + Prisma ORM. Redis + BullMQ for background jobs (reminders, PDF, backups).
- Auth: email/phone OTP, JWT sessions, roles: OWNER, MANAGER, COUNTER_STAFF.
- PDF: server-side HTML-to-PDF (Playwright or @react-pdf). Storage: S3-compatible bucket.
- Messaging: provider adapter interface (Gupshup/Interakt/Twilio for WhatsApp, MSG91 for SMS). Never call a provider directly from business code.
- Tests: Vitest (unit), Playwright (e2e).

## Non-negotiable rules
1. **Money is stored as integer paise** (BigInt/Int). Never use floats for money. Format only in the UI.
2. **Issued invoices are immutable.** No delete, no edit. Corrections happen through cancel-with-reason, credit note, or a new version. Enforce in the service layer AND with a DB trigger.
3. **Invoice numbers are sequential per financial year and series**, gapless, generated inside a DB transaction (`INV/2026-27/00001`).
4. **Ledger is append-only.** Balance = sum of ledger entries. Never store a balance that cannot be recomputed.
5. **Payment allocation is oldest-invoice-first by default**, with manual override. Every payment must have allocations summing to ≤ payment amount; any remainder is an unallocated advance.
6. **Every write to invoices, payments, credit limits, credit notes goes to `audit_log`** (who, what, before, after, when).
7. **Multi-tenant from day one:** every table has `tenant_id`; every query is scoped by it. Add Postgres row-level security.
8. **Reminders respect consent, quiet hours (9pm-8am IST) and opt-out.** Use approved templates only.
9. **No secrets in code.** Use environment variables; provide `.env.example`.
10. **Every feature ships with tests**, and a migration if the schema changes. Run lint, typecheck and tests before declaring a task done.
11. Timezone: store UTC, display Asia/Kolkata. Currency: INR. UI languages: English + Hinglish (Hindi later).
12. Credit score is **rules-based and explainable**. Every score returns reason codes. No ML in v1.

## Working style for agents
- Work one milestone task at a time from `docs/05_BUILD_PLAN.md`. Produce a short plan first, then implement, then verify.
- Prefer small, reviewable commits. Ask before adding dependencies not listed above.
- When a requirement is ambiguous, check `docs/01_PRD.md` open questions; if still unclear, leave a `TODO(question)` and list it in your summary.
- Never put real customer data in tests or seeds. Use the seed script's fake data.

## Folder layout
```
/app            Next.js routes (UI + /api)
/server         services, repositories, jobs, adapters (messaging, payments, storage)
/prisma         schema.prisma, migrations, seed.ts
/docs           these documents
/tests          unit + e2e
```
