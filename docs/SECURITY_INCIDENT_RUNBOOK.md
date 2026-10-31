# TradeLedger ERP — Cyberattack, DDoS & Security Incident Runbook

**Document Version:** 1.1.0  
**Target Architecture:** Next.js, Node.js, PostgreSQL (Prisma), Redis, Cloudflare / AWS CloudFront / Vercel Edge  
**Classification:** Operational Security Runbook (P1 / P2 Incident Response)

---

## 1. Executive Summary & Defense In Depth Reality

> [!IMPORTANT]
> **Application rate limiting alone does NOT stop volumetric DDoS attacks.**  
> If an attacker floods the network with 10 Gbps+ SYN floods, UDP reflection, or million-request HTTP/2 floods, application servers will exhaust network interface bandwidth or connection sockets before Node.js/Next.js code even executes.
> 
> Real defense requires a strict two-tier architecture:
> 1. **Edge Tier (Cloud Provider / WAF / CDN):** Absorbs volumetric L3/L4 floods, terminates TLS, enforces bot mitigation, and applies geo/IP rate limits.
> 2. **Application Tier (TradeLedger Middleware):** Enforces anti-spoofing client IP extraction, tiered application rate limiting, bounded payload memory caps, CSRF protection, and tenant isolation.

---

## 2. Threat Classification & Detection Matrix

| Incident Type | Symptoms / Indicators | First Responder Action | Layer of Defense |
| :--- | :--- | :--- | :--- |
| **Volumetric DDoS (L3/L4)** | Network interface saturated, 100% packet loss, origin unreachable from outside, host provider alerts. | Activate Cloudflare "Under Attack Mode" or AWS Shield Advanced. | Edge / Network CDN |
| **HTTP Flood / L7 Abuse** | Huge spike in `/api/v1/auth/login`, `/api/v1/backup`, or `/pos`. HTTP 502/504 errors, high CPU load. | Enable Edge WAF managed challenge on matching URI; check rate limit logs. | WAF + App Middleware |
| **Brute Force / Credential Stuffing** | Hundreds of 401s from distributed IPs hitting `/api/v1/auth/login` or `/email-otp`. | Lower Edge Auth rate limit threshold to 10 req/min; enforce CAPTCHA / Turnstile. | App Middleware + WAF |
| **Direct-to-Origin Bypass** | Traffic hitting origin server directly, bypassing CDN/WAF rules and SSL termination. | Restrict Origin firewall (Security Group / iptables) strictly to CDN IP ranges. | Cloud Infrastructure / Firewall |
| **Database Pool Saturation** | `PrismaClientKnownRequestError`, `DB Timeout`, connection pool exhausted, HTTP 503 from `/api/health`. | Inspect active queries, terminate idle connections, scale PgBouncer pool. | PostgreSQL / PgBouncer |
| **Compromised Secrets / Token Leak** | Unauthorized administrative actions, unexplained tenant data mutations in audit log. | Rotate `JWT_SECRET`, revoke all active cookies, rotate database credentials. | IAM & Application Secrets |

---

## 3. Required Cloud Provider Edge / WAF / CDN Configuration

To achieve complete DDoS resilience, configure your DNS and CDN provider according to the following verified specifications:

### A. Cloudflare Configuration (Recommended)
1. **DNS & Proxy Status:**
   - Ensure DNS records for `tradeledger.app` and `api.tradeledger.app` are set to **Proxied (Orange Cloud)**.
   - Never create DNS A records pointing directly to unproxied origin IP addresses.
2. **WAF Custom Rate Limiting Rules:**
   - **Rule 1 (Auth Shield):**
     - Expression: `(http.request.uri.path contains "/api/v1/auth/") or (http.request.uri.path contains "/api/v1/portal/auth/")`
     - Rate: `10 requests per 10 seconds per IP`
     - Action: `Managed Challenge` or `Block (HTTP 429)`
   - **Rule 2 (Backup & Bulk Shield):**
     - Expression: `(http.request.uri.path contains "/api/v1/backup") or (http.request.uri.path contains "/bulk-")`
     - Rate: `15 requests per 1 minute per IP`
     - Action: `Managed Challenge`
   - **Rule 3 (General API Guard):**
     - Expression: `http.request.uri.path starts_with "/api/"`
     - Rate: `120 requests per 1 minute per IP`
     - Action: `Managed Challenge`
3. **Under Attack Mode Activation:**
   - In Cloudflare Dashboard: **Security > Settings > Security Level > I'm Under Attack!**
   - Instantly forces a JavaScript challenge on all incoming HTTP requests before reaching your origin.
4. **Origin Lockdown (Prevent Direct-to-Origin Bypasses):**
   - Configure AWS Security Group / Nginx to accept incoming traffic **only** from Cloudflare's published IP ranges: [https://www.cloudflare.com/ips/](https://www.cloudflare.com/ips/).
   - Alternatively, configure an **Authenticated Origin Pull (AOP)** with custom TLS certificates.

### B. AWS CloudFront + AWS WAF Configuration
1. **AWS WAF WebACL:**
   - Attach a Rate-based rule: limit 300 requests per 5-minute evaluation window per IP.
   - Enable `AWSManagedRulesCommonRuleSet` and `AWSManagedRulesKnownBadInputsRuleSet`.
2. **Origin Shield:**
   - Configure CloudFront Origin Request Header: inject secret header `X-Origin-Verify: <secret_guid>`.
   - On the origin Next.js/Nginx proxy, reject any request lacking this header with HTTP 403.

---

## 4. Emergency Incident Response Procedures

### Step 1: Rapid Triage & Traffic Analysis
Run the following inspection commands to identify traffic patterns:

```bash
# Check running application process status
curl -i http://localhost:3000/api/health

# Inspect top IP addresses in reverse proxy access logs (Nginx)
tail -n 10000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -n 20

# Inspect top requested endpoints
tail -n 10000 /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head -n 20
```

### Step 2: Database Pool Relief
If the database connection pool is saturated:

```sql
-- Connect to PostgreSQL via psql
-- Inspect active connections and long-running queries
SELECT pid, usename, client_addr, state, query_start, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start ASC;

-- Terminate rogue or hanging queries exceeding 30 seconds
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND query_start < NOW() - INTERVAL '30 seconds'
  AND pid != pg_backend_pid();
```

### Step 3: Temporary Emergency Mitigation
1. **Activate Cloud WAF Challenge:**
   - Turn on Cloudflare "Under Attack Mode" or AWS WAF Rate-based Block.
2. **Enable Stricter In-Memory Rate Limiting via Environment:**
   ```bash
   # Temporarily tighten application rate limits without code deploy
   RATE_LIMIT_AUTH_MAX=5
   RATE_LIMIT_AUTH_WINDOW_SEC=60
   RATE_LIMIT_GENERAL_MAX=60
   ```
3. **Block Abusive Subnets / Autonomous Systems:**
   - In Cloudflare: **Security > WAF > IP Access Rules** -> Add CIDR block with Action `Block`.

### Step 4: Evidence Preservation (Forensics)
Before restarting containers or rotating logs:
1. Copy current application and proxy access logs to cold storage:
   ```bash
   cp /var/log/nginx/access.log /var/log/nginx/incident_$(date +%F_%H%M).log
   ```
2. Export recent audit trail entries from TradeLedger ERP:
   ```bash
   # Audit logs are stored in PostgreSQL table "audit_log" with immutable timestamps
   psql $DATABASE_URL -c "COPY (SELECT * FROM audit_log WHERE created_at > NOW() - INTERVAL '2 hours') TO STDOUT CSV HEADER;" > incident_audit_log.csv
   ```

### Step 5: Service Restoration & Post-Incident Verification
1. Verify `/api/health` returns `HTTP 200` with `status: "healthy"` and `database: { status: "connected" }`.
2. Verify normal POS billing workflow (`/pos`) creates invoices cleanly without timeout.
3. Conduct post-mortem review: calculate total downtime, review peak request rates, update permanent WAF rate rules, and rotate any exposed operational credentials.
