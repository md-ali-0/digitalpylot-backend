import redisClient from '@config/redis';
import logger from '@config/winston';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Cache statistics tracker for monitoring cache performance
 */
export class CacheStatsTracker {
  private static stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  /**
   * Record a cache hit
   */
  static recordHit(): void {
    this.stats.hits++;
  }

  /**
   * Record a cache miss
   */
  static recordMiss(): void {
    this.stats.misses++;
  }

  /**
   * Record a cache set operation
   */
  static recordSet(): void {
    this.stats.sets++;
  }

  /**
   * Record a cache delete operation
   */
  static recordDelete(): void {
    this.stats.deletes++;
  }

  /**
   * Record a cache error
   */
  static recordError(): void {
    this.stats.errors++;
  }

  /**
   * Get current cache statistics
   */
  static getStats(): CacheStats & { hitRate: string; totalOperations: number } {
    const totalOperations = this.stats.hits + this.stats.misses;
    const hitRate =
      totalOperations > 0 ? ((this.stats.hits / totalOperations) * 100).toFixed(2) : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalOperations,
    };
  }

  /**
   * Reset statistics
   */
  static reset(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Get Redis info
   */
  static async getRedisInfo(): Promise<Record<string, unknown>> {
    try {
      const info = await redisClient.info();
      const lines = info.split('\r\n');
      const result: Record<string, unknown> = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key] = value;
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get Redis info', { error });
      return {};
    }
  }

  /**
   * Get cache size (number of keys)
   */
  static async getCacheSize(): Promise<number> {
    try {
      return await redisClient.dbsize();
    } catch (error) {
      logger.error('Failed to get cache size', { error });
      return 0;
    }
  }

  /**
   * Get memory usage
   */
  static async getMemoryUsage(): Promise<string> {
    try {
      const info = await this.getRedisInfo();
      return (info.used_memory_human as string) || 'Unknown';
    } catch (error) {
      logger.error('Failed to get memory usage', { error });
      return 'Unknown';
    }
  }
}
