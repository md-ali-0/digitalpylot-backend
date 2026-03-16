import logger from '@config/winston';
import { CacheStatsTracker } from '@services/cache-stats.service';
import { EnhancedCacheService } from '@services/enhanced-cache.service';
import { Request, Response } from 'express';

/**
 * Cache admin controller for managing cache
 */
export class CacheAdminController {
  /**
   * Get cache statistics
   * GET /api/v1/admin/cache/stats
   */
  static async getStats(req: Request, res: Response) {
    try {
      const stats = EnhancedCacheService.getStats();
      const size = await EnhancedCacheService.getSize();
      const memoryUsage = await EnhancedCacheService.getMemoryUsage();

      res.json({
        success: true,
        data: {
          ...stats,
          cacheSize: size,
          memoryUsage,
        },
      });
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics',
      });
    }
  }

  /**
   * Clear all cache
   * DELETE /api/v1/admin/cache
   */
  static async clearAll(req: Request, res: Response) {
    try {
      await EnhancedCacheService.clear();
      logger.info('All cache cleared by admin', { userId: req.user?.id });

      res.json({
        success: true,
        message: 'All cache cleared successfully',
      });
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
      });
    }
  }

  /**
   * Clear cache by pattern
   * DELETE /api/v1/admin/cache/pattern
   */
  static async clearByPattern(req: Request, res: Response) {
    try {
      const { pattern } = req.body;

      if (!pattern) {
        return res.status(400).json({
          success: false,
          message: 'Pattern is required',
        });
      }

      await EnhancedCacheService.invalidate(pattern);
      logger.info('Cache cleared by pattern', {
        pattern,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
      });
    } catch (error) {
      logger.error('Failed to clear cache by pattern', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
      });
    }
  }

  /**
   * Warm cache
   * POST /api/v1/admin/cache/warm
   */
  static async warmCache(req: Request, res: Response) {
    try {
      const { entity = 'all' } = req.body;
      logger.info('Cache warm requested', { entity, userId: req.user?.id });

      res.json({
        success: true,
        message: `Cache warm request accepted for: ${entity}`,
      });
    } catch (error) {
      logger.error('Failed to warm cache', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to warm cache',
      });
    }
  }

  /**
   * Reset cache statistics
   * POST /api/v1/admin/cache/stats/reset
   */
  static async resetStats(req: Request, res: Response) {
    try {
      CacheStatsTracker.reset();
      logger.info('Cache stats reset by admin', { userId: req.user?.id });

      res.json({
        success: true,
        message: 'Cache statistics reset successfully',
      });
    } catch (error) {
      logger.error('Failed to reset cache stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to reset statistics',
      });
    }
  }

  /**
   * Get cache health
   * GET /api/v1/admin/cache/health
   */
  static async getHealth(req: Request, res: Response) {
    try {
      const stats = EnhancedCacheService.getStats();
      const size = await EnhancedCacheService.getSize();
      const memoryUsage = await EnhancedCacheService.getMemoryUsage();

      const hitRate = parseFloat(stats.hitRate);
      const health = {
        status: hitRate > 70 ? 'healthy' : hitRate > 40 ? 'degraded' : 'poor',
        hitRate: stats.hitRate,
        cacheSize: size,
        memoryUsage,
        recommendations: [] as string[],
      };

      if (hitRate < 40) {
        health.recommendations.push('Consider warming cache more frequently');
        health.recommendations.push('Review cache TTL settings');
      }

      if (hitRate < 70) {
        health.recommendations.push('Monitor cache invalidation patterns');
      }

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      logger.error('Failed to get cache health', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get cache health',
      });
    }
  }
}
