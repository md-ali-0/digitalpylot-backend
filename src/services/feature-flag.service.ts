import prisma from '@config/db';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import { clearCache, clearCacheByPattern } from '@middlewares/cache.middleware';

export class FeatureFlagService {
  private cachePrefix = 'feature_flag';

  async getFeatureFlag(name: string): Promise<any | null> {
    try {
      const flag = await prisma.featureFlag.findUnique({
        where: { name },
      });
      return flag;
    } catch (error) {
      logger.error(`Error getting feature flag ${name}:`, error);
      throw ApiError.InternalServerError('Failed to get feature flag', 'feature_flag.get_error');
    }
  }

  async setFeatureFlag(name: string, isEnabled: boolean, description?: string): Promise<any> {
    try {
      const flag = await prisma.featureFlag.upsert({
        where: { name },
        update: { isEnabled, description },
        create: { name, isEnabled, description, tenantId: 'SYSTEM' },
      });

      await clearCache(`${this.cachePrefix}:${name}`); // Invalidate specific flag cache
      return flag;
    } catch (error) {
      logger.error(`Error setting feature flag ${name}:`, error);
      throw ApiError.InternalServerError('Failed to set feature flag', 'feature_flag.set_error');
    }
  }

  async getAllFeatureFlags(): Promise<any[]> {
    try {
      const flags = await prisma.featureFlag.findMany();
      return flags;
    } catch (error) {
      logger.error('Error getting all feature flags:', error);
      throw ApiError.InternalServerError(
        'Failed to get feature flags',
        'feature_flag.get_all_error',
      );
    }
  }

  async clearAllFeatureFlagsCache(): Promise<void> {
    await clearCacheByPattern(`${this.cachePrefix}:*`);
  }
}
