# 08. Offline Storage & Cloud Synchronization Audit

## 1. Dual-Engine Architecture Rationale

Indian automotive wholesale markets are notorious for connectivity dropouts:
- Wholesalers often operate out of underground basements or dense urban gallis where cellular and broadband signals drop.
- Counter queues cannot wait 15 seconds for a serverless PostgreSQL database to wake up from cold sleep.
- Counter staff must be able to scan parts, print receipts, and release customers within seconds without depending on the internet.

To solve this, AutoLedger ERP implements an **automatic dual-engine persistence layer**:
1. **Primary Cloud Engine**: Managed PostgreSQL with Prisma ORM.
2. **Local Counter Engine**: High-performance atomic JSON store (`server/lib/store.ts`) operating directly on `.data/db_store.json`.

---

## 2. Fallback Mechanism & Health Check

In `server/lib/prisma.ts:28-76`, the system exposes `isPostgresAvailable()`:
- Executes `SELECT 1` with a strict **2,500ms timeout**.
- Caches positive health check results for **60 seconds** to avoid overhead on every counter keystroke.
- If the connection times out, it triggers a background reconnect attempt and immediately falls back to `localStore` without blocking the HTTP request.

---

## 3. Local Persistence Mechanics (`server/lib/store.ts`)

- **File Location**: `.data/db_store.json` (~12 MB in current workspace).
- **Atomic File Writing**: Writes are performed using synchronous file operations or atomic temp-file rename swaps (`fs.writeFileSync`) to prevent corrupted JSON writes if power is cut during counter operations.
- **Data Entities Cached Locally**:
  - `tenants`
  - `users`
  - `products` (full parts catalog with part numbers, prices, stock, and bike compatibility)
  - `customers` (full debtor ledger balances, terms, credit limits)
  - `invoices` (counter bills issued)
  - `payments` (cash and UPI receipts)
  - `ledgerEntries` (double-entry customer Khata timeline)
  - `cashSettlements` (daily Z-report drawer records)

---

## 4. Cloud Synchronization Implementation (`server/lib/cloudSync.ts`)

### What is Currently Synchronized
`queueCloudSync(tenantId, items, userId)` takes bulk-imported product items from Excel/Tally, places them into `syncQueue`, and periodically drains the queue into PostgreSQL in 250-item chunks using `prisma.product.createMany` and `prisma.stockMovement.createMany`.

### What is Missing (Critical Architectural Gap)
1. **In-Memory Volatile Queue**:
   - `syncQueue` in `server/lib/cloudSync.ts:30` is declared as:
     `let syncQueue: Array<...> = [];`
   - If the server crashes or the terminal is closed while items are queued, they are lost from memory and never reach PostgreSQL.
2. **Asymmetric Invoicing Sync**:
   - **Offline Invoices & Payments are NOT synced to PostgreSQL**: When an invoice is created while PostgreSQL is down, it is written to `.data/db_store.json`. There is currently **no reverse sync job** that scans `db_store.json` for new offline invoices/payments and replays them into PostgreSQL when the connection recovers!
   - *Consequence*: Cloud database and local desktop database can diverge over time if transactions take place during an outage.
3. **ID Format Incompatibility**:
   - PostgreSQL requires valid UUIDs (`uuid()`) for PKs and FKs.
   - `localStore` creates string IDs such as `cust-171400293` or `inv-8492`.
   - When synchronizing local records to PostgreSQL, foreign keys fail UUID validation unless converted or mapped.

---

## 5. Offline Sync Risk Matrix

| Risk Factor | Current Behavior | Consequence | Required Remediation |
|---|---|---|---|
| **Process Crash During Sync** | Queue in memory (`syncQueue = []`) | Unsynced catalog imports lost | Persist sync queue to SQLite or disk-backed BullMQ |
| **Offline Counter Invoices** | Saved only to `localStore` | Cloud ledger unaware of offline sales | Implement bi-directional sync worker that pushes offline bills to Postgres |
| **Concurrent Terminal Conflicts** | Multiple counters write to separate `.data` files | Independent balances, no cross-terminal lock | Centralize on local LAN server or use operational transform / CRDT syncing |
| **Numbering Clashes** | Random number generation | Potential invoice number collision | Pre-allocate sequential ranges to terminals (e.g. Counter 1: INV-01-xxxx, Counter 2: INV-02-xxxx) |
