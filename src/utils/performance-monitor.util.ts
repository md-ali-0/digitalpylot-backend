import logger from '@config/winston';
import { performance } from 'perf_hooks';

/**
 * Performance monitoring utilities
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep only recent metrics

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.recordMetric(name, duration, metadata);

      // Log slow operations
      if (duration > 1000) {
        // 1 second
        logger.warn(`Slow operation detected: ${name}`, {
          duration: `${duration.toFixed(2)}ms`,
          ...metadata,
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Failed operation: ${name}`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Synchronous measurement
   */
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;

      this.recordMetric(name, duration, metadata);

      if (duration > 500) {
        // 500ms
        logger.warn(`Slow sync operation: ${name}`, {
          duration: `${duration.toFixed(2)}ms`,
          ...metadata,
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Failed sync operation: ${name}`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...metadata,
      });
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(name: string, duration: number, metadata?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    totalMetrics: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    slowOperations: PerformanceMetric[];
  } {
    if (this.metrics.length === 0) {
      return {
        totalMetrics: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowOperations: [],
      };
    }

    const durations = this.metrics.map((m) => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    const slowOperations = this.metrics
      .filter((m) => m.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalMetrics: this.metrics.length,
      avgDuration: totalDuration / this.metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      slowOperations,
    };
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationStats(operationName: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    last10: PerformanceMetric[];
  } {
    const operationMetrics = this.metrics.filter((m) => m.name === operationName);

    if (operationMetrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        last10: [],
      };
    }

    const durations = operationMetrics.map((m) => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: operationMetrics.length,
      avgDuration: totalDuration / operationMetrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      last10: operationMetrics.slice(-10),
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Log performance report
   */
  logReport(): void {
    const stats = this.getStats();

    if (stats.totalMetrics === 0) {
      logger.info('No performance metrics recorded');
      return;
    }

    logger.info('Performance Report', {
      totalMetrics: stats.totalMetrics,
      avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
      minDuration: `${stats.minDuration.toFixed(2)}ms`,
      maxDuration: `${stats.maxDuration.toFixed(2)}ms`,
      slowOperations: stats.slowOperations.length,
    });

    // Log top 5 slowest operations
    if (stats.slowOperations.length > 0) {
      logger.warn(
        'Slowest operations:',
        stats.slowOperations.slice(0, 5).map((op) => ({
          name: op.name,
          duration: `${op.duration.toFixed(2)}ms`,
          timestamp: new Date(op.timestamp).toISOString(),
        })),
      );
    }
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor();

// Decorator for measuring method performance
export function MeasurePerformance(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const className = target.constructor.name;
    const methodName = propertyName;
    const operationName = `${className}.${methodName}`;

    return await perfMonitor.measure(operationName, () => method.apply(this, args), {
      class: className,
      method: methodName,
    });
  };

  return descriptor;
}

// Helper for database query performance
export async function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  additionalMetadata?: Record<string, unknown>,
): Promise<T> {
  return await perfMonitor.measure(`db.query.${queryName}`, queryFn, {
    queryType: queryName,
    ...additionalMetadata,
  });
}

// Helper for cache operations
export async function measureCache<T>(
  operation: string,
  cacheFn: () => Promise<T>,
  cacheKey?: string,
): Promise<T> {
  return await perfMonitor.measure(`cache.${operation}`, cacheFn, {
    operation,
    cacheKey,
  });
}
