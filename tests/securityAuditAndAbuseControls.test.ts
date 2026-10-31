import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';
import {
  extractClientIp,
  redactSensitiveData,
  formatSafeErrorMessage,
  validateCsrfOrigin,
  HTTP_SECURITY_HEADERS,
} from '@/server/lib/security';
import {
  checkRateLimit,
  classifyPathTier,
  resetMemoryRateLimits,
  TIER_CONFIGS,
} from '@/server/lib/rateLimiter';
import { POST as logout } from '@/app/api/v1/auth/logout/route';

describe('FIX 19 — Complete Security, Privacy, Cyberattack & DDoS Protection Audit', () => {
  beforeEach(() => {
    resetMemoryRateLimits();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetMemoryRateLimits();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. HTTP SECURITY HEADERS & PERMISSIONS POLICY
  // =========================================================================
  describe('1. HTTP Security Headers Verification', () => {
    it('applies complete security headers to standard API responses', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);

      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('permissions-policy')).toContain('camera=()');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    });

    it('applies security headers to frontend page routes as well', async () => {
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);

      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('content-security-policy')).toBeDefined();
    });
  });

  // =========================================================================
  // 2. ANTI-SPOOFING CLIENT IP EXTRACTION
  // =========================================================================
  describe('2. Anti-Spoofing Client IP Extraction', () => {
    it('prioritizes trusted Cloudflare CF-Connecting-IP header', () => {
      const req = {
        headers: new Headers({
          'cf-connecting-ip': '198.51.100.42',
          'x-forwarded-for': '203.0.113.195, 10.0.0.1',
          'x-real-ip': '192.0.2.1',
        }),
      };
      const ip = extractClientIp(req);
      expect(ip).toBe('198.51.100.42');
    });

    it('prioritizes X-Real-IP when CF-Connecting-IP is absent', () => {
      const req = {
        headers: new Headers({
          'x-real-ip': '192.0.2.99',
          'x-forwarded-for': 'attacker.spoofed.ip, 192.0.2.99',
        }),
      };
      const ip = extractClientIp(req);
      expect(ip).toBe('192.0.2.99');
    });

    it('rejects malformed or injected IP strings and falls back safely', () => {
      const req = {
        headers: new Headers({
          'cf-connecting-ip': '<script>alert(1)</script>',
          'x-real-ip': '999.999.999.999',
        }),
      };
      const ip = extractClientIp(req);
      expect(ip).toBe('127.0.0.1');
    });
  });

  // =========================================================================
  // 3. MULTI-TIER RATE LIMITING & ABUSE CONTROLS
  // =========================================================================
  describe('3. Multi-Tier Rate Limiting & Abuse Controls', () => {
    it('classifies endpoints into accurate security tiers', () => {
      expect(classifyPathTier('/api/v1/auth/login')).toBe('AUTH');
      expect(classifyPathTier('/api/v1/auth/email-otp/verify')).toBe('AUTH');
      expect(classifyPathTier('/api/v1/portal/auth/send-otp')).toBe('AUTH');
      expect(classifyPathTier('/api/v1/onboarding/complete')).toBe('AUTH');

      expect(classifyPathTier('/api/v1/backup')).toBe('RESOURCE');
      expect(classifyPathTier('/api/v1/products/bulk-delete')).toBe('RESOURCE');
      expect(classifyPathTier('/api/v1/reports/settlement')).toBe('RESOURCE');

      expect(classifyPathTier('/api/v1/products')).toBe('GENERAL');
      expect(classifyPathTier('/api/v1/invoices')).toBe('GENERAL');
    });

    it('enforces stricter limits on AUTH endpoints and returns HTTP 429 when exceeded', async () => {
      const testIp = '198.51.100.77';
      const maxAuthRequests = TIER_CONFIGS.AUTH.maxRequests;

      // Burn through allowed requests
      for (let i = 0; i < maxAuthRequests; i++) {
        const check = await checkRateLimit(testIp, '/api/v1/auth/login');
        expect(check.allowed).toBe(true);
      }

      // Next request must be blocked
      const blockedCheck = await checkRateLimit(testIp, '/api/v1/auth/login');
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);
      expect(blockedCheck.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('middleware returns HTTP 429 with Retry-After when rate limit is exceeded', async () => {
      const clientIp = '203.0.113.88';
      const maxAuth = TIER_CONFIGS.AUTH.maxRequests;

      for (let i = 0; i < maxAuth; i++) {
        await checkRateLimit(clientIp, '/api/v1/auth/login');
      }

      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        headers: {
          'cf-connecting-ip': clientIp,
          host: 'localhost:3000',
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('retry-after')).toBeDefined();
      expect(res.headers.get('x-ratelimit-remaining')).toBe('0');

      const body = await res.json();
      expect(body.error).toContain('Too many requests');
    });
  });

  // =========================================================================
  // 4. BOUNDED REQUEST SIZES & PAYLOAD CAPS (HTTP 413)
  // =========================================================================
  describe('4. Bounded Request Sizes & Payload Caps', () => {
    it('rejects payloads exceeding 10MB on standard endpoints with HTTP 413', async () => {
      const oversizedBytes = 11 * 1024 * 1024; // 11MB
      const req = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          'content-length': String(oversizedBytes),
          host: 'localhost:3000',
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain('Payload too large');
    });

    it('allows larger payloads up to 50MB for database backup restore', async () => {
      const backupBytes = 25 * 1024 * 1024; // 25MB (within 50MB cap)
      const req = new NextRequest('http://localhost:3000/api/v1/backup', {
        headers: {
          'content-length': String(backupBytes),
          host: 'localhost:3000',
        },
      });

      const res = await middleware(req);
      expect(res.status).not.toBe(413);
    });
  });

  // =========================================================================
  // 5. CSRF & ORIGIN VERIFICATION
  // =========================================================================
  describe('5. CSRF & Origin Verification', () => {
    it('blocks state-modifying requests with hostile cross-origin headers', () => {
      const req = new NextRequest('http://localhost:3000/api/v1/products', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'https://evil-phishing-site.com',
        },
      });

      const check = validateCsrfOrigin(req);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('Cross-origin request rejected');
    });

    it('allows requests matching host origin or authenticated with Bearer tokens', () => {
      const sameOriginReq = new NextRequest('http://localhost:3000/api/v1/products', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });
      expect(validateCsrfOrigin(sameOriginReq).valid).toBe(true);

      const bearerReq = new NextRequest('http://localhost:3000/api/v1/products', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'https://any-external-app.com',
          authorization: 'Bearer valid_jwt_token',
        },
      });
      expect(validateCsrfOrigin(bearerReq).valid).toBe(true);
    });

    it('exempts HMAC-authenticated payment webhooks from browser origin checks', () => {
      const webhookReq = new NextRequest('http://localhost:3000/api/v1/webhooks/razorpay', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'https://api.razorpay.com',
        },
      });
      expect(validateCsrfOrigin(webhookReq).valid).toBe(true);
    });
  });

  // =========================================================================
  // 6. PII & SENSITIVE CREDENTIAL REDACTION
  // =========================================================================
  describe('6. PII & Sensitive Credential Redaction', () => {
    it('deeply redacts passwords, tokens, cookies, and secrets from logged data', () => {
      const sensitiveData = {
        username: 'dealer_admin',
        password: 'PlaintextPassword123!',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          authorization: 'Bearer secret_value',
          cookieHeader: 'auth_token=super_secret_cookie',
          normalField: 'Public Store Name',
        },
      };

      const redacted = redactSensitiveData(sensitiveData);
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.jwtToken).toBe('[REDACTED]');
      expect(redacted.nested.authorization).toBe('[REDACTED]');
      expect(redacted.nested.cookieHeader).toBe('[REDACTED]');
      expect(redacted.nested.normalField).toBe('Public Store Name');
    });

    it('sanitizes internal SQL and Prisma database errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      const leakyError = new Error(
        'Invalid `prisma.customer.findMany()` invocation: SELECT "id", "name" FROM "Customer" WHERE syntax error at or near'
      );
      const safeMsg = formatSafeErrorMessage(leakyError);

      expect(safeMsg).not.toContain('prisma');
      expect(safeMsg).not.toContain('SELECT');
      expect(safeMsg).toBe('An unexpected error occurred. Please try again.');

      (process.env as any).NODE_ENV = originalEnv;
    });
  });

  // =========================================================================
  // 7. SECURE LOGOUT & COOKIE EXPIRATION
  // =========================================================================
  describe('7. Secure Logout & Cookie Flags', () => {
    it('sets maxAge: 0 and epoch expiration on both staff and customer cookies', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/logout', { method: 'POST' });
      const res = await logout(req);

      expect(res.status).toBe(200);

      const staffCookie = res.cookies.get('auth_token');
      expect(staffCookie?.maxAge).toBe(0);

      const customerCookie = res.cookies.get('autoledger_customer_token');
      expect(customerCookie?.maxAge).toBe(0);
    });
  });
});
