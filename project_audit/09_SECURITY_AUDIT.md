# 09. Security & Access Control Audit

This audit evaluates the codebase against modern application security standards, OWASP Top 10, multi-tenant isolation, and RBAC governance.

---

## 1. Vulnerability Findings by Severity

### [RESOLVED] 1. Razorpay Webhook Signature Verification Bypass & Missing Idempotency
- **Affected File**: `app/api/v1/webhooks/razorpay/route.ts` & `server/lib/razorpay.ts`
- **Resolution Status**: **FIXED & VERIFIED** (Covered by 16 automated Vitest tests in `tests/razorpayWebhook.test.ts`).
- **Implemented Fix**:
  1. `RAZORPAY_WEBHOOK_SECRET` is now strictly mandatory; missing secret returns HTTP 500, missing `x-razorpay-signature` returns HTTP 400.
  2. Timing-safe comparison using `crypto.timingSafeEqual` with length checks and raw request body reading.
  3. ACID database transactions via `prisma.$transaction` with unique constraint enforcement on `Payment.gatewayRef` (`@unique`).
  4. Deduplication upfront: if `gatewayRef` exists, returns HTTP 200 with `{ duplicate: true }` without touching ledger.
  5. Concurrent race condition handling: catches Prisma `P2002` error gracefully.
  6. Single-process localStore deduplication implemented for offline fallback mode.

---

### [HIGH] 2. Missing Role Authorization on Invoice Cancellation / Deletion
- **Affected File**: `app/api/v1/invoices/route.ts:461-571` (`DELETE` method)
- **Vulnerability**: The endpoint retrieves `authUser = await getAuthenticatedUser(req);` but never checks `authUser.role`.
- **Exploitation / Impact**: Any authenticated user with the `COUNTER_STAFF` role (or any valid JWT) can issue a `DELETE /api/v1/invoices?id=...` request to cancel high-value invoices and erase customer debt. The PRD explicitly forbids `COUNTER_STAFF` from cancelling invoices.
- **Remediation**:
  Add an explicit role check at the top of the `DELETE` handler:
  ```ts
  if (!authUser || (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Forbidden: Only owners and managers can cancel invoices' }, { status: 403 });
  }
  ```

---

### [HIGH] 3. Tenant Impersonation via Fallback Default
- **Affected Files**: `app/api/v1/customers/route.ts:154`, `app/api/v1/invoices/route.ts:141`, `app/api/v1/reports/settlement/route.ts:10`
- **Vulnerability**:
  ```ts
  const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-honda-1';
  ```
- **Exploitation / Impact**: If an unauthenticated request reaches the route handler, the code does not return `401 Unauthorized`. Instead, it silently defaults to the first tenant in the database or `'tenant-honda-1'`, allowing unauthenticated requests to read and write records in that tenant's workspace.
- **Remediation**: Enforce strict authentication guards at the start of all protected route handlers:
  ```ts
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const targetTenantId = authUser.tenantId;
  ```

---

### [MEDIUM] 4. Insecure Default JWT Secret
- **Affected File**: `server/lib/auth.ts:7`
- **Vulnerability**:
  ```ts
  const JWT_SECRET = process.env.JWT_SECRET || 'b2b-khata-jwt-super-secret-key-2026';
  ```
- **Impact**: If deployed to staging or production without explicitly setting `JWT_SECRET` in `.env`, attackers can forge admin JWTs using the hardcoded secret.
- **Remediation**: Throw an error on startup in production if `process.env.JWT_SECRET` is undefined.

---

### [LOW] 5. In-Memory Edge Rate Limiter Subject to Cold Starts
- **Affected File**: `middleware.ts:4-9`
- **Vulnerability**: Uses a local `Map<string, { count, timestamp }>()` inside edge middleware.
- **Impact**: Serverless cold starts or multi-instance deployments reset the rate limit counter, allowing attackers to exceed 100 requests per minute by hitting different edge nodes.
- **Remediation**: Back the rate limiter with Redis (`ioredis` is already in `package.json`).

---

## 2. Electron Security Review

- **Context Isolation**: `contextIsolation: true` (**Compliant**)
- **Node Integration**: `nodeIntegration: false` (**Compliant**)
- **Preload Script**: Uses `contextBridge.exposeInMainWorld('electronAPI', ...)` to expose only `platform` and `printCurrentPage` (**Compliant**)
- **Navigation Lock**: In `electron/main.js`, add `webContents.on('will-navigate', (e, url) => ...)` to ensure the Electron window cannot be redirected to malicious external phishing URLs.
