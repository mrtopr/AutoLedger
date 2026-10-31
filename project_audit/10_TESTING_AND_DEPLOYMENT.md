# 10. Testing, Quality Assurance & Deployment Guide

## 1. Automated Verification Results (Run During Audit)

All checks were executed in the project workspace on Windows:

| Verification Step | Command Executed | Result | Duration / Details |
|---|---|---|---|
| **Unit Test Suite** | `npm test` (Vitest v2.1.9) | **14 PASSED / 0 FAILED** | 30.26s total runtime<br>- `app/lib/tallySearch.test.ts` (6 tests passed)<br>- `server/lib/allocation.test.ts` (3 tests passed)<br>- `app/lib/tallyParser.test.ts` (5 tests passed) |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **0 ERRORS** | Clean compilation across all routes, components, and libraries. |
| **Prisma Schema Validation**| `npx prisma validate` | **VALID** | `The schema at prisma\schema.prisma is valid 🚀` |
| **Linter Configuration** | `npm run lint` | **UNCONFIGURED** | Prompts for interactive `.eslintrc` initialization because no `.eslintrc.json` file is committed to the repository root. |

---

## 2. Missing Test Coverage & QA Blind Spots

While existing tests cover the parser, search, and allocation algorithms, critical financial and security pathways lack automated tests:

1. **Tax Calculation & Rounding (`server/lib/tax.ts`)**:
   - No dedicated unit test verifying CGST/SGST 50-50 splits vs IGST 100% split.
   - Missing tests for odd-paise roundoffs (e.g. 33 paise GST rounding up or down).
2. **API Route RBAC Enforcement**:
   - No integration test asserting that `COUNTER_STAFF` receives `403 Forbidden` on invoice cancellation.
3. **Razorpay Webhook Signature Verification**:
   - Missing unit tests asserting that tampered signatures are rejected.
4. **Z-Report Discrepancy Math**:
   - Missing tests for cash drawer shortages and denomination arithmetic.

---

## 3. Environment Variables Reference

Create a `.env` file in the root based on `.env.example`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/autoledger?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/autoledger"

# Security & Authentication
JWT_SECRET="generate-a-cryptographically-secure-64-char-secret"
COOKIE_SECURE="true" # Set to false only for local HTTP development

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxxxxxx"

# Messaging Providers (Phase 2/3)
WHATSAPP_API_KEY=""
MSG91_AUTH_KEY=""
MSG91_SENDER_ID=""

# Application Host
PORT=3000
APP_URL="http://localhost:3000"
```

---

## 4. How to Run Locally

### Development Server:
```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Start Next.js Development Server
npm run dev
# App will run at http://localhost:3000
```

### Desktop Mode (Electron):
```bash
# Double click Launch-AutoLedger-ERP.bat
# Or run from terminal:
npm run electron:dev
```

### Building Desktop Installer:
```bash
# Builds Windows NSIS installer and portable executable into /dist
npm run electron:build
```
