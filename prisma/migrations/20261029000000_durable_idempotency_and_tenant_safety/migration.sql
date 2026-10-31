-- Migration: 20261029000000_durable_idempotency_and_tenant_safety
-- Purpose: Safely adds durable tenant-scoped idempotency keys to invoices and payments.
-- Designed to be safely repeatable and non-destructive on both fresh and existing databases.

-- 1. Ensure idempotency_key column on invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(255);

-- 2. Ensure tenant-scoped unique index on invoices
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_tenant_id_idempotency_key_key" 
ON "invoices"("tenant_id", "idempotency_key");

-- 3. Ensure idempotency_key column on payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- 4. Ensure tenant-scoped unique index on payments
CREATE UNIQUE INDEX IF NOT EXISTS "payments_tenant_id_idempotency_key_key" 
ON "payments"("tenant_id", "idempotency_key");
