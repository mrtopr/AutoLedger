# TradeLedger ERP — Operational SRE Runbook

**Classification:** Standard Operating Procedure (SOP) / Incident Response  
**Version:** 1.1.0  
**Target Systems:** Next.js, Node.js, PostgreSQL (Prisma), Redis, Cloudflare / AWS WAF, Electron Desktop

---

## 1. Production Outage (HTTP 502 / 504 / Service Unavailable)

### Detection Signals
- External monitoring / uptime probe alerts (e.g. UptimeRobot, BetterUptime) reporting down.
- `/api/health` returns non-200 or times out.
- High volume of 502 Bad Gateway / 504 Gateway Timeout in reverse proxy logs.

### First Responder Action
1. **Check Application Process Status:**
   ```bash
   # If running in Docker / Container:
   docker ps | grep tradeledger
   docker logs --tail 100 tradeledger_app

   # If running via systemd / PM2:
   pm2 status
   pm2 logs --lines 100
   ```
2. **Check System Resource Saturation:**
   ```bash
   # Check memory & CPU pressure
   free -m
   top -b -n 1 | head -n 20
   ```
3. **Inspect Application Health Endpoint:**
   ```bash
   curl -i http://localhost:3000/api/health
   ```
4. **Immediate Safe Mitigation:**
   - If Node.js process crashed due to unhandled OOM, restart process:
     ```bash
     pm2 restart tradeledger-erp
     ```
   - If database is saturated, follow Runbook 3 (Database Outage).
   - If traffic spike, follow Runbook 2 (Cyberattack / DDoS).

---

## 2. Suspected Cyberattack or DDoS Event

### Detection Signals
- Sudden 10x-100x spike in inbound HTTP request volume.
- Elevated 429 Too Many Requests or 403 Forbidden responses.
- CPU pegged at 100% on edge proxy or web server.

### First Responder Action
1. **Activate Cloudflare "Under Attack Mode":**
   - Cloudflare Dashboard -> **Security > Settings > Security Level > I'm Under Attack!**
   - Challenges all incoming requests with an automated JavaScript verification challenge.
2. **Inspect Top Abusive IPs & Paths:**
   ```bash
   # Top 20 requesting IP addresses
   tail -n 10000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -n 20

   # Top 20 requested URIs
   tail -n 10000 /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head -n 20
   ```
3. **Enforce Stricter Rate Limiting:**
   Update environment variables to tighten application limits temporarily:
   ```bash
   export RATE_LIMIT_AUTH_MAX=5
   export RATE_LIMIT_GENERAL_MAX=30
   ```
4. **Block Abusive CIDR Blocks at Edge WAF:**
   In Cloudflare or AWS WAF, create an IP Block rule targeting the attacking autonomous systems (ASNs) or subnets.

---

## 3. Database Outage, Pool Saturation or Lock Contention

### Detection Signals
- `/api/health` returns `HTTP 503` with `database: { status: "disconnected" }`.
- Application logs show `PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool`.
- Counter users notice a fallback to offline local store.

### First Responder Action
1. **Inspect Active Database Connections:**
   ```sql
   -- Connect via psql to PostgreSQL instance
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
2. **Identify Long-Running or Blocking Queries:**
   ```sql
   SELECT pid, now() - query_start AS duration, query, state 
   FROM pg_stat_activity 
   WHERE state != 'idle' 
   ORDER BY duration DESC LIMIT 10;
   ```
3. **Terminate Rogue / Stalled Queries:**
   ```sql
   -- Terminate queries running longer than 60 seconds
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state != 'idle' 
     AND now() - query_start > interval '60 seconds'
     AND pid != pg_backend_pid();
   ```
4. **Scale PgBouncer / Connection Pool:**
   Ensure `DATABASE_URL` connects via PgBouncer connection pooler (e.g. Neon connection pooling endpoint on port 6543 / `host-pooler`).
5. **Data Synchronization Post-Recovery:**
   Once PostgreSQL is restored, synchronize offline counter records:
   ```bash
   node scripts/sync-all-to-db.js
   ```

---

## 4. Failed Deployment & Immediate Rollback

### Detection Signals
- High 500 error rate immediately following a release.
- Next.js build errors or broken API contracts on `/pos` or `/invoices`.

### First Responder Action
1. **Immediate Traffic Rollback:**
   - **Vercel / Cloud:** Promote previous production deployment to active in 1 click (**Deployments > Previous > Promote to Production**).
   - **Docker / Kubernetes:**
     ```bash
     # Rollback to previous container image tag
     docker-compose down
     docker tag tradeledger:previous tradeledger:latest
     docker-compose up -d
     ```
2. **Database Migration Safety:**
   - TradeLedger follows **expand-contract** migration discipline: migrations never drop active columns or tables before code is retired.
   - If a migration failed mid-run, check migration status:
     ```bash
     npx prisma migrate status
     ```
   - Rollback any uncommitted partial migration manually or resolve using `prisma migrate resolve`.

---

## 5. Compromised Secrets / Security Breach

### Detection Signals
- Security alert from GitHub Secret Scanning or git commit audit.
- Unexplained admin user creation or unauthorized backup exports in `audit_log`.

### First Responder Action
1. **Enable Maintenance Mode Immediately:**
   ```bash
   export MAINTENANCE_MODE=true
   ```
2. **Invalidate All Active Sessions (Token Revocation):**
   ```bash
   # Generate new JWT secret
   export JWT_SECRET=$(openssl rand -hex 32)
   # Restart application process to force all existing cookies to fail verification
   ```
3. **Rotate Database Password:**
   Update database credentials in cloud console and update `DATABASE_URL`.
4. **Audit Data Integrity:**
   Query `audit_log` table for all mutations during the incident window.

---

## 6. Payment Gateway or Webhook Delivery Failure

### Detection Signals
- Online Razorpay payments cleared by customers but not marked `PAID` in TradeLedger POS.
- Webhook route `/api/v1/webhooks/razorpay` returning 400 or 500.

### First Responder Action
1. **Check Webhook Signature Secret:**
   - Verify `RAZORPAY_WEBHOOK_SECRET` matches the secret in Razorpay Dashboard -> **Settings > Webhooks**.
2. **Check Webhook Logs in Razorpay Dashboard:**
   - In Razorpay Dashboard, inspect **Webhooks > View Delivery Attempts**.
   - Check response payload:
     - `400 Invalid webhook signature`: secret mismatch or proxy body alteration.
     - `200 duplicate: true`: payment was already safely deduplicated by TradeLedger constraint.
3. **Manual Re-Delivery:**
   Click **Retry** in Razorpay Dashboard. TradeLedger's unique database constraint on `gatewayRef` ensures re-deliveries are safe and idempotent.
4. **Emergency POS Fallback:**
   Counter staff can initiate instant UPI dynamic QR codes on POS screen (`upi://pay?pa=...`), which remain fully functional without gateway connectivity.

---

## 7. Storage Outage & File Recovery

### Detection Signals
- PDF bill exports or local store snapshots fail to write to disk.
- Disk full alert (`df -h` shows > 95% utilization).

### First Responder Action
1. **Check Disk Space:**
   ```bash
   df -h /
   ```
2. **Purge Old Backups & System Logs:**
   ```bash
   # Clean up backups older than 30 days
   find ./backups -type f -mtime +30 -delete
   # Vacuum journalctl logs
   journalctl --vacuum-time=3d
   ```
3. **Verify LocalStore Permissions:**
   Ensure the application process has write permissions to `./.data/` directory:
   ```bash
   chmod -R 750 ./.data
   ```
