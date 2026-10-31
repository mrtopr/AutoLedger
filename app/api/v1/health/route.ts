import { NextResponse } from 'next/server';
import { prisma, isPostgresAvailable, getStorageMode } from '@/server/lib/prisma';
import { getTelemetrySummary } from '@/server/lib/telemetry';

export const dynamic = 'force-dynamic';

/**
 * Enterprise SRE Health, Readiness & Operations Telemetry Endpoint
 * 
 * Capabilities:
 * 1. Distinguishes process liveness from database readiness.
 * 2. Reports memory usage (heap, RSS) and process uptime.
 * 3. Measures database ping latency safely.
 * 4. Provides operational metrics summary (error rate %, P95 latency, recent alerts).
 * 5. Strictly protects secrets: NEVER discloses connection strings, passwords, or customer PII.
 * 
 * Status Codes:
 * - 200: Healthy and fully operational.
 * - 503: Degraded (database disconnected in PostgreSQL mode, or active critical alerts).
 */
export async function GET() {
  const storageMode = getStorageMode();
  const uptimeSeconds = Math.floor(process.uptime());
  const timestamp = new Date().toISOString();
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true' || process.env.MAINTENANCE_MODE === '1';

  const memory = process.memoryUsage();
  const memoryStats = {
    heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
    rssMb: Math.round(memory.rss / 1024 / 1024),
  };

  const telemetryStats = getTelemetrySummary();

  // Measure database latency if in Postgres mode
  let dbLatencyMs: number | null = null;
  let isDbConnected = false;

  if (storageMode === 'POSTGRES') {
    const dbStart = Date.now();
    isDbConnected = await isPostgresAvailable();
    if (isDbConnected) {
      dbLatencyMs = Date.now() - dbStart;
    }

    if (!isDbConnected) {
      return NextResponse.json(
        {
          status: isMaintenance ? 'maintenance' : 'degraded',
          process: 'alive',
          maintenance: isMaintenance,
          storageMode,
          database: {
            status: 'disconnected',
            latencyMs: null,
          },
          memory: memoryStats,
          telemetry: telemetryStats,
          uptimeSeconds,
          timestamp,
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        status: isMaintenance ? 'maintenance' : telemetryStats.healthState === 'CRITICAL' ? 'degraded' : 'healthy',
        process: 'alive',
        maintenance: isMaintenance,
        storageMode,
        database: {
          status: 'connected',
          latencyMs: dbLatencyMs,
        },
        memory: memoryStats,
        telemetry: telemetryStats,
        uptimeSeconds,
        timestamp,
      },
      {
        status: isMaintenance ? 503 : telemetryStats.healthState === 'CRITICAL' ? 503 : 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  // Local Offline Mode
  return NextResponse.json(
    {
      status: isMaintenance ? 'maintenance' : 'healthy',
      process: 'alive',
      maintenance: isMaintenance,
      storageMode,
      storage: {
        type: 'local_offline',
        status: 'ready',
      },
      memory: memoryStats,
      telemetry: telemetryStats,
      uptimeSeconds,
      timestamp,
    },
    {
      status: isMaintenance ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
