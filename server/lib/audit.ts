import { prisma, isPostgresAvailable } from './prisma';
import { localStore } from './store';

export interface AuditLogParams {
  tenantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: any;
  after?: any;
  ip?: string | null;
}

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Strips sensitive security fields (passwords, JWTs, TOTP secrets, keys)
 * before persisting to the immutable audit log.
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'bigint') return data.toString();
    return data;
  }
  if (typeof data === 'bigint') return data.toString();
  if (data instanceof Date) return data.toISOString();

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }

  const sanitized: Record<string, any> = {};
  const sensitivePatterns = [
    'password',
    'secret',
    'totp',
    'token',
    'jwt',
    'hash',
    'authorization',
    'cookie',
    'keysecret',
  ];

  for (const [key, val] of Object.entries(data)) {
    const isSensitive = sensitivePatterns.some((pattern) =>
      key.toLowerCase().includes(pattern)
    );
    if (!isSensitive) {
      sanitized[key] = sanitizeAuditData(val);
    }
  }

  return sanitized;
}

/**
 * Creates an immutable audit log record.
 * If passed a transaction client `tx`, couples the audit write directly
 * to the business transaction (so that if audit fails, the transaction rolls back).
 */
export async function createAuditLog(params: AuditLogParams, tx?: any): Promise<any> {
  const cleanBefore = sanitizeAuditData(params.before);
  const cleanAfter = sanitizeAuditData(params.after);

  // 1. Always record in localStore for testability, offline resilience, and local audit trail
  const resolvedEntityId = params.entityId || params.tenantId;
  const targetEntityUuid = isUuid(params.entityId) ? params.entityId! : (isUuid(params.tenantId) ? params.tenantId : null);

  // 1. Always record in localStore for testability, offline resilience, and local audit trail
  let localResult: any = null;
  try {
    localResult = localStore.addAuditLog({
      tenantId: params.tenantId,
      userId: params.userId || null,
      action: params.action,
      entity: params.entity,
      entityId: resolvedEntityId,
      before: cleanBefore,
      after: cleanAfter,
      ip: params.ip || null,
    });
  } catch (localErr) {
    console.warn('LocalStore audit write error:', localErr);
  }

  // 2. Persist to PostgreSQL if available or if inside a database transaction
  const postgresReady = tx ? true : await isPostgresAvailable();
  if (postgresReady && (tx || (isUuid(params.tenantId) && targetEntityUuid))) {
    const client = tx || prisma;
    try {
      if (client?.auditLog?.create && isUuid(params.tenantId) && targetEntityUuid) {
        const log = await client.auditLog.create({
          data: {
            tenantId: params.tenantId,
            userId: params.userId && isUuid(params.userId) ? params.userId : null,
            action: params.action,
            entity: params.entity,
            entityId: targetEntityUuid,
            before: cleanBefore ? cleanBefore : undefined,
            after: cleanAfter ? cleanAfter : undefined,
            ip: params.ip || null,
          },
        });
        return log;
      }
    } catch (err: any) {
      // When inside a database transaction, rethrow to enforce transactional integrity
      if (tx) {
        throw err;
      }
      if (err?.code !== 'P2003') {
        console.warn('AuditLog Postgres write skipped:', err?.message || err);
      }
    }
  }

  return localResult;
}
