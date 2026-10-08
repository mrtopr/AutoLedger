import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic in-memory store for rate limiting (resets on Edge function cold start, but provides basic protection)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute

export function middleware(request: NextRequest) {
  // Only apply rate limiting to /api routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    
    // Clean up old entries periodically to prevent memory leaks in the map
    if (Math.random() < 0.05) {
      rateLimitMap.forEach((data, key) => {
        if (data.timestamp < windowStart) {
          rateLimitMap.delete(key);
        }
      });
    }

    const currentRateLimit = rateLimitMap.get(ip);
    
    if (!currentRateLimit || currentRateLimit.timestamp < windowStart) {
      // First request or window expired, reset
      rateLimitMap.set(ip, { count: 1, timestamp: now });
    } else {
      // Increment count
      currentRateLimit.count++;
      
      if (currentRateLimit.count > MAX_REQUESTS_PER_WINDOW) {
        // Rate limit exceeded
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
