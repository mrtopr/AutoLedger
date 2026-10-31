/**
 * TradeLedger ERP — Structured Enterprise SRE Logger
 * 
 * Provides:
 * 1. ISO-timestamped, severity-graded structured logs (DEBUG, INFO, WARN, ERROR, FATAL).
 * 2. Request correlation tracing via traceId / x-request-id.
 * 3. Deep redaction of passwords, tokens, cookies, and payment secrets before logging.
 * 4. Production JSON format for cloud log ingestion (CloudWatch, Datadog, GCP Cloud Logging, Grafana Loki).
 * 5. Automatic piping of warnings and errors into operational telemetry buffers for real-time alerting.
 */

import { redactSensitiveData } from './security';
import { recordTelemetryAlert } from './telemetry';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  traceId?: string;
  data?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

class Logger {
  private formatLog(
    level: LogLevel,
    context: string,
    message: string,
    data?: Record<string, any>,
    error?: unknown,
    traceId?: string
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(traceId ? { traceId } : {}),
    };

    if (data && typeof data === 'object') {
      entry.data = redactSensitiveData(data);
    }

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        };
      } else {
        entry.error = {
          message: String(error),
        };
      }
    }

    return entry;
  }

  private write(entry: StructuredLogEntry): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, emit standardized single-line JSON for log aggregators
    if (isProduction) {
      const jsonLine = JSON.stringify(entry);
      if (entry.level === 'ERROR' || entry.level === 'FATAL') {
        console.error(jsonLine);
      } else if (entry.level === 'WARN') {
        console.warn(jsonLine);
      } else {
        console.log(jsonLine);
      }
    } else {
      // In development / local testing, emit readable output
      const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.context}]`;
      const trace = entry.traceId ? ` (trace: ${entry.traceId})` : '';
      const dataStr = entry.data ? `\n  Data: ${JSON.stringify(entry.data)}` : '';
      const errStr = entry.error ? `\n  Error: ${entry.error.message}` : '';

      if (entry.level === 'ERROR' || entry.level === 'FATAL') {
        console.error(`${prefix}${trace} ${entry.message}${dataStr}${errStr}`);
      } else if (entry.level === 'WARN') {
        console.warn(`${prefix}${trace} ${entry.message}${dataStr}${errStr}`);
      } else {
        console.log(`${prefix}${trace} ${entry.message}${dataStr}`);
      }
    }

    // Trigger operational alert in telemetry for warnings and errors
    if (entry.level === 'ERROR' || entry.level === 'FATAL') {
      recordTelemetryAlert({
        severity: entry.level === 'FATAL' ? 'CRITICAL' : 'ERROR',
        component: entry.context,
        message: entry.message,
        timestamp: entry.timestamp,
      });
    }
  }

  public debug(context: string, message: string, data?: Record<string, any>, traceId?: string): void {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'DEBUG') {
      this.write(this.formatLog('DEBUG', context, message, data, undefined, traceId));
    }
  }

  public info(context: string, message: string, data?: Record<string, any>, traceId?: string): void {
    this.write(this.formatLog('INFO', context, message, data, undefined, traceId));
  }

  public warn(context: string, message: string, data?: Record<string, any>, error?: unknown, traceId?: string): void {
    this.write(this.formatLog('WARN', context, message, data, error, traceId));
  }

  public error(context: string, message: string, error?: unknown, data?: Record<string, any>, traceId?: string): void {
    this.write(this.formatLog('ERROR', context, message, data, error, traceId));
  }

  public fatal(context: string, message: string, error?: unknown, data?: Record<string, any>, traceId?: string): void {
    this.write(this.formatLog('FATAL', context, message, data, error, traceId));
  }
}

export const logger = new Logger();
export default logger;
