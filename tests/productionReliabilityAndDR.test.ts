import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { logger } from '@/server/lib/logger';
import {
  telemetry,
  recordRequestMetric,
  recordAuthFailureMetric,
  recordTelemetryAlert,
  getTelemetrySummary,
  resetTelemetry,
} from '@/server/lib/telemetry';
import { GET as getHealth } from '@/app/api/v1/health/route';
import { createPaymentLink } from '@/server/lib/razorpay';
import * as prismaModule from '@/server/lib/prisma';

describe('FIX 20 — Production Reliability, Monitoring & Disaster Recovery Tests', () => {
  beforeEach(() => {
    resetTelemetry();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetTelemetry();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. STRUCTURED SRE LOGGER & PII SCRUBBING
  // =========================================================================
  describe('1. Structured SRE Logger', () => {
    it('redacts sensitive fields like passwords, tokens, and cookies before logging', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('AUTH', 'User login failed', new Error('Authentication failure'), {
        username: 'dealer_admin',
        password: 'TopSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        cookie: 'auth_token=super_secret_cookie',
      }, 'req_trace_12345');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedCall = consoleErrorSpy.mock.calls[0][0];

      // Must never contain plaintext sensitive values
      expect(loggedCall).not.toContain('TopSecretPassword123!');
      expect(loggedCall).not.toContain('super_secret_cookie');
      expect(loggedCall).toContain('[REDACTED]');
    });

    it('records critical error alerts in telemetry when fatal or error is logged', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('PAYMENTS', 'Razorpay gateway API unreachable', new Error('ETIMEDOUT'));

      const summary = getTelemetrySummary();
      expect(summary.activeAlertsCount).toBeGreaterThan(0);
      const lastAlert = summary.recentAlerts[summary.recentAlerts.length - 1];
      expect(lastAlert.component).toBe('PAYMENTS');
      expect(lastAlert.severity).toBe('ERROR');
    });
  });

  // =========================================================================
  // 2. OPERATIONAL TELEMETRY & ANOMALY DETECTION
  // =========================================================================
  describe('2. Operational Telemetry & Anomaly Detection', () => {
    it('accurately computes request volume, error rates, and p95 latency', () => {
      // Simulate 100 requests with varying latencies
      for (let i = 1; i <= 95; i++) {
        recordRequestMetric(200, 20); // 20ms
      }
      for (let i = 96; i <= 98; i++) {
        recordRequestMetric(400, 15); // 15ms
      }
      for (let i = 99; i <= 100; i++) {
        recordRequestMetric(500, 150); // 150ms 5xx
      }

      const summary = getTelemetrySummary();
      expect(summary.totalRequests).toBe(100);
      expect(summary.status2xx).toBe(95);
      expect(summary.status4xx).toBe(3);
      expect(summary.status5xx).toBe(2);
      expect(summary.errorRatePercent).toBe(2);
      expect(summary.p95LatencyMs).toBeGreaterThanOrEqual(20);
    });

    it('triggers brute-force warning alerts when repeated auth failures occur', () => {
      for (let i = 0; i < 20; i++) {
        recordAuthFailureMetric('/api/v1/auth/login', 'Invalid password');
      }

      const summary = getTelemetrySummary();
      expect(summary.authFailures).toBe(20);
      const authAlerts = summary.recentAlerts.filter((a) => a.component === 'AUTHENTICATION');
      expect(authAlerts.length).toBeGreaterThan(0);
      expect(authAlerts[0].severity).toBe('WARNING');
    });
  });

  // =========================================================================
  // 3. MAINTENANCE MODE & GRACEFUL RECOVERY
  // =========================================================================
  describe('3. Maintenance Mode Guard', () => {
    it('returns HTTP 503 with Retry-After when maintenance mode is active', async () => {
      const originalMode = process.env.MAINTENANCE_MODE;
      process.env.MAINTENANCE_MODE = 'true';

      const req = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);

      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('300');
      const body = await res.json();
      expect(body.status).toBe('maintenance');
      expect(body.message).toContain('scheduled maintenance');

      process.env.MAINTENANCE_MODE = originalMode;
    });

    it('allows health check probes during maintenance mode so orchestrators can monitor status', async () => {
      const originalMode = process.env.MAINTENANCE_MODE;
      process.env.MAINTENANCE_MODE = 'true';

      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);

      // Must not be blocked by middleware maintenance guard
      expect(res.status).not.toBe(503);

      process.env.MAINTENANCE_MODE = originalMode;
    });

    it('allows requests with valid maintenance bypass key', async () => {
      const originalMode = process.env.MAINTENANCE_MODE;
      const originalBypass = process.env.MAINTENANCE_BYPASS_KEY;
      process.env.MAINTENANCE_MODE = 'true';
      process.env.MAINTENANCE_BYPASS_KEY = 'secret-sre-bypass-key-123';

      const req = new NextRequest('http://localhost:3000/api/v1/products', {
        headers: {
          host: 'localhost:3000',
          'x-maintenance-bypass': 'secret-sre-bypass-key-123',
        },
      });
      const res = await middleware(req);

      expect(res.status).toBe(200);

      process.env.MAINTENANCE_MODE = originalMode;
      process.env.MAINTENANCE_BYPASS_KEY = originalBypass;
    });
  });

  // =========================================================================
  // 4. ENTERPRISE HEALTH ENDPOINT & SECRET PROTECTION
  // =========================================================================
  describe('4. Health & Operations Telemetry Endpoint', () => {
    it('provides memory statistics, database status, and telemetry without leaking secrets', async () => {
      vi.spyOn(prismaModule, 'getStorageMode').mockReturnValue('LOCAL_OFFLINE');

      const res = await getHealth();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.process).toBe('alive');
      expect(data.memory).toBeDefined();
      expect(data.memory.heapUsedMb).toBeGreaterThan(0);
      expect(data.telemetry).toBeDefined();
      expect(data.telemetry.healthState).toBeDefined();

      // Verify no secrets or connection strings exist in output
      const jsonStr = JSON.stringify(data);
      expect(jsonStr).not.toContain('postgres://');
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain('secret');
    });

    it('returns HTTP 503 when in POSTGRES mode and database is disconnected', async () => {
      vi.spyOn(prismaModule, 'getStorageMode').mockReturnValue('POSTGRES');
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);

      const res = await getHealth();
      expect(res.status).toBe(503);

      const data = await res.json();
      expect(data.status).toBe('degraded');
      expect(data.database.status).toBe('disconnected');
    });
  });

  // =========================================================================
  // 5. EXTERNAL API OUTAGE RESILIENCE & ZERO BLOCKING
  // =========================================================================
  describe('5. Payment Gateway Outage Resilience', () => {
    it('falls back to instant dynamic UPI Intent QR code without blocking counter payments when gateway is offline', async () => {
      const paymentParams = {
        amountPaise: 150000, // ₹1,500.00
        description: 'Auto Parts Counter Sale #INV-101',
        customer: {
          name: 'Ramesh Garage',
          contact: '9822100001',
        },
        tenantId: 'tenant-test-1',
      };

      // Call payment link generator without live Razorpay keys (simulates gateway outage)
      const result = await createPaymentLink(paymentParams);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.amountPaise).toBe(150000);
      expect(result.qrUrl).toContain('api.qrserver.com');
      // Verifies the counter cashier receives a valid UPI intent link for instant customer scanning
      expect(result.isMock).toBe(true);
    });
  });
});
