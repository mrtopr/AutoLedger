# 01. Project Structure & Key Files

## 1. Directory Tree Overview

```
B2B_Platform/
├── .agents/                 # Antigravity agent configurations & local skills (impeccable)
├── .data/
│   └── db_store.json        # Atomic local JSON database fallback (~12MB data cache)
├── .next/                   # Next.js build cache (omitted from git)
├── app/                     # Next.js 14 App Router (pages, layouts, API routes, components)
│   ├── api/                 # Backend REST API routes
│   │   └── v1/              # Version 1 API endpoints (16 resource domains)
│   ├── components/          # Reusable UI components & modals (20 files)
│   ├── context/             # React context providers (AuthContext, LanguageContext)
│   ├── customers/           # Customer Khata CRM & detail pages ([id])
│   ├── inventory/           # Stock management & movement tracking
│   ├── invoices/            # Historical invoice listing, preview & print
│   ├── lib/                 # Client/Shared utilities (tallyParser, tallySearch, creditScore)
│   ├── login/               # Owner & counter staff login
│   ├── onboarding/          # First-run tenant onboarding & profile setup
│   ├── portal/              # B2B Customer self-service portal (orders, ledger, payment)
│   ├── pos/                 # High-velocity POS Counter Billing page (2015 lines)
│   ├── products/            # Catalog management, bike compatibility mapping
│   ├── reminders/           # (Empty directory - planned reminder UI)
│   ├── settings/            # Business profile, GST, bank details, thermal printer options
│   ├── settlement/          # Daily cash drawer reconciliation & Z-Report
│   ├── signup/              # New business tenant registration
│   ├── staff/               # Staff team management & role assignment
│   ├── globals.css          # Tailwind CSS directives & global custom scrollbars
│   ├── layout.tsx           # Root HTML layout with context providers
│   └── page.tsx             # Main Executive Dashboard (analytics, overdue, trends)
├── electron/                # Electron desktop wrapper
│   ├── main.js              # Electron main process, window creation, single-instance lock
│   └── preload.js           # Secure contextBridge IPC bridge
├── prisma/                  # Database schema & migrations
│   ├── schema.prisma        # 877 lines of Prisma models, enums & relational constraints
│   ├── migrations/          # SQL migrations history
│   └── seed.ts              # Database seeding script with fake tenant & catalog
├── project_audit/           # Master audit reports (16 documents for AI & developer handoff)
├── public/                  # Static assets, branding logos, favicons, Honda emblem
├── Requirement_Doc/         # Foundational PRD, architecture, and agent specifications
│   ├── 01_PRD.md            # Product Requirements Document
│   ├── 02_ARCHITECTURE.md   # Architectural principles & module definitions
│   ├── 03_DATA_MODEL.sql    # Raw SQL relational schema reference
│   ├── 04_API_SPEC.md       # Target API specification
│   ├── 05_BUILD_PLAN.md     # Milestone-by-milestone implementation plan
│   ├── 06_CREDIT_SCORING_SPEC.md # Explainable credit scoring rules & weights
│   ├── 07_MESSAGE_TEMPLATES_AND_UX.md # Notification templates (English/Hinglish)
│   └── AGENTS.md            # Non-negotiable coding rules for AI assistants
├── server/                  # Server-side business logic, repositories, and lib
│   └── lib/                 # Core server libraries
│       ├── allocation.ts    # Pure FIFO payment allocation engine
│       ├── allocation.test.ts # Vitest tests for FIFO allocation
│       ├── auth.ts          # JWT session signing/verification & user extraction
│       ├── cloudSync.ts     # Background cloud synchronization worker for catalog items
│       ├── email.ts         # Email notification dispatch via nodemailer/mock
│       ├── otpStore.ts      # In-memory OTP storage with TTL
│       ├── prisma.ts        # Prisma client singleton & isPostgresAvailable() healthcheck
│       ├── razorpay.ts      # Razorpay payment link & signature verification
│       ├── store.ts         # Comprehensive local JSON store implementation (988 lines)
│       └── tax.ts           # Integer paise GST, HSN, line-discount & roundoff calculator
├── tests/                   # Test configuration
│   └── setup.ts             # Vitest test setup script
├── Launch-AutoLedger-ERP.bat # Windows desktop launcher batch file
├── middleware.ts            # Next.js edge middleware (API rate limiting)
├── package.json             # NPM dependencies and scripts
├── tailwind.config.ts       # Tailwind CSS design tokens & theme colors
├── tsconfig.json            # TypeScript configuration
└── vitest.config.ts         # Vitest unit test runner configuration
```

---

## 2. Directory Responsibilities

| Directory | Responsibility | Critical Files |
|---|---|---|
| `app/pos/` | Point-of-Sale counter billing engine | `page.tsx`: cart state, SKU search, bike chips, split payment |
| `app/components/` | Core interactive modals and reusable components | `BulkImportModal.tsx`, `InvoicePreviewModal.tsx`, `ZReportModal.tsx` |
| `app/customers/` | Khata CRM, ledger statements, aging buckets | `page.tsx`, `[id]/page.tsx` |
| `app/portal/` | Self-service B2B customer portal | `page.tsx`: catalog, cart, order placement, Razorpay checkout |
| `server/lib/` | Authoritative financial and business calculation engines | `tax.ts` (GST math), `allocation.ts` (FIFO), `store.ts` (Local DB), `prisma.ts` |
| `prisma/` | PostgreSQL relational persistence model | `schema.prisma`: 877 lines defining 27 models and 11 enums |
| `Requirement_Doc/`| Business rules, PRD, and non-negotiable coding standards | `01_PRD.md`, `02_ARCHITECTURE.md`, `AGENTS.md` |

---

## 3. Discrepancies Between Docs and Implementation

1. **Brand Naming Divergence**:
   - `package.json` names the app `tradeledger-erp` ("TradeLedger ERP").
   - `PRODUCT.md` and `Launch-AutoLedger-ERP.bat` name it `AutoLedger ERP`.
   - `Launch-AutoPulse-ERP.bat` refers to `AutoPulse ERP`.
   - *Recommendation*: Standardize public brand as **AutoLedger ERP** and package name as `tradeledger-erp`.
2. **Missing Reminder Implementation**:
   - `Requirement_Doc/01_PRD.md` (FR-6) and `05_BUILD_PLAN.md` (M6) specify automated BullMQ reminders at -3, 0, +3, +7 days.
   - `app/reminders` and `app/api/v1/reminders` exist only as empty folders. Reminders are currently shared manually via `https://wa.me/` links from the UI.
3. **Storage Engine Split**:
   - `Requirement_Doc/02_ARCHITECTURE.md` describes a pure PostgreSQL + Prisma database.
   - The actual implementation adds a dual-engine local JSON store (`server/lib/store.ts`) for zero-latency offline operation, which was added to survive local Indian workshop connectivity outages.
