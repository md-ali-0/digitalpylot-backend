import logger from '@config/winston';
import { CacheService } from '@services/cache.service';

/**
 * Graceful degradation wrapper for Redis operations
 * If Redis fails, logs the error and continues without caching
 */
export class GracefulCache {
  /**
   * Get from cache with graceful fallback
   */
  static async get<T>(key: string, fallback: () => Promise<T>): Promise<T> {
    try {
      const cached = await CacheService.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      logger.warn('Cache get failed, using fallback', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Fetch from source
    return await fallback();
  }

  /**
   * Set in cache with graceful error handling
   */
  static async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      await CacheService.set(key, value, ttl);
    } catch (error) {
      logger.warn('Cache set failed, continuing without cache', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - gracefully degrade
    }
  }

  /**
   * Get or set with graceful degradation
   */
  static async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      return await CacheService.getOrSet(key, fetchFn, ttl);
    } catch (error) {
      logger.warn('Cache operation failed, fetching without cache', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback to direct fetch
      return await fetchFn();
    }
  }

  /**
   * Invalidate cache with graceful error handling
   */
  static async invalidate(pattern: string): Promise<void> {
    try {
      await CacheService.invalidate(pattern);
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - gracefully degrade
    }
  }
}
