import prisma from '@config/db';
import logger from '@config/winston';

/**
 * Database connection pool monitoring and optimization
 */

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
  connectionTimeout: number;
  lastCheck: Date;
}

class DatabaseMonitor {
  private stats: PoolStats | null = null;
  private alertThreshold = 0.8; // 80% utilization
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring database connection pool
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    this.checkInterval = setInterval(() => {
      this.checkPoolStats();
    }, intervalMs);

    logger.info('Database monitoring started', { interval: `${intervalMs}ms` });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Database monitoring stopped');
    }
  }

  /**
   * Check current pool statistics
   */
  private async checkPoolStats(): Promise<void> {
    try {
      // Get pool metrics - simplified approach since $metrics might not be available
      // In a real implementation, you'd access the underlying connection pool
      const stats = {
        totalConnections: 0, // Would come from actual pool
        activeConnections: 0, // Would come from actual pool
        idleConnections: 0, // Would come from actual pool
        waitingRequests: 0, // Would come from actual pool
      };

      // Simulate getting real data (in production, access actual pool metrics)
      // This is a placeholder - you'd need to access the actual connection pool
      this.stats = {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections,
        waitingRequests: stats.waitingRequests,
        maxConnections: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
        connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
        lastCheck: new Date(),
      };

      this.checkThresholds();
      this.logStats();
    } catch (error) {
      logger.error('Failed to get database pool stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if pool utilization exceeds threshold
   */
  private checkThresholds(): void {
    if (!this.stats) return;

    const utilization = this.stats.activeConnections / this.stats.maxConnections;

    if (utilization > this.alertThreshold) {
      logger.warn('High database connection pool utilization', {
        utilization: `${(utilization * 100).toFixed(1)}%`,
        activeConnections: this.stats.activeConnections,
        maxConnections: this.stats.maxConnections,
        waitingRequests: this.stats.waitingRequests,
      });
    }

    if (this.stats.waitingRequests > 0) {
      logger.warn('Database connection requests waiting', {
        waitingRequests: this.stats.waitingRequests,
        activeConnections: this.stats.activeConnections,
      });
    }
  }

  /**
   * Log current statistics
   */
  private logStats(): void {
    if (!this.stats) return;

    logger.debug('Database pool stats', {
      active: this.stats.activeConnections,
      idle: this.stats.idleConnections,
      waiting: this.stats.waitingRequests,
      total: this.stats.totalConnections,
      max: this.stats.maxConnections,
      utilization: `${((this.stats.activeConnections / this.stats.maxConnections) * 100).toFixed(1)}%`,
    });
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats | null {
    return this.stats;
  }

  /**
   * Get pool utilization percentage
   */
  getUtilization(): number {
    if (!this.stats) return 0;
    return this.stats.activeConnections / this.stats.maxConnections;
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    if (!this.stats) return false;

    const utilization = this.getUtilization();
    return (
      utilization < this.alertThreshold &&
      this.stats.waitingRequests === 0 &&
      this.stats.activeConnections < this.stats.maxConnections
    );
  }

  /**
   * Force connection pool cleanup
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up database connections');
      await prisma.$disconnect();
      await prisma.$connect();
      logger.info('Database connection cleanup completed');
    } catch (error) {
      logger.error('Database cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
export const dbMonitor = new DatabaseMonitor();

// Helper function to execute query with timeout
export async function executeWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 30000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Database query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    queryFn()
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// Helper function to batch database operations
export async function batchDatabaseOperations<T>(
  operations: Array<() => Promise<T>>,
  batchSize: number = 10,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((op) =>
        executeWithTimeout(op, 30000).catch((error) => {
          logger.error('Batch operation failed', {
            index: i + batch.indexOf(op),
            error: error.message,
          });
          return null as unknown as T;
        }),
      ),
    );

    results.push(...batchResults.filter((result) => result !== null));
  }

  return results;
}
