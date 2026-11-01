# TradeLedger ERP — Comprehensive Release Plan

**Project:** TradeLedger ERP (AutoLedger)  
**Hosting Environment:** Vercel (Production)  
**Database Infrastructure:** Neon PostgreSQL (Serverless)  
**Local Workspace:** `d:\CODING\My Projects\B2B_Platform`  
**Current Branch:** `main`  
**Status:** In Development & Release Preparation (Local Only)  

---

## 1. Operating Rules & Guardrails

1. **Local Isolation Guarantee:** All changes, builds, and test runs are executed strictly inside the local repository.
2. **Zero Unauthorized Production Side-Effects:**
   - ❌ No `git push` to origin
   - ❌ No deployment triggers to Vercel (CLI or GitHub Webhook)
   - ❌ No production environment variable alterations
   - ❌ No DNS or domain modifications
   - ❌ No live database migrations against production Neon instances
3. **Migration Integrity:** Every schema change must be backed by a committed, versioned Prisma migration (`prisma/migrations/**`). `prisma db push` is forbidden as a release mechanism.
4. **Separation of Concerns:** Code changes implemented locally are explicitly isolated from infrastructure changes that require manual post-approval execution.

---

## 2. Release Phases & Work Breakdown Structure

```
+-------------------------------------------------------------------------------+
| PHASE 1: LOCAL CODE AUDIT & QUALITY HARDENING                                 |
| - Verify TypeScript (tsc --noEmit)                                            |
| - Execute Vitest full suite (financial integrity, idempotency, RBAC, DR)      |
| - Run ESLint / Code style audit                                               |
| - Inspect secrets & .env exposure                                             |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 2: LOCAL PRODUCTION BUILD & SCHEMA VALIDATION                           |
| - Validate Prisma schema (npx prisma validate)                                |
| - Verify committed Prisma migrations (migration_lock.toml & SQL files)        |
| - Validate Next.js production build (npm run build / next build)              |
| - Confirm offline fallback store synchronization (store.ts)                   |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 3: INFRASTRUCTURE & ENVIRONMENT CHANGE SPECIFICATION                    |
| - Catalog required Vercel environment variables                               |
| - Detail Neon connection string requirements (pooled vs direct)               |
| - Map third-party credentials (Razorpay, Firebase, Storage, etc.)             |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 4: SAFE GIT PUSH & MERGE CHECKLIST (STAGED FOR USER AUTHORIZATION)      |
| - Clean staging branch creation                                               |
| - Atomic, clean commits (excluding temporary audit artifacts)                 |
| - Verification before origin push                                             |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 5: PRODUCTION DEPLOYMENT & NEON MIGRATION RUNBOOK                       |
| - Step 0: Neon backup & snapshot creation                                     |
| - Step 1: Pre-flight compatibility checks                                     |
| - Step 2: Apply Prisma migrations (prisma migrate deploy)                     |
| - Step 3: Trigger Vercel deployment with manual approval                      |
| - Step 4: Post-deployment smoke & health verification                         |
| - Step 5: Rollback plan & recovery procedures                                 |
+-------------------------------------------------------------------------------+
```

---

## 3. Pre-Release Verification Gates

| Gate # | Check Description | Tool / Command | Required Standard | Status |
|:---:|:---|:---|:---|:---:|
| **G1** | Clean Dependencies | `npm ci` / `pnpm install` | Clean install with locked dependencies |  Verified |
| **G2** | Static Type Check | `npx tsc --noEmit` | 0 errors |  Passed (0 errors) |
| **G3** | Linter Audit | `npm run lint` | 0 blocking errors |  Passed |
| **G4** | Unit & Integration Tests | `npm test` (`vitest run`) | 100% pass rate across all suites |  Passed (24/24 suites, 252 tests) |
| **G5** | Prisma Schema Integrity | `npx prisma validate` | Schema valid & formats aligned |  Passed (Valid schema) |
| **G6** | Migration Status | `npx prisma migrate status` | All migrations accounted for locally | Pending |
| **G7** | Next.js Production Build | `npm run build` | All static & dynamic routes compile clean |  Passed (42 routes) |
| **G8** | Secrets & Credentials Scan | Pattern grep / audit | No API keys, passwords, or tokens in codebase | Pending |

---

## 4. Distinction Matrix: Code Changes vs. Infrastructure Tasks

### A. Local Code Changes (Completed / In-Repo)
- [ ] Durable Idempotency on Invoices & Payments (`Idempotency-Key` headers & middleware)
- [ ] Non-GST / Composite "Sales Bill" compliance (Kacha bill format neutral terminology)
- [ ] Gapless Sequential Invoice Numbering engine with transactional row locks
- [ ] Strict Role-Based Access Control (RBAC) on invoice cancellation / deletion (`OWNER` / `MANAGER` guards)
- [ ] Mandatory Razorpay webhook secret signature verification & deduplication
- [ ] Offline local JSON fallback (`db_store.json` + `store.ts`) transactional sync
- [ ] Healthcheck endpoints (`/api/health` and `/api/v1/health`)
- [ ] Disaster recovery backup & restore scripts (`scripts/backup-db.ps1`, `scripts/backup-db.sh`)

### B. Manual Infrastructure Actions (Deferred Until User Authorization)
- [ ] **Neon PostgreSQL**:
  - Create manual branch / snapshot backup of production database prior to migration.
  - Verify pooled connection string (`DATABASE_URL`) vs direct connection string (`DIRECT_URL`) for migration execution.
  - Execute `npx prisma migrate deploy` using `DIRECT_URL`.
- [ ] **Vercel Project Settings**:
  - Add/Verify required environment variables (`JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `APP_ENV=production`).
  - Configure production domain / custom DNS if required.
- [ ] **GitHub Repository**:
  - Push tested release branch to `origin`.
  - Open and merge Pull Request to `main`.

---

## 5. Safe Git Branch & Push Checklist

> **Note:** DO NOT execute until explicitly authorized by the user.

```bash
# 1. Verify working tree status
git status

# 2. Create and switch to a dedicated release preparation branch
git checkout -b release/v1.1.0-hardening

# 3. Stage verified source code and migrations (excluding temporary zips/test dumps)
git add .
git reset TradeLedger_Project_Audit.zip

# 4. Commit with descriptive, atomic message
git commit -m "feat(release): v1.1.0 production readiness - migrations, idempotency, RBAC, DR, and test suite"

# 5. [AWAIT EXPLICIT USER AUTHORIZATION]
# Once authorized:
# git push -u origin release/v1.1.0-hardening
```

---

## 6. Production Vercel & Neon Deployment Sequence

### Pre-Deployment (Neon Database)
1. **Database Snapshot:** In Neon Console, create a branch or snapshot: `prod-backup-before-v1.1.0`.
2. **Migration Run:** Run migration using the unpooled direct connection string:
   ```bash
   npx prisma migrate deploy
   ```
3. **Verify Migration Status:**
   ```bash
   npx prisma migrate status
   ```

### Vercel Deployment
1. Verify Environment Variables in Vercel Project Dashboard.
2. Trigger production deployment via GitHub PR merge or Vercel CLI with manual confirmation.
3. Inspect build logs for zero warnings/failures.

### Post-Deployment Verification (Smoke Tests)
- [ ] Ping `https://<domain>/api/health` -> HTTP 200 `{"status":"ok"}`
- [ ] Test counter login with existing credentials.
- [ ] Generate a draft bill & verify tax / total rounding calculations.
- [ ] Confirm customer Khata balance matches previous ledger.
- [ ] Verify Razorpay webhook health endpoint.

### Rollback Plan
- **Database Rollback:** If migration fails, restore Neon to the pre-deployment snapshot branch.
- **Application Rollback:** In Vercel Deployment Dashboard, click "Instant Rollback" to the previous successful production deployment.

