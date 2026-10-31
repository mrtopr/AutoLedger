import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnvironment, getJwtSecret } from '@/server/lib/env';
import { GET as getHealth } from '@/app/api/v1/health/route';
import * as prismaModule from '@/server/lib/prisma';

describe('FIX 09 — Deployment Readiness & Production Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. Environment & Secret Validation', () => {
    it('detects missing DATABASE_URL in PostgreSQL storage mode', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STORAGE_MODE = 'postgres';
      delete process.env.DATABASE_URL;

      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
    });

    it('detects insecure placeholder JWT_SECRET in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STORAGE_MODE = 'postgres';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
    });

    it('rejects short (<32 chars) JWT secrets in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STORAGE_MODE = 'postgres';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'too-short-secret';

      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 32 characters'))).toBe(true);
    });

    it('getJwtSecret throws in production when secret is missing or insecure', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.JWT_SECRET = 'b2b-khata-jwt-super-secret-key-2026';

      expect(() => getJwtSecret()).toThrow(/Security Exception/);
    });

    it('passes validation when valid production secrets are provided', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STORAGE_MODE = 'postgres';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'cryptographically-secure-production-jwt-secret-key-32chars!';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_test123';
      process.env.RAZORPAY_KEY_SECRET = 'secret123';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'live_webhook_secret_key_prod';

      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('never prints or exposes secret values in error messages', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STORAGE_MODE = 'postgres';
      delete process.env.DATABASE_URL;

      const result = validateEnvironment();
      for (const err of result.errors) {
        expect(err).not.toContain('postgresql://');
        expect(err).not.toContain('password');
        expect(err).not.toContain('rzp_');
      }
    });

    it('rejects live Razorpay keys and production DBs in staging environment mode', () => {
      process.env.APP_ENV = 'staging';
      process.env.STORAGE_MODE = 'postgres';
      process.env.DATABASE_URL = 'postgresql://user:pass@ep-production-db.neon.tech/neondb';
      process.env.JWT_SECRET = 'cryptographically-secure-production-jwt-secret-key-32chars!';
      process.env.RAZORPAY_KEY_ID = 'rzp_live_abc123456';
      process.env.RAZORPAY_KEY_SECRET = 'secret123';

      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Staging environment requires Razorpay test mode'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Staging environment cannot target a production database URL'))).toBe(true);
    });
  });

  describe('2. Health & Readiness Route Handler', () => {
    it('returns HTTP 200 with connected status when PostgreSQL is healthy', async () => {
      vi.spyOn(prismaModule, 'getStorageMode').mockReturnValue('POSTGRES');
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(true);

      const response = await getHealth();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe('healthy');
      expect(json.process).toBe('alive');
      expect(json.storageMode).toBe('POSTGRES');
      expect(json.database.status).toBe('connected');
      expect(json.uptimeSeconds).toBeDefined();

      // Ensure no sensitive fields are present
      expect(json.databaseUrl).toBeUndefined();
      expect(json.env).toBeUndefined();
      expect(json.secrets).toBeUndefined();
    });

    it('returns HTTP 503 with degraded status when PostgreSQL is disconnected in POSTGRES mode', async () => {
      vi.spyOn(prismaModule, 'getStorageMode').mockReturnValue('POSTGRES');
      vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);

      const response = await getHealth();
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json.status).toBe('degraded');
      expect(json.process).toBe('alive');
      expect(json.storageMode).toBe('POSTGRES');
      expect(json.database.status).toBe('disconnected');
    });

    it('returns HTTP 200 ready when in LOCAL_OFFLINE mode', async () => {
      vi.spyOn(prismaModule, 'getStorageMode').mockReturnValue('LOCAL_OFFLINE');

      const response = await getHealth();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe('healthy');
      expect(json.storageMode).toBe('LOCAL_OFFLINE');
      expect(json.storage.type).toBe('local_offline');
      expect(json.storage.status).toBe('ready');
    });
  });
});
