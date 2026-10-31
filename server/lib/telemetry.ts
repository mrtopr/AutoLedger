/**
 * TradeLedger ERP — Operational SRE Telemetry & Anomaly Detector
 * 
 * Provides:
 * 1. Zero-dependency in-memory circular telemetry buffer.
 * 2. Real-time request volume, 4xx/5xx error rates, and P95 latency estimation.
 * 3. Authentication failure spike detection (brute-force warning).
 * 4. Circular buffer of operational alerts without leaking secrets or customer PII.
 * 5. Safe summary metrics provider for the health and operations API.
 */

export interface TelemetryAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  component: string;
  message: string;
  timestamp: string;
}

export interface TelemetrySummary {
  uptimeSeconds: number;
  totalRequests: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  errorRatePercent: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  authFailures: number;
  healthState: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  activeAlertsCount: number;
  recentAlerts: TelemetryAlert[];
}

const MAX_LATENCY_SAMPLES = 200;
const MAX_ALERTS = 50;

class TelemetryTracker {
  private startTime = Date.now();
  private totalRequests = 0;
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private authFailures = 0;
  private latencies: number[] = [];
  private alerts: TelemetryAlert[] = [];

  public recordRequest(statusCode: number, durationMs: number): void {
    this.totalRequests++;

    if (statusCode >= 200 && statusCode < 300) {
      this.status2xx++;
    } else if (statusCode >= 400 && statusCode < 500) {
      this.status4xx++;
    } else if (statusCode >= 500) {
      this.status5xx++;
    }

    if (this.latencies.length >= MAX_LATENCY_SAMPLES) {
      this.latencies.shift();
    }
    this.latencies.push(Math.round(durationMs));

    // Automated anomaly alert on 5xx error spikes
    if (statusCode >= 500) {
      const errorRate = (this.status5xx / this.totalRequests) * 100;
      if (this.totalRequests >= 20 && errorRate > 5) {
        this.recordTelemetryAlert({
          severity: 'CRITICAL',
          component: 'API_GATEWAY',
          message: `Elevated 5xx error rate detected: ${errorRate.toFixed(1)}% across ${this.totalRequests} requests`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  public recordAuthFailure(endpoint: string, reason?: string): void {
    this.authFailures++;
    if (this.authFailures % 10 === 0) {
      this.recordTelemetryAlert({
        severity: 'WARNING',
        component: 'AUTHENTICATION',
        message: `Repeated authentication failures detected (${this.authFailures} total) on ${endpoint}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public recordTelemetryAlert(alert: Omit<TelemetryAlert, 'id'>): void {
    const entry: TelemetryAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...alert,
    };

    if (this.alerts.length >= MAX_ALERTS) {
      this.alerts.shift();
    }
    this.alerts.push(entry);
  }

  public getSummary(): TelemetrySummary {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const errorRatePercent = this.totalRequests > 0
      ? Number(((this.status5xx / this.totalRequests) * 100).toFixed(2))
      : 0;

    let averageLatencyMs = 0;
    let p95LatencyMs = 0;

    if (this.latencies.length > 0) {
      const sum = this.latencies.reduce((a, b) => a + b, 0);
      averageLatencyMs = Math.round(sum / this.latencies.length);

      const sorted = [...this.latencies].sort((a, b) => a - b);
      const p95Index = Math.min(
        sorted.length - 1,
        Math.floor(sorted.length * 0.95)
      );
      p95LatencyMs = sorted[p95Index] || 0;
    }

    let healthState: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (errorRatePercent > 10 || this.status5xx > 20) {
      healthState = 'CRITICAL';
    } else if (errorRatePercent > 2 || this.status5xx > 5 || this.authFailures > 25) {
      healthState = 'DEGRADED';
    }

    return {
      uptimeSeconds,
      totalRequests: this.totalRequests,
      status2xx: this.status2xx,
      status4xx: this.status4xx,
      status5xx: this.status5xx,
      errorRatePercent,
      averageLatencyMs,
      p95LatencyMs,
      authFailures: this.authFailures,
      healthState,
      activeAlertsCount: this.alerts.length,
      recentAlerts: this.alerts.slice(-10),
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.status2xx = 0;
    this.status4xx = 0;
    this.status5xx = 0;
    this.authFailures = 0;
    this.latencies = [];
    this.alerts = [];
  }
}

export const telemetry = new TelemetryTracker();

export function recordRequestMetric(statusCode: number, durationMs: number): void {
  telemetry.recordRequest(statusCode, durationMs);
}

export function recordAuthFailureMetric(endpoint: string, reason?: string): void {
  telemetry.recordAuthFailure(endpoint, reason);
}

export function recordTelemetryAlert(alert: Omit<TelemetryAlert, 'id'>): void {
  telemetry.recordTelemetryAlert(alert);
}

export function getTelemetrySummary(): TelemetrySummary {
  return telemetry.getSummary();
}

export function resetTelemetry(): void {
  telemetry.reset();
}
