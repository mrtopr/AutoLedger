import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractClientIp, validateCsrfOrigin, HTTP_SECURITY_HEADERS, getHstsHeader } from '@/server/lib/security';
import { checkRateLimit } from '@/server/lib/rateLimiter';
import { recordRequestMetric } from '@/server/lib/telemetry';

const MAX_PAYLOAD_STANDARD_BYTES = 10 * 1024 * 1024; // 10 MB maximum for normal API requests
const MAX_PAYLOAD_BACKUP_BYTES = 50 * 1024 * 1024;   // 50 MB maximum for database backup restore

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  // Correlation ID tracing
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('traceparent') ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 1. Maintenance Mode Guard
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true' || process.env.MAINTENANCE_MODE === '1';
  if (isMaintenance) {
    const isHealthCheck = pathname === '/api/health' || pathname === '/api/v1/health';
    const hasBypassKey =
      Boolean(process.env.MAINTENANCE_BYPASS_KEY) &&
      request.headers.get('x-maintenance-bypass') === process.env.MAINTENANCE_BYPASS_KEY;

    if (!isHealthCheck && !hasBypassKey) {
      recordRequestMetric(503, Date.now() - startTime);
      return new NextResponse(
        JSON.stringify({
          status: 'maintenance',
          message: 'TradeLedger ERP is currently undergoing scheduled maintenance. Please try again shortly.',
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '300',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'x-request-id': requestId,
          },
        }
      );
    }
  }

  // Apply HTTP API protections (Payload bounds, CSRF, Rate Limiting) to /api routes
  if (pathname.startsWith('/api/')) {
    // 2. Enforce payload size limit
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const parsedLength = parseInt(contentLength, 10);
      const isBackupRoute = pathname.startsWith('/api/v1/backup');
      const maxAllowed = isBackupRoute ? MAX_PAYLOAD_BACKUP_BYTES : MAX_PAYLOAD_STANDARD_BYTES;

      if (!isNaN(parsedLength) && parsedLength > maxAllowed) {
        recordRequestMetric(413, Date.now() - startTime);
        return new NextResponse(
          JSON.stringify({
            error: `Payload too large. Request body exceeds maximum allowed size of ${isBackupRoute ? '50MB' : '10MB'}.`,
          }),
          {
            status: 413,
            headers: {
              'Content-Type': 'application/json',
              'X-Content-Type-Options': 'nosniff',
              'x-request-id': requestId,
            },
          }
        );
      }
    }

    // 3. CSRF Origin Verification on state-modifying requests
    const csrfCheck = validateCsrfOrigin(request);
    if (!csrfCheck.valid) {
      recordRequestMetric(403, Date.now() - startTime);
      return new NextResponse(
        JSON.stringify({ error: csrfCheck.reason || 'Forbidden: CSRF Origin Check Failed' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
            'x-request-id': requestId,
          },
        }
      );
    }

    // 4. Multi-tier anti-spoofing rate limiting
    const clientIp = extractClientIp(request);
    const rateCheck = await checkRateLimit(clientIp, pathname);

    if (!rateCheck.allowed) {
      recordRequestMetric(429, Date.now() - startTime);
      const retryAfterStr = String(rateCheck.retryAfterSeconds || rateCheck.resetSeconds || 60);
      return new NextResponse(
        JSON.stringify({
          error: `Too many requests. Please try again in ${retryAfterStr} seconds.`,
          tier: rateCheck.tier,
          limit: rateCheck.limit,
          retryAfter: retryAfterStr,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfterStr,
            'X-RateLimit-Limit': String(rateCheck.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateCheck.resetSeconds),
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'x-request-id': requestId,
          },
        }
      );
    }

    const response = NextResponse.next();

    // Attach request tracing and telemetry headers
    response.headers.set('x-request-id', requestId);
    response.headers.set('X-RateLimit-Limit', String(rateCheck.limit));
    response.headers.set('X-RateLimit-Remaining', String(rateCheck.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateCheck.resetSeconds));

    // Attach standard security headers to API response
    for (const [header, val] of Object.entries(HTTP_SECURITY_HEADERS)) {
      response.headers.set(header, val);
    }
    const hsts = getHstsHeader();
    if (hsts) response.headers.set('Strict-Transport-Security', hsts);

    recordRequestMetric(200, Date.now() - startTime);
    return response;
  }

  // For all frontend pages & SSR routes, attach complete HTTP security headers and correlation ID
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);

  for (const [header, val] of Object.entries(HTTP_SECURITY_HEADERS)) {
    response.headers.set(header, val);
  }
  const hsts = getHstsHeader();
  if (hsts) response.headers.set('Strict-Transport-Security', hsts);

  recordRequestMetric(200, Date.now() - startTime);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.png, logo.png (public brand images)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png).*)',
  ],
};
