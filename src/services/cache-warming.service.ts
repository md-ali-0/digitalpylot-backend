import prisma from '@config/db';
import logger from '@config/winston';
import { EnhancedCacheService } from '@services/enhanced-cache.service';
import { CacheKeyGenerator, CacheTTL } from '@utils/cache-strategies.util';

/**
 * Cache warming service to pre-populate cache with frequently accessed data
 */
export class CacheWarmingService {
  /**
   * Warm up settings cache
   */
  static async warmSettings(): Promise<void> {
    try {
      logger.info('Warming settings cache...');

      const settings = await prisma.webSettings.findFirst();

      if (settings) {
        const cacheKey = CacheKeyGenerator.settings();
        await EnhancedCacheService.set(cacheKey, settings, CacheTTL.settings());
        logger.info('Settings cache warmed');
      }
    } catch (error) {
      logger.error('Failed to warm settings cache', { error });
    }
  }

  /**
   * Warm up products cache
   */
  static async warmProducts(): Promise<void> {
    try {
      logger.info('Warming products cache...');
      const products = await prisma.product.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        include: { category: true, brand: true, thumbnail: true },
        take: 100,
      });

      for (const product of products) {
        const cacheKey = CacheKeyGenerator.product(product.id);
        await EnhancedCacheService.set(cacheKey, product, CacheTTL.products());
      }
      logger.info(`Warmed ${products.length} products`);
    } catch (error) {
      logger.error('Failed to warm products cache', { error });
    }
  }

  /**
   * Warm up categories cache
   */
  static async warmCategories(): Promise<void> {
    try {
      logger.info('Warming categories cache...');
      const categories = await prisma.category.findMany({
        where: { isActive: true, deletedAt: null },
        include: { imageFile: true },
      });

      for (const category of categories) {
        const cacheKey = CacheKeyGenerator.category(category.id);
        await EnhancedCacheService.set(cacheKey, category, CacheTTL.categories());
      }
      logger.info(`Warmed ${categories.length} categories`);
    } catch (error) {
      logger.error('Failed to warm categories cache', { error });
    }
  }

  /**
   * Warm up brands cache
   */
  static async warmBrands(): Promise<void> {
    try {
      logger.info('Warming brands cache...');
      const brands = await prisma.brand.findMany({
        where: { isActive: true, deletedAt: null },
        include: { logoFile: true },
      });

      for (const brand of brands) {
        const cacheKey = CacheKeyGenerator.brand(brand.id);
        await EnhancedCacheService.set(cacheKey, brand, CacheTTL.medium()); // brand() doesn't exist, use medium()
      }
      logger.info(`Warmed ${brands.length} brands`);
    } catch (error) {
      logger.error('Failed to warm brands cache', { error });
    }
  }

  /**
   * Warm all caches
   */
  static async warmAll(): Promise<void> {
    logger.info('Starting cache warming for all entities...');

    await Promise.all([
      this.warmSettings(),
      this.warmProducts(),
      this.warmCategories(),
      this.warmBrands(),
    ]);

    logger.info('Cache warming completed');
  }

  /**
   * Schedule periodic cache warming
   */
  static scheduleWarming(intervalMinutes: number = 30): NodeJS.Timeout {
    logger.info(`Scheduling cache warming every ${intervalMinutes} minutes`);

    // Warm immediately
    this.warmAll();

    // Then schedule periodic warming
    return setInterval(
      () => {
        this.warmAll();
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
