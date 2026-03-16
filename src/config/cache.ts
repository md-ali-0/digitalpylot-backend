import redisClient from '@config/redis';
import logger from '@config/winston';

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  // User related
  USER: (id: string) => `user:${id}`,
  USER_PROFILE: (id: string) => `user:profile:${id}`,
  USER_PERMISSIONS: (id: string) => `user:permissions:${id}`,

  // Tenant related
  TENANT: (id: string) => `tenant:${id}`,
  TENANT_CONFIG: (id: string) => `tenant:config:${id}`,

  // Auth related
  REFRESH_TOKEN: (token: string) => `refresh_token:${token}`,
  PASSWORD_RESET: (token: string) => `password_reset:${token}`,
  EMAIL_VERIFICATION: (token: string) => `email_verification:${token}`,

  // Affiliate related
  AFFILIATE_STATS: (id: string) => `affiliate:stats:${id}`,
  AFFILIATE_COMMISSION: (id: string) => `affiliate:commission:${id}`,

  // Offer related
  OFFER: (id: string) => `offer:${id}`,
  OFFER_STATS: (id: string) => `offer:stats:${id}`,

  // Tracking related
  CLICK_COUNT: (offerId: string, date: string) => `tracking:clicks:${offerId}:${date}`,
  CONVERSION_COUNT: (offerId: string, date: string) => `tracking:conversions:${offerId}:${date}`,
  TRAFFIC_STATS: (date: string) => `tracking:traffic:${date}`,

  // Dashboard related
  DASHBOARD_STATS: (userId: string, date: string) => `dashboard:stats:${userId}:${date}`,
  REVENUE_STATS: (tenantId: string, period: string) => `revenue:stats:${tenantId}:${period}`,

  // Rate limiting
  RATE_LIMIT: (key: string) => `rate_limit:${key}`,

  // Session related
  SESSION: (id: string) => `session:${id}`,

  // Configuration
  CONFIG: (key: string) => `config:${key}`,

  // Locks for distributed operations
  LOCK: (key: string) => `lock:${key}`,
} as const;

/**
 * Cache management service
 */
export class CacheService {
  /**
   * Get data from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set data in cache
   */
  static async set<T>(key: string, value: T, ttl: number = 3600): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const result = await redisClient.setex(key, ttl, serialized);
      return result === 'OK';
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete cache entry
   */
  static async del(key: string): Promise<number> {
    try {
      return await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return 0;
    }
  }

  /**
   * Delete multiple cache entries by pattern
   */
  static async delByPattern(pattern: string): Promise<number> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;

      const result = await redisClient.del(...keys);
      logger.info(`Deleted ${result} cache entries matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      logger.error('Cache delete by pattern error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  static async incr(key: string, ttl?: number): Promise<number> {
    try {
      const result = await redisClient.incr(key);
      if (ttl) {
        await redisClient.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   */
  static async decr(key: string): Promise<number> {
    try {
      return await redisClient.decr(key);
    } catch (error) {
      logger.error('Cache decrement error:', { key, error });
      return 0;
    }
  }

  /**
   * Set expiration time for a key
   */
  static async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await redisClient.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error:', { key, error });
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error('Cache TTL error:', { key, error });
      return -1;
    }
  }

  /**
   * Acquire a distributed lock
   */
  static async acquireLock(key: string, ttl: number = 30): Promise<string | null> {
    try {
      const lockKey = CACHE_KEYS.LOCK(key);
      const lockValue = Date.now().toString();

      const result = await redisClient.set(lockKey, lockValue, 'EX', ttl, 'NX');
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      logger.error('Cache acquire lock error:', { key, error });
      return null;
    }
  }

  /**
   * Release a distributed lock
   */
  static async releaseLock(key: string, lockValue: string): Promise<boolean> {
    try {
      const lockKey = CACHE_KEYS.LOCK(key);
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redisClient.eval(script, 1, lockKey, lockValue);
      return result === 1;
    } catch (error) {
      logger.error('Cache release lock error:', { key, error });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<Record<string, any>> {
    try {
      const info = await redisClient.info();
      const lines = info.split('\n');
      const stats: Record<string, any> = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key.trim()] = value ? value.trim() : '';
        }
      }

      return stats;
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {};
    }
  }

  /**
   * Clear all cache
   */
  static async clearAll(): Promise<number> {
    try {
      const result = await redisClient.flushall();
      logger.info('Cache cleared completely');
      return result === 'OK' ? 1 : 0;
    } catch (error) {
      logger.error('Cache clear all error:', error);
      return 0;
    }
  }

  /**
   * Clear cache by prefix
   */
  static async clearByPrefix(prefix: string): Promise<number> {
    return this.delByPattern(`${prefix}:*`);
  }
}

export default CacheService;
