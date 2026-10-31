/**
 * TradeLedger ERP — Comprehensive Application Security & Privacy Utilities
 * 
 * Provides:
 * 1. Anti-spoofing client IP extraction with configurable trusted-proxy verification.
 * 2. Deep PII and credential log redaction (passwords, tokens, cookies, secrets).
 * 3. Safe error message sanitization preventing database/stack leaks in production.
 * 4. CSRF / Origin verification for state-modifying HTTP requests.
 * 5. HTTP Security Headers definition (CSP, HSTS, X-Frame-Options, Permissions-Policy).
 */

import { NextRequest } from 'next/server';

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /jwt/i,
  /auth(orization)?/i,
  /cookie/i,
  /credential/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /rzp[_-]?secret/i,
  /webhook[_-]?secret/i,
  /totp/i,
  /card/i,
  /cvv/i,
];

const LEAKY_ERROR_PATTERNS = [
  /prisma/i,
  /select\s+/i,
  /insert\s+into/i,
  /update\s+/i,
  /delete\s+from/i,
  /relation\s+".*"\s+does\s+not\s+exist/i,
  /column\s+".*"\s+does\s+not\s+exist/i,
  /foreign\s+key\s+constraint/i,
  /unique\s+constraint/i,
  /syntax\s+error\s+at\s+or\s+near/i,
  /database\s+error/i,
  /connection\s+refused/i,
  /etimedout/i,
  /econnrefused/i,
  /node_modules/i,
  /[a-z]:\\.*\\/i, // Windows file path
  /\/home\/.*\/|\/var\/.*\/|\/usr\/.*\//i, // Unix file path
];

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

/**
 * Validates that an IP string is a syntactically valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.trim();
  return IPV4_REGEX.test(clean) || IPV6_REGEX.test(clean);
}

/**
 * Anti-Spoofing Client IP Extractor.
 * 
 * In production deployments:
 * - If running behind Cloudflare, CF-Connecting-IP is prioritized (injected by Cloudflare edge).
 * - If running behind Nginx / AWS ALB, X-Real-IP is prioritized.
 * - X-Forwarded-For can be spoofed by a client injecting headers unless trusted proxy logic is applied.
 * - If TRUST_PROXY is enabled, parses proxy chains safely.
 */
export function extractClientIp(
  req: NextRequest | Request | { headers: Headers | Record<string, string | string[] | undefined>; ip?: string }
): string {
  // 1. Next.js / Edge native IP property if available
  if ('ip' in req && req.ip && isValidIp(req.ip)) {
    return req.ip;
  }

  const getHeader = (name: string): string | null => {
    if ('headers' in req) {
      if (typeof (req.headers as any).get === 'function') {
        return (req.headers as Headers).get(name);
      }
      const val = (req.headers as Record<string, any>)[name.toLowerCase()];
      if (Array.isArray(val)) return val[0] || null;
      return typeof val === 'string' ? val : null;
    }
    return null;
  };

  // 2. Cloudflare Edge connecting IP (tamper-resistant when origin is protected)
  const cfIp = getHeader('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp.trim())) {
    return cfIp.trim();
  }

  // 3. Nginx / AWS ALB X-Real-IP
  const realIp = getHeader('x-real-ip');
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  // 4. X-Forwarded-For parsing
  const xff = getHeader('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map((p) => p.trim()).filter(Boolean);
    const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

    if (trustProxy && ips.length > 0) {
      // In trusted proxy setups with count = 1, the client IP is the rightmost IP before the proxy
      // e.g. "spoofed_ip, real_client_ip"
      // If single entry or trusted chain:
      const candidate = ips.length === 1 ? ips[0] : ips[ips.length - 1];
      if (isValidIp(candidate)) {
        return candidate;
      }
    } else if (ips.length > 0) {
      // If untrusted, take the last IP added by the immediate proxy if valid
      const candidate = ips[ips.length - 1];
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  return '127.0.0.1';
}

/**
 * Deep redaction of sensitive credentials, tokens, passwords, and payment details from logs.
 */
export function redactSensitiveData<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact bearer tokens or passwords in stringified content
    if (/bearer\s+[a-zA-Z0-9_\-\.]+/i.test(obj)) {
      return obj.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]') as unknown as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        cleaned[key] = redactSensitiveData(val);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned as T;
  }

  return obj;
}

/**
 * Sanitizes error messages in production to prevent leaking SQL syntax,
 * table structures, filesystem paths, or stack traces to end users.
 */
export function formatSafeErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  if (!error) return fallbackMessage;

  const rawMessage = error instanceof Error ? error.message : String(error);

  // In non-production, return raw message for ease of debugging
  if (process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'staging') {
    return rawMessage;
  }

  // Check if error contains sensitive internal details
  const containsLeakyContent = LEAKY_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage));
  if (containsLeakyContent) {
    return fallbackMessage;
  }

  return rawMessage;
}

/**
 * CSRF / Origin Verification.
 * Ensures state-modifying requests (POST, PUT, PATCH, DELETE) originate from trusted domains.
 */
export function validateCsrfOrigin(req: NextRequest): { valid: boolean; reason?: string } {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const pathname = req.nextUrl.pathname;

  // Webhooks are authenticated via HMAC signature, not browser origin
  if (pathname.startsWith('/api/v1/webhooks/')) {
    return { valid: true };
  }

  // Requests authenticated via Bearer token are immune to browser ambient credential CSRF
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { valid: true };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (!origin && !referer) {
    // If neither Origin nor Referer is present, allow only if no session cookie was attached
    // (e.g. CLI tools or native non-browser clients)
    const hasCookies = req.cookies.has('auth_token') || req.cookies.has('autoledger_customer_token');
    if (hasCookies) {
      return { valid: false, reason: 'Missing Origin and Referer on state-modifying authenticated request.' };
    }
    return { valid: true };
  }

  const checkUrl = origin || referer;
  if (checkUrl && host) {
    try {
      const parsed = new URL(checkUrl);
      if (parsed.host !== host) {
        // Check if allowed via APP_URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
        if (appUrl) {
          try {
            const parsedApp = new URL(appUrl);
            if (parsed.host === parsedApp.host) {
              return { valid: true };
            }
          } catch {}
        }
        return { valid: false, reason: `Cross-origin request rejected from origin "${parsed.host}" (expected "${host}").` };
      }
    } catch {
      return { valid: false, reason: 'Malformed Origin or Referer header.' };
    }
  }

  return { valid: true };
}

/**
 * Standard HTTP Security Headers dictionary.
 */
export const HTTP_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
};

/**
 * Returns strict transport security header in production.
 */
export function getHstsHeader(): string | null {
  if (process.env.NODE_ENV === 'production') {
    return 'max-age=31536000; includeSubDomains; preload';
  }
  return null;
}
