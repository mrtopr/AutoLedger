# TradeLedger ERP — Disaster Recovery & Business Continuity Plan

**System:** TradeLedger ERP (Universal B2B Wholesale, Billing & Khata Ledger)  
**Document Version:** 1.1.0  
**Target Environment:** Production (PostgreSQL 16, Prisma ORM, Redis, LocalStore Fallback, Next.js 14)  
**Classification:** Enterprise SRE / Disaster Recovery Standard

---

## 1. Disaster Recovery Objectives (RPO & RTO)

> [!IMPORTANT]
> **RPO and RTO are defined based on actual infrastructure capabilities. Zero downtime and zero data loss cannot be claimed without distributed multi-region active-active databases.**

| Tier / Component | Recovery Point Objective (RPO) | Recovery Time Objective (RTO) | Recovery Mechanism |
| :--- | :--- | :--- | :--- |
| **Local Offline Fallback** | **RPO = 0 seconds** (Real-time local state) | **RTO < 30 seconds** (Automatic failover) | Transparent automatic fallback to `localStore` if PostgreSQL connection is interrupted. |
| **Cloud PostgreSQL (Neon / RDS)** | **RPO <= 1 hour** (Hourly WAL streaming) | **RTO <= 30 minutes** (Cold standby restore) | Automated point-in-time recovery (PITR) or dump restore into standby cluster. |
| **Local Automated Snapshots** | **RPO <= 24 hours** (Daily scheduled backup) | **RTO <= 15 minutes** | Automated pg_dump custom format (`.dump.gz`) restored via `pg_restore`. |
| **Object / File Storage (S3 / R2)** | **RPO <= 24 hours** | **RTO <= 45 minutes** | Cross-region bucket replication or daily sync to secondary cloud storage. |

---

## 2. Disaster Scenarios & Recovery Procedures

### Scenario 1: Accidental Tenant Deletion or Data Corruption
- **Symptoms:** Reports show missing invoice series, missing customer khata balance, or deleted inventory items.
- **Recovery Procedure:**
  1. **Activate Maintenance Mode:**
     ```bash
     export MAINTENANCE_MODE=true
     # Restricts non-admin access while maintaining /api/health probes
     ```
  2. **Identify Target Point in Time:**
     Inspect `audit_log` table in PostgreSQL to identify the exact timestamp `T_CORRUPT` when the accidental deletion occurred:
     ```sql
     SELECT id, user_id, action, entity, entity_id, created_at 
     FROM audit_log 
     WHERE action IN ('TENANT_DELETED', 'BULK_DELETE', 'PURGE') 
     ORDER BY created_at DESC LIMIT 10;
     ```
  3. **Restore to Staging Database First:**
     Never restore directly onto production! Restore the pre-incident snapshot or perform PITR to `T_CORRUPT - 1 minute` on an isolated staging database:
     ```bash
     pg_restore --clean --if-exists --no-owner --no-privileges -d "$STAGING_DATABASE_URL" ./backups/db_backup_latest.dump
     ```
  4. **Verify Financial & Tenant Invariants:**
     Run validation queries in staging:
     ```sql
     -- Verify tenant records exist
     SELECT count(*) FROM "Tenant";
     -- Verify ledger debit-credit reconciliation
     SELECT customer_id, sum(debit - credit) AS balance FROM "LedgerEntry" GROUP BY customer_id;
     ```
  5. **Export Scoped Tenant Snapshot & Re-import:**
     Use TradeLedger's verified tenant-isolated backup endpoint (`/api/v1/backup`) to export the restored tenant data and safely re-import it into production with conflict deduplication.
  6. **Disable Maintenance Mode:**
     ```bash
     export MAINTENANCE_MODE=false
     ```

---

### Scenario 2: Complete Primary Database Outage (Hosting Failure)
- **Symptoms:** Database queries time out, `/api/v1/health` returns `HTTP 503` with `database: { status: "disconnected" }`.
- **Immediate Automatic Mitigation:**
  - TradeLedger's built-in dual-engine architecture automatically switches counter sales to `localStore` mode.
  - Counter staff can continue creating non-GST Sales Bills (`KACHA`) without interruption.
- **Recovery Procedure:**
  1. Provision standby database or failover to read replica.
  2. Update `DATABASE_URL` in environment / container secrets to point to the new database cluster.
  3. Run database migrations to ensure schema consistency:
     ```bash
     npx prisma migrate deploy
     ```
  4. Run the data synchronization script to backfill bills created in localStore during the outage:
     ```bash
     node scripts/sync-all-to-db.js
     ```
  5. Verify health check:
     ```bash
     curl -s http://localhost:3000/api/health | jq .
     # Must return HTTP 200 with database: { status: "connected" }
     ```

---

### Scenario 3: Secret or Credential Compromise
- **Symptoms:** Suspicious token activity, leaked `JWT_SECRET`, or compromised database credentials.
- **Recovery Procedure:**
  1. **Rotate Application JWT Signing Secret:**
     - Generate a cryptographically secure 64-character secret:
       ```bash
       openssl rand -hex 32
       ```
     - Update `JWT_SECRET` in environment variables.
     - Restart Next.js container / server process.
     - **Result:** All existing session tokens and cookies are immediately invalidated. Callers must re-authenticate.
  2. **Rotate Database Password:**
     - Update database password in Neon / AWS RDS console.
     - Update `DATABASE_URL` and `DIRECT_URL`.
     - Restart application.
  3. **Rotate Payment Gateway & Webhook Secrets:**
     - Generate new Webhook Secret in Razorpay Dashboard.
     - Update `RAZORPAY_WEBHOOK_SECRET` in production environment.
     - Verify webhook deliveries at `/api/v1/webhooks/razorpay`.

---

## 3. Automated Backup Verification & Testing Protocol

### Daily Cron Execution
Automated backups are executed daily via [scripts/backup-db.sh](file:///d:/CODING/My%20Projects/B2B_Platform/scripts/backup-db.sh) (Linux) or [scripts/backup-db.ps1](file:///d:/CODING/My%20Projects/B2B_Platform/scripts/backup-db.ps1) (Windows):
- Output directory: `./backups/`
- Format: PostgreSQL Custom Archive (`.dump.gz`)
- Retention: **30 days** (older archives automatically pruned)

### Monthly Restoration Drill (Dry Run)
Every 30 days, the DevOps/SRE team must execute a dry-run restoration drill into an isolated staging database:
```bash
# 1. Download latest archive
LATEST_BACKUP=$(ls -t ./backups/db_backup_*.dump* | head -n1)

# 2. Restore into disposable local/staging test database
createdb tradeledger_dr_test
pg_restore --clean --if-exists -d tradeledger_dr_test "$LATEST_BACKUP"

# 3. Verify record counts
psql tradeledger_dr_test -c "SELECT 'Tenant' AS tbl, count(*) FROM \"Tenant\" UNION ALL SELECT 'Invoice', count(*) FROM \"Invoice\" UNION ALL SELECT 'LedgerEntry', count(*) FROM \"LedgerEntry\";"

# 4. Clean up disposable database
dropdb tradeledger_dr_test
```
