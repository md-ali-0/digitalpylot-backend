import prisma from '@config/db';
import logger from '@config/winston';

/**
 * Database connection pool monitoring
 */
export class DatabasePoolMonitor {
  private static monitorInterval: NodeJS.Timeout | null = null;
  private static statsHistory: Array<{
    timestamp: Date;
    totalConnections: number;
    idleConnections: number;
    activeConnections: number;
    waitingRequests: number;
  }> = [];

  /**
   * Start monitoring database connection pool
   */
  static start(intervalMs: number = 30000): void {
    if (this.monitorInterval) {
      this.stop();
    }

    this.monitorInterval = setInterval(() => {
      this.collectStats();
    }, intervalMs);

    logger.info(`Database pool monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop monitoring database connection pool
   */
  static stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('Database pool monitoring stopped');
    }
  }

  /**
   * Collect current database pool statistics
   */
  static async collectStats(): Promise<void> {
    try {
      // This is a simplified approach - in a real Prisma setup, you'd access
      // the underlying connection pool directly
      const stats = {
        timestamp: new Date(),
        totalConnections: 0, // Would need to get from Prisma internals
        idleConnections: 0, // Would need to get from Prisma internals
        activeConnections: 0, // Would need to get from Prisma internals
        waitingRequests: 0, // Would need to get from Prisma internals
      };

      // Add to history
      this.statsHistory.push(stats);

      // Keep only last 1000 entries
      if (this.statsHistory.length > 1000) {
        this.statsHistory.shift();
      }

      // Log warnings if connections are low
      if (stats.idleConnections === 0) {
        logger.warn('No idle database connections available');
      }

      // Log if there are waiting requests
      if (stats.waitingRequests > 5) {
        logger.warn(`High number of waiting database requests: ${stats.waitingRequests}`);
      }

      // Log general stats every 5 minutes
      const shouldLog = this.statsHistory.length % 10 === 0; // Every 10 collections (5 minutes if 30s interval)
      if (shouldLog) {
        logger.info('Database Pool Stats:', {
          totalConnections: stats.totalConnections,
          activeConnections: stats.activeConnections,
          idleConnections: stats.idleConnections,
          waitingRequests: stats.waitingRequests,
        });
      }
    } catch (error) {
      logger.error('Error collecting database pool stats:', error);
    }
  }

  /**
   * Get connection pool statistics
   */
  static getStats(): {
    current: {
      totalConnections: number;
      idleConnections: number;
      activeConnections: number;
      waitingRequests: number;
    };
    history: Array<any>;
    averages: {
      totalConnections: number;
      idleConnections: number;
      activeConnections: number;
      waitingRequests: number;
    };
  } {
    const history = [...this.statsHistory];
    const current =
      history.length > 0
        ? history[history.length - 1]
        : {
            totalConnections: 0,
            idleConnections: 0,
            activeConnections: 0,
            waitingRequests: 0,
          };

    // Calculate averages
    const averages = {
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0,
      waitingRequests: 0,
    };

    if (history.length > 0) {
      const sums = history.reduce(
        (acc, stat) => {
          acc.totalConnections += stat.totalConnections;
          acc.idleConnections += stat.idleConnections;
          acc.activeConnections += stat.activeConnections;
          acc.waitingRequests += stat.waitingRequests;
          return acc;
        },
        {
          totalConnections: 0,
          idleConnections: 0,
          activeConnections: 0,
          waitingRequests: 0,
        },
      );

      averages.totalConnections = sums.totalConnections / history.length;
      averages.idleConnections = sums.idleConnections / history.length;
      averages.activeConnections = sums.activeConnections / history.length;
      averages.waitingRequests = sums.waitingRequests / history.length;
    }

    return {
      current: {
        totalConnections: current.totalConnections,
        idleConnections: current.idleConnections,
        activeConnections: current.activeConnections,
        waitingRequests: current.waitingRequests,
      },
      history: history.slice(-100), // Last 100 entries
      averages,
    };
  }

  /**
   * Get health status
   */
  static getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const stats = this.getStats();
    const current = stats.current;

    // Check if pool is functioning
    if (current.waitingRequests > 10) {
      return 'unhealthy';
    }

    if (current.waitingRequests > 5) {
      return 'degraded';
    }

    // Check if there are any idle connections
    if (current.idleConnections === 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Clear statistics history
   */
  static clear(): void {
    this.statsHistory = [];
    logger.info('Database pool statistics cleared');
  }

  /**
   * Execute database query with timeout and monitoring
   */
  static async executeWithTimeout<T>(
    operation: string,
    query: () => Promise<T>,
    timeoutMs: number = 30000,
  ): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Database operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([
      query().then((result) => {
        logger.debug(`Database operation completed: ${operation}`);
        return result;
      }),
      timeoutPromise,
    ]);
  }
}

/**
 * Health check utilities
 */
export class HealthCheck {
  /**
   * Check database connectivity
   */
  static async checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy' };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message || 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  static async checkRedis(
    redisClient: any,
  ): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      await redisClient.ping();
      return { status: 'healthy' };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message || 'Redis connection failed',
      };
    }
  }

  /**
   * Comprehensive health check
   */
  static async checkAll(redisClient: any): Promise<{
    database: { status: 'healthy' | 'unhealthy'; error?: string };
    redis: { status: 'healthy' | 'unhealthy'; error?: string };
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(redisClient),
    ]);

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (database.status === 'unhealthy' || redis.status === 'unhealthy') {
      overall = 'unhealthy';
    }

    return {
      database,
      redis,
      overall,
    };
  }
}

export default {
  DatabasePoolMonitor,
  HealthCheck,
};
