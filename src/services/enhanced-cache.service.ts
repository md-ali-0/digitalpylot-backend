import logger from '@config/winston';
import { CacheStatsTracker } from '@services/cache-stats.service';
import { CacheService } from '@services/cache.service';

/**
 * Enhanced cache service with statistics tracking
 */
export class EnhancedCacheService extends CacheService {
  /**
   * Get from cache with statistics tracking
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const result = await super.get<T>(key);

      if (result !== null) {
        CacheStatsTracker.recordHit();
        logger.debug('Cache hit', { key });
      } else {
        CacheStatsTracker.recordMiss();
        logger.debug('Cache miss', { key });
      }

      return result;
    } catch (error) {
      CacheStatsTracker.recordError();
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set in cache with statistics tracking
   */
  static async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    try {
      await super.set(key, value, ttl);
      CacheStatsTracker.recordSet();
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      CacheStatsTracker.recordError();
      logger.error('Cache set error', { key, error });
    }
  }

  /**
   * Delete from cache with statistics tracking
   */
  static async delete(key: string): Promise<void> {
    try {
      await super.delete(key);
      CacheStatsTracker.recordDelete();
      logger.debug('Cache delete', { key });
    } catch (error) {
      CacheStatsTracker.recordError();
      logger.error('Cache delete error', { key, error });
    }
  }

  /**
   * Invalidate with statistics tracking
   */
  static async invalidate(pattern: string): Promise<void> {
    try {
      await super.invalidate(pattern);
      CacheStatsTracker.recordDelete();
      logger.info('Cache invalidated', { pattern });
    } catch (error) {
      CacheStatsTracker.recordError();
      logger.error('Cache invalidate error', { pattern, error });
    }
  }

  /**
   * Get or set with statistics tracking
   */
  static async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl: number = 300): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Batch get multiple keys
   */
  static async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  /**
   * Batch set multiple key-value pairs
   */
  static async mset(items: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    await Promise.all(items.map((item) => this.set(item.key, item.value, item.ttl)));
  }

  /**
   * Check if key exists
   */
  static async has(key: string): Promise<boolean> {
    return await super.exists(key);
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    return CacheStatsTracker.getStats();
  }

  /**
   * Get cache size
   */
  static async getSize(): Promise<number> {
    return await CacheStatsTracker.getCacheSize();
  }

  /**
   * Get memory usage
   */
  static async getMemoryUsage(): Promise<string> {
    return await CacheStatsTracker.getMemoryUsage();
  }
}
