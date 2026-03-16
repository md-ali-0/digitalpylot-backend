/* eslint-disable @typescript-eslint/no-explicit-any */
import logger from '@config/winston';
import { NextFunction, Request, Response } from 'express';

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();
  private static activeTimers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  static startTimer(operation: string): string {
    const timerId = `${operation}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(timerId, performance.now());
    return timerId;
  }

  /**
   * End timing and record the duration
   */
  static endTimer(timerId: string): number | null {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) return null;

    const duration = performance.now() - startTime;
    this.activeTimers.delete(timerId);

    // Record the metric
    const operation = timerId.split('-')[0];
    this.recordMetric(operation, duration);

    return duration;
  }

  /**
   * Record a metric value
   */
  static recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const values = this.metrics.get(operation)!;
    values.push(value);

    // Keep only last 1000 values to prevent memory issues
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Get performance statistics for an operation
   */
  static getStats(operation: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      min: sorted[0],
      max: sorted[count - 1],
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all performance metrics
   */
  static getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const stats: Record<string, ReturnType<typeof this.getStats> | null> = {};

    for (const operation of this.metrics.keys()) {
      const operationStats = this.getStats(operation);
      if (operationStats) {
        stats[operation] = operationStats;
      }
    }

    return stats;
  }

  /**
   * Clear all metrics
   */
  static clear(): void {
    this.metrics.clear();
    this.activeTimers.clear();
  }

  /**
   * Log performance statistics
   */
  static logStats(): void {
    const stats = this.getAllStats();

    logger.info('Performance Statistics:', stats);
  }

  /**
   * Decorator for monitoring method performance
   */
  static monitor(target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const timerId = PerformanceMonitor.startTimer(
        `${(target as any).constructor.name}.${propertyKey}`,
      );

      try {
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.finally(() => {
            const duration = PerformanceMonitor.endTimer(timerId);
            if (duration !== null) {
              logger.debug(
                `Performance: ${(target as any).constructor.name}.${propertyKey} took ${duration.toFixed(2)}ms`,
              );
            }
          });
        } else {
          const duration = PerformanceMonitor.endTimer(timerId);
          if (duration !== null) {
            logger.debug(
              `Performance: ${(target as any).constructor.name}.${propertyKey} took ${duration.toFixed(2)}ms`,
            );
          }
          return result;
        }
      } catch (error) {
        PerformanceMonitor.endTimer(timerId);
        throw error;
      }
    };
  }

  /**
   * Measure execution time of an async operation
   */
  static async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const timerId = this.startTimer(operation);

    try {
      const result = await fn();
      const duration = this.endTimer(timerId);

      if (duration !== null && metadata) {
        logger.debug(`Performance: ${operation} took ${duration.toFixed(2)}ms`, metadata);
      }

      return result;
    } catch (error) {
      this.endTimer(timerId);
      throw error;
    }
  }
}

/**
 * Database performance monitoring
 */
export class DatabaseMonitor {
  private static queryTimes: number[] = [];
  private static slowQueryThreshold = 1000; // 1 second

  /**
   * Record database query time
   */
  static recordQuery(time: number, query: string): void {
    this.queryTimes.push(time);

    // Keep only last 1000 query times
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }

    // Log slow queries
    if (time > this.slowQueryThreshold) {
      logger.warn(`Slow database query (${time.toFixed(2)}ms): ${query.substring(0, 100)}...`);
    }
  }

  /**
   * Get database performance stats
   */
  static getStats(): {
    totalQueries: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    slowQueries: number;
  } {
    if (this.queryTimes.length === 0) {
      return {
        totalQueries: 0,
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        slowQueries: 0,
      };
    }

    const sorted = [...this.queryTimes].sort((a, b) => a - b);
    const total = sorted.length;
    const slowQueries = sorted.filter((time) => time > this.slowQueryThreshold).length;

    return {
      totalQueries: total,
      avgTime: sorted.reduce((a, b) => a + b, 0) / total,
      minTime: sorted[0],
      maxTime: sorted[total - 1],
      slowQueries,
    };
  }

  /**
   * Clear query statistics
   */
  static clear(): void {
    this.queryTimes = [];
  }
}

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
  /**
   * Get current memory usage
   */
  static getUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  } {
    return process.memoryUsage();
  }

  /**
   * Log memory usage
   */
  static logUsage(): void {
    const usage = this.getUsage();
    logger.info('Memory Usage:', {
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
    });
  }

  /**
   * Check if memory usage is high
   */
  static isHighUsage(thresholdMB: number = 500): boolean {
    const usage = this.getUsage();
    return usage.heapUsed > thresholdMB * 1024 * 1024;
  }
}

/**
 * Request performance monitoring middleware
 */
export const performanceMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now();

    // Add timing methods to response
    (res as any).startTime = startTime;

    // Record when response finishes
    const originalEnd = res.end;
    (res as any).end = function (chunk?: any, encoding?: any, callback?: any) {
      const duration = performance.now() - startTime;
      PerformanceMonitor.recordMetric('http_request', duration);

      // Log slow requests
      if (duration > 2000) {
        // 2 seconds
        logger.warn(`Slow request (${duration.toFixed(2)}ms): ${req.method} ${(req as any).path}`);
      }

      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
};

export default {
  PerformanceMonitor,
  DatabaseMonitor,
  MemoryMonitor,
  performanceMiddleware,
};
