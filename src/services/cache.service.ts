import redisClient from '@config/redis';
import logger from '@config/winston';

/**
 * Redis-based caching service for improving application performance
 */
export class CacheService {
  /**
   * Get a cached value by key
   * @param key - Cache key
   * @returns Parsed cached value or null if not found
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (default: 300 = 5 minutes)
   */
  static async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    try {
      await redisClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error', { key, ttl, error });
    }
  }

  /**
   * Delete a specific cache key
   * @param key - Cache key to delete
   */
  static async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  /**
   * Invalidate all cache keys matching a pattern
   * @param pattern - Pattern to match (e.g., 'products:*')
   */
  static async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info('Cache invalidated', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('Cache invalidate error', { pattern, error });
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @returns true if exists, false otherwise
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists check error', { key, error });
      return false;
    }
  }

  /**
   * Get or set pattern: Get from cache, or compute and cache if not found
   * @param key - Cache key
   * @param fetchFn - Function to fetch data if not in cache
   * @param ttl - Time to live in seconds
   * @returns Cached or freshly fetched data
   */
  static async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl: number = 300): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, fetch and cache
    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Clear all cache (use with caution!)
   */
  static async clear(): Promise<void> {
    try {
      await redisClient.flushdb();
      logger.warn('All cache cleared');
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }
}
