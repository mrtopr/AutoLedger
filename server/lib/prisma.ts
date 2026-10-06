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
 * Caches result for 2 minutes to prevent repeated ping overhead.
 */
export async function isPostgresAvailable(): Promise<boolean> {
  const now = Date.now();
  if (
    globalForPrisma._dbAvailable !== undefined && 
    globalForPrisma._lastDbCheck && 
    now - globalForPrisma._lastDbCheck < 120000 // Cache for 2 minutes
  ) {
    return globalForPrisma._dbAvailable;
  }

  try {
    const checkQuery = prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('DB Timeout')), 3000)
    );
    await Promise.race([checkQuery, timeout]);
    globalForPrisma._dbAvailable = true;
    globalForPrisma._lastDbCheck = Date.now();
    return true;
  } catch (err) {
    globalForPrisma._dbAvailable = false;
    globalForPrisma._lastDbCheck = Date.now();
    return false;
  }
}

export default prisma;
