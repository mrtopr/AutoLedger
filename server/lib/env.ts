/**
 * TradeLedger ERP Environment Configuration & Startup Secret Validator
 * 
 * Validates required environment variables for PostgreSQL, session signing,
 * Razorpay payments, and webhooks.
 * 
 * Rules:
 * 1. NEVER log, expose, or embed secret values in error messages or client bundles.
 * 2. In production, fail fast if required secrets are missing or use known placeholder defaults.
 * 3. In development/local mode, provide clear actionable warnings without crashing the local experience.
 */

export interface EnvValidationResult {
  isValid: boolean;
  storageMode: 'POSTGRES' | 'LOCAL_OFFLINE';
  errors: string[];
  warnings: string[];
}

const INSECURE_JWT_PLACEHOLDERS = new Set([
  'your-super-secret-jwt-key-change-in-production',
  'b2b-khata-jwt-super-secret-key-2026',
  'your-secure-jwt-secret-key',
  'default-secret',
  'secret',
  '123456',
]);

const INSECURE_WEBHOOK_PLACEHOLDERS = new Set([
  'autoledger_webhook_secret_2026',
  'your_razorpay_webhook_secret_here',
  'yourRazorpayWebhookSecretHere',
]);

/**
 * Validates application environment variables without revealing secret values.
 */
export function validateEnvironment(options?: { throwOnFailure?: boolean }): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = process.env.NODE_ENV === 'production';
  const isStaging = process.env.APP_ENV === 'staging' || (process.env.NODE_ENV as string) === 'staging' || process.env.STAGING === 'true';
  const isExplicitOffline = process.env.STORAGE_MODE === 'local' || process.env.OFFLINE_MODE === 'true';
  const storageMode: 'POSTGRES' | 'LOCAL_OFFLINE' = isExplicitOffline ? 'LOCAL_OFFLINE' : (isProduction || process.env.STORAGE_MODE === 'postgres' ? 'POSTGRES' : 'LOCAL_OFFLINE');

  // 1. PostgreSQL Database Configuration
  if (storageMode === 'POSTGRES') {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
      errors.push('[Database Configuration] DATABASE_URL is missing or empty. PostgreSQL storage mode requires a valid connection string.');
    } else if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
      errors.push('[Database Configuration] DATABASE_URL format is invalid (must start with postgresql:// or postgres://).');
    } else if (isStaging) {
      const dbUrlLower = process.env.DATABASE_URL.toLowerCase();
      if (dbUrlLower.includes('production') || dbUrlLower.includes('prod-db') || dbUrlLower.includes('prod_db')) {
        errors.push('[Database Configuration] Staging environment cannot target a production database URL. Ensure an isolated staging database is configured.');
      }
    }
  } else {
    if (!process.env.DATABASE_URL) {
      warnings.push('[Database Configuration] Running in local offline mode without DATABASE_URL. Persistence uses local file storage.');
    }
  }

  // 2. Authentication & Session JWT Secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    if (isProduction || isStaging) {
      errors.push('[Security Configuration] JWT_SECRET is required in production/staging for secure session signing.');
    } else {
      warnings.push('[Security Configuration] JWT_SECRET is not set. Using temporary local development signing key.');
    }
  } else if (INSECURE_JWT_PLACEHOLDERS.has(jwtSecret.trim())) {
    if (isProduction || isStaging) {
      errors.push('[Security Configuration] JWT_SECRET is set to an insecure default placeholder. A unique cryptographically secure secret must be configured.');
    } else {
      warnings.push('[Security Configuration] JWT_SECRET is using a known development placeholder key.');
    }
  } else if (jwtSecret.length < 32 && (isProduction || isStaging)) {
    errors.push('[Security Configuration] JWT_SECRET should be at least 32 characters long in production/staging for HMAC SHA-256 security.');
  }

  // 3. Razorpay Payment Gateway & Webhook Secrets
  const rzpKeyId = process.env.RAZORPAY_KEY_ID;
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const rzpWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (rzpKeyId) {
    if (isStaging && !rzpKeyId.startsWith('rzp_test_')) {
      errors.push('[Payment Gateway] Staging environment requires Razorpay test mode (key must start with rzp_test_). Live production keys are strictly prohibited in staging.');
    }
  }

  if (rzpKeyId && !rzpKeySecret) {
    errors.push('[Payment Gateway] RAZORPAY_KEY_SECRET is missing while RAZORPAY_KEY_ID is configured.');
  } else if (!rzpKeyId && rzpKeySecret) {
    errors.push('[Payment Gateway] RAZORPAY_KEY_ID is missing while RAZORPAY_KEY_SECRET is configured.');
  }

  if (rzpWebhookSecret && INSECURE_WEBHOOK_PLACEHOLDERS.has(rzpWebhookSecret.trim())) {
    if (isProduction || isStaging) {
      errors.push('[Payment Gateway] RAZORPAY_WEBHOOK_SECRET is set to an insecure placeholder. Webhooks will not be trusted.');
    } else {
      warnings.push('[Payment Gateway] RAZORPAY_WEBHOOK_SECRET is using a development placeholder.');
    }
  }

  const isValid = errors.length === 0;

  if (!isValid && options?.throwOnFailure) {
    const errorDetails = errors.join('\n - ');
    throw new Error(`[Startup Environment Validation Failed]:\n - ${errorDetails}`);
  }

  return {
    isValid,
    storageMode,
    errors,
    warnings,
  };
}

/**
 * Returns safe JWT secret for session verification.
 * Throws in production if missing or using insecure default.
 */
export function getJwtSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET;

  if (isProduction) {
    if (!secret || INSECURE_JWT_PLACEHOLDERS.has(secret.trim())) {
      throw new Error('[Security Exception] JWT_SECRET must be explicitly set to a unique, secure secret in production.');
    }
    return secret;
  }

  return secret || 'b2b-khata-jwt-super-secret-key-2026';
}
