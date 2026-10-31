import { PrismaClient } from '@prisma/client';
import net from 'net';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as { 
  prisma: PrismaClient;
  _dbAvailable?: boolean;
  _lastDbCheck?: number;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// BigInt JSON serialization polyfill
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/**
 * Fast check to verify if PostgreSQL (Neon / local / remote) is available.
 * Gracefully handles serverless cold starts & auto-wake.
 */
export async function isPostgresAvailable(): Promise<boolean> {
  const now = Date.now();
  if (
    globalForPrisma._dbAvailable === true && 
    globalForPrisma._lastDbCheck && 
    now - globalForPrisma._lastDbCheck < 60000 // Cache positive checks for 1 minute
  ) {
    return true;
  }

  // If previous check failed, retry after 5 seconds instead of locking out
  if (
    globalForPrisma._dbAvailable === false &&
    globalForPrisma._lastDbCheck &&
    now - globalForPrisma._lastDbCheck < 5000
  ) {
    return false;
  }

  try {
    const checkQuery = prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('DB Timeout')), 6000)
    );
    await Promise.race([checkQuery, timeout]);
    globalForPrisma._dbAvailable = true;
    globalForPrisma._lastDbCheck = Date.now();
    return true;
  } catch (err: any) {
    // If closed due to idle scale-to-zero, trigger a silent reconnect with serverless wake allowance
    try {
      const reconnect = async () => {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
      };
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('DB Reconnect Timeout')), 6000)
      );
      await Promise.race([reconnect(), timeout]);
      globalForPrisma._dbAvailable = true;
      globalForPrisma._lastDbCheck = Date.now();
      return true;
    } catch {
      globalForPrisma._dbAvailable = false;
      globalForPrisma._lastDbCheck = Date.now();
      return false;
    }
  }
}

/**
 * Determines effective storage mode and guards against silent localStore fallbacks in production.
 */
export function getStorageMode(): 'POSTGRES' | 'LOCAL_OFFLINE' {
  if (process.env.STORAGE_MODE === 'local' || process.env.OFFLINE_MODE === 'true') {
    return 'LOCAL_OFFLINE';
  }
  if (process.env.NODE_ENV === 'production' || process.env.STORAGE_MODE === 'postgres') {
    return 'POSTGRES';
  }
  return 'LOCAL_OFFLINE';
}

export default prisma;
