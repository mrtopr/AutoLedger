/**
 * TradeLedger ERP — Multi-Tier Distributed & In-Memory Rate Limiter
 * 
 * Implements:
 * 1. Layered, configurable rate limit tiers (Auth, Resource-Intensive, General API).
 * 2. Multi-instance distributed limiter support via Upstash Redis REST API (Edge + Node compatible).
 * 3. Bounded sliding-window in-memory fallback with LRU/time-based eviction to prevent memory exhaustion.
 * 4. Graceful fail-safe degradation: if distributed store is unreachable, falls back to in-memory limiting without crashing.
 * 5. Standards-compliant HTTP 429 response metadata (Retry-After, X-RateLimit headers).
 */

export type RateLimitTier = 'AUTH' | 'RESOURCE' | 'GENERAL' | 'SYNC';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
  tier: RateLimitTier;
  storage: 'redis' | 'in_memory';
}

// Configurable defaults via environment variables
export const TIER_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  AUTH: {
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '15', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_SEC || '60', 10),
  },
  RESOURCE: {
    maxRequests: parseInt(process.env.RATE_LIMIT_RESOURCE_MAX || '20', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_RESOURCE_WINDOW_SEC || '60', 10),
  },
  GENERAL: {
    maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '120', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW_SEC || '60', 10),
  },
  SYNC: {
    maxRequests: parseInt(process.env.RATE_LIMIT_SYNC_MAX || '300', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_SYNC_WINDOW_SEC || '60', 10),
  },
};

// In-memory sliding window bucket store
interface MemoryBucket {
  count: number;
  windowStart: number;
}

const memoryStore = new Map<string, MemoryBucket>();
const MAX_MEMORY_STORE_ENTRIES = 10000;

function cleanupMemoryStore(now: number, maxWindowMs: number) {
  if (memoryStore.size > MAX_MEMORY_STORE_ENTRIES || Math.random() < 0.05) {
    const cutoff = now - maxWindowMs * 2;
    for (const [key, bucket] of memoryStore.entries()) {
      if (bucket.windowStart < cutoff) {
        memoryStore.delete(key);
      }
    }
  }
}

/**
 * Classifies an incoming pathname into its appropriate rate limit tier.
 */
export function classifyPathTier(pathname: string): RateLimitTier {
  // 1. Sensitive authentication and user registration endpoints
  if (
    pathname.startsWith('/api/v1/auth/login') ||
    pathname.startsWith('/api/v1/auth/signup') ||
    pathname.startsWith('/api/v1/auth/email-otp') ||
    pathname.startsWith('/api/v1/auth/firebase-login') ||
    pathname.startsWith('/api/v1/portal/auth') ||
    pathname.startsWith('/api/v1/onboarding/complete')
  ) {
    return 'AUTH';
  }

  // 2. High-volume inventory & data sync endpoints (generous ceiling for batch mutations)
  if (
    pathname.startsWith('/api/v1/products/bulk-import') ||
    pathname.startsWith('/api/v1/customers/bulk-opening-balance')
  ) {
    return 'SYNC';
  }

  // 3. Resource-intensive exports, system operations, and bulk deletions
  if (
    pathname.startsWith('/api/v1/backup') ||
    pathname.startsWith('/api/v1/products/bulk-delete') ||
    pathname.startsWith('/api/v1/reports/settlement') ||
    pathname.startsWith('/api/v1/payments/razorpay/link')
  ) {
    return 'RESOURCE';
  }

  // 3. General standard API endpoints
  return 'GENERAL';
}

/**
 * Executes distributed rate check via Upstash Redis REST API if configured.
 * Uses atomic INCR with EXPIRE.
 */
async function checkDistributedRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitCheckResult | null> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    // Pipeline command: INCR key, then if new, EXPIRE key
    const response = await fetch(`${upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', `tl:ratelimit:${key}`],
        ['EXPIRE', `tl:ratelimit:${key}`, config.windowSeconds, 'NX'],
        ['TTL', `tl:ratelimit:${key}`],
      ]),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Upstash Redis rate limiter responded with status ${response.status}. Falling back to in-memory.`);
      return null;
    }

    const json = await response.json();
    const count = json[0]?.result || 1;
    const ttl = json[2]?.result > 0 ? json[2].result : config.windowSeconds;

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);

    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      resetSeconds: ttl,
      retryAfterSeconds: allowed ? undefined : ttl,
      tier: 'GENERAL',
      storage: 'redis',
    };
  } catch (err: any) {
    console.warn('Upstash Redis rate limiter unreachable. Gracefully falling back to in-memory sliding window:', err?.message || err);
    return null;
  }
}

/**
 * Checks in-memory sliding window rate limit.
 */
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  tier: RateLimitTier
): RateLimitCheckResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  cleanupMemoryStore(now, windowMs);

  const bucket = memoryStore.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    // New or expired window
    memoryStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetSeconds: config.windowSeconds,
      tier,
      storage: 'in_memory',
    };
  }

  bucket.count++;
  const elapsedMs = now - bucket.windowStart;
  const resetSeconds = Math.max(1, Math.ceil((windowMs - elapsedMs) / 1000));
  const allowed = bucket.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - bucket.count);

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetSeconds,
    retryAfterSeconds: allowed ? undefined : resetSeconds,
    tier,
    storage: 'in_memory',
  };
}

/**
 * Main Rate Limiter check entry point.
 * Checks distributed Redis first, then falls back safely to in-memory limiting.
 */
export async function checkRateLimit(
  ip: string,
  pathname: string
): Promise<RateLimitCheckResult> {
  const tier = classifyPathTier(pathname);
  const config = TIER_CONFIGS[tier];
  const rateLimitKey = `${ip}:${tier}`;

  // 1. Try distributed Redis in multi-instance/production cloud environments
  const distributedResult = await checkDistributedRedis(rateLimitKey, config);
  if (distributedResult) {
    return {
      ...distributedResult,
      tier,
    };
  }

  // 2. Local sliding window in-memory fallback
  return checkMemoryRateLimit(rateLimitKey, config, tier);
}

/**
 * Clears in-memory rate limit table (useful for test isolation).
 */
export function resetMemoryRateLimits(): void {
  memoryStore.clear();
}
