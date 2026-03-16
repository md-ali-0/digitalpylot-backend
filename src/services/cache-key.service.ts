import { CacheService } from '@config/cache';
import logger from '@config/winston';
import { PerformanceMonitor } from '@utils/performance';

/**
 * Cache key management and invalidation system
 */

export class CacheKeyService {
  // Cache key prefixes
  static readonly PREFIXES = {
    USER: 'user',
    TENANT: 'tenant',
    OFFER: 'offer',
    AFFILIATE: 'affiliate',
    ADVERTISER: 'advertiser',
    DASHBOARD: 'dashboard',
    REPORTING: 'reporting',
    SESSION: 'session',
    CONFIG: 'config',
  } as const;

  // Default TTL values (in seconds)
  static readonly TTL = {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 7200, // 2 hours
    VERY_LONG: 86400, // 24 hours
  } as const;

  /**
   * Generate cache key for user permissions
   */
  static userPermissions(userId: string): string {
    return `${this.PREFIXES.USER}:${userId}:permissions`;
  }

  /**
   * Generate cache key for user profile
   */
  static userProfile(userId: string): string {
    return `${this.PREFIXES.USER}:${userId}:profile`;
  }

  /**
   * Generate cache key for tenant configuration
   */
  static tenantConfig(tenantId: string): string {
    return `${this.PREFIXES.TENANT}:${tenantId}:config`;
  }

  /**
   * Generate cache key for tenant stats
   */
  static tenantStats(tenantId: string): string {
    return `${this.PREFIXES.TENANT}:${tenantId}:stats`;
  }

  /**
   * Generate cache key for offer details
   */
  static offerDetails(offerId: string): string {
    return `${this.PREFIXES.OFFER}:${offerId}`;
  }

  /**
   * Generate cache key for offer list
   */
  static offerList(tenantId: string, filters?: Record<string, unknown>): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    const hash = filterStr ? this.hashString(filterStr) : 'all';
    return `${this.PREFIXES.OFFER}:list:${tenantId}:${hash}`;
  }

  /**
   * Generate cache key for affiliate dashboard stats
   */
  static affiliateDashboard(affiliateId: string, days: number = 30): string {
    return `${this.PREFIXES.AFFILIATE}:${affiliateId}:dashboard:${days}`;
  }

  /**
   * Generate cache key for advertiser offers
   */
  static advertiserOffers(advertiserId: string): string {
    return `${this.PREFIXES.ADVERTISER}:${advertiserId}:offers`;
  }

  /**
   * Generate cache key for dashboard summary
   */
  static dashboardSummary(tenantId: string, days: number = 30): string {
    return `${this.PREFIXES.DASHBOARD}:${tenantId}:summary:${days}`;
  }

  /**
   * Generate cache key for reporting data
   */
  static reportingData(
    tenantId: string,
    reportType: string,
    params: Record<string, unknown>,
  ): string {
    const paramStr = JSON.stringify(params);
    const hash = this.hashString(paramStr);
    return `${this.PREFIXES.REPORTING}:${tenantId}:${reportType}:${hash}`;
  }

  /**
   * Generate cache key for session data
   */
  static session(sessionId: string): string {
    return `${this.PREFIXES.SESSION}:${sessionId}`;
  }

  /**
   * Generate cache key for system configuration
   */
  static systemConfig(configKey: string): string {
    return `${this.PREFIXES.CONFIG}:${configKey}`;
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidateByPattern(pattern: string): Promise<number> {
    return await PerformanceMonitor.measure('cache.invalidate.pattern', async () => {
      try {
        const keys = await this.getKeysByPattern(pattern);
        if (keys.length > 0) {
          // Delete keys one by one since Redis doesn't have a direct deleteMany
          let deletedCount = 0;
          for (const key of keys) {
            const result = await CacheService.del(key);
            if (result > 0) deletedCount++;
          }
          logger.info(`Invalidated ${deletedCount} cache keys matching pattern`, { pattern });
          return deletedCount;
        }
        return 0;
      } catch (error) {
        logger.error('Failed to invalidate cache by pattern', {
          pattern,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 0;
      }
    });
  }

  /**
   * Invalidate user-related cache
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    await PerformanceMonitor.measure(
      'cache.invalidate.user',
      async () => {
        const pattern = `${this.PREFIXES.USER}:${userId}:*`;
        await this.invalidateByPattern(pattern);
      },
      { userId },
    );
  }

  /**
   * Invalidate tenant-related cache
   */
  static async invalidateTenantCache(tenantId: string): Promise<void> {
    await PerformanceMonitor.measure(
      'cache.invalidate.tenant',
      async () => {
        const pattern = `${this.PREFIXES.TENANT}:${tenantId}:*`;
        await this.invalidateByPattern(pattern);
      },
      { tenantId },
    );
  }

  /**
   * Invalidate offer-related cache
   */
  static async invalidateOfferCache(offerId: string, tenantId?: string): Promise<void> {
    await PerformanceMonitor.measure(
      'cache.invalidate.offer',
      async () => {
        // Invalidate specific offer
        const specificKey = this.offerDetails(offerId);
        await CacheService.del(specificKey);

        // Invalidate offer lists for tenant
        if (tenantId) {
          const pattern = `${this.PREFIXES.OFFER}:list:${tenantId}:*`;
          await this.invalidateByPattern(pattern);
        }
      },
      { offerId, tenantId },
    );
  }

  /**
   * Invalidate dashboard cache
   */
  static async invalidateDashboardCache(tenantId: string): Promise<void> {
    await PerformanceMonitor.measure(
      'cache.invalidate.dashboard',
      async () => {
        const pattern = `${this.PREFIXES.DASHBOARD}:${tenantId}:*`;
        await this.invalidateByPattern(pattern);
      },
      { tenantId },
    );
  }

  /**
   * Invalidate all reporting cache
   */
  static async invalidateReportingCache(tenantId?: string): Promise<void> {
    await PerformanceMonitor.measure(
      'cache.invalidate.reporting',
      async () => {
        const pattern = tenantId
          ? `${this.PREFIXES.REPORTING}:${tenantId}:*`
          : `${this.PREFIXES.REPORTING}:*`;
        await this.invalidateByPattern(pattern);
      },
      { tenantId },
    );
  }

  /**
   * Get all keys matching a pattern
   */
  private static async getKeysByPattern(pattern: string): Promise<string[]> {
    // Note: Redis KEYS command should be used carefully in production
    // Consider using SCAN for large datasets
    try {
      // This is a simplified implementation
      // In production, you might want to use Redis SCAN command
      return [];
    } catch (error) {
      logger.error('Failed to get keys by pattern', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Simple string hashing for cache key generation
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get appropriate TTL for different data types
   */
  static getTTL(dataType: keyof typeof this.TTL): number {
    return this.TTL[dataType];
  }

  /**
   * Cache wrapper with automatic key generation and TTL
   */
  static async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.TTL.MEDIUM,
  ): Promise<T> {
    return await PerformanceMonitor.measure(
      'cache.getOrSet',
      async () => {
        // Try to get from cache
        const cached = await CacheService.get<T>(key);
        if (cached !== null) {
          return cached;
        }

        // Fetch and cache
        const data = await fetchFn();
        await CacheService.set(key, data, ttl);
        return data;
      },
      { key, ttl },
    );
  }
}

// Decorator for caching method results
export function Cacheable(
  keyGenerator: (args: unknown[]) => string,
  ttl: number = CacheKeyService.TTL.MEDIUM,
) {
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = keyGenerator(args);

      return await CacheKeyService.getOrSet(key, () => method.apply(this, args), ttl);
    };

    return descriptor;
  };
}
