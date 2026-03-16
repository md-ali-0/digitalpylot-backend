import redisClient from '@config/redis';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import type { NextFunction, Request, Response } from 'express';

export const cacheMiddleware = (durationSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl || req.url; // Use originalUrl for consistent keys

    try {
      const cachedResponse = await redisClient.get(key);

      if (cachedResponse) {
        logger.debug(`Cache hit for key: ${key}`);
        return res.send(JSON.parse(cachedResponse));
      }

      // If no cache hit, proceed with the request and cache the response
      const originalSend = res.send;
      res.send = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisClient.setex(key, durationSeconds, JSON.stringify(body)).catch((err) => {
            logger.error(`Failed to cache response for key ${key}:`, err);
          });
          logger.debug(`Caching response for key: ${key} for ${durationSeconds} seconds`);
        }
        return originalSend.call(res, body);
      };
      next();
    } catch (error) {
      logger.error(`Cache middleware error for key ${key}:`, error);
      // If Redis is down or there's a cache error, don't block the request.
      // Just proceed without caching.
      next(ApiError.InternalServerError('Cache service unavailable', 'cache.service_unavailable'));
    }
  };
};

/**
 * Utility function to clear a specific cache key.
 * @param key The cache key to clear.
 */
export const clearCache = async (key: string) => {
  try {
    const deletedCount = await redisClient.del(key);
    if (deletedCount > 0) {
      logger.info(`Cache cleared for key: ${key}`);
    } else {
      logger.debug(`No cache found for key: ${key}`);
    }
  } catch (error) {
    logger.error(`Failed to clear cache for key ${key}:`, error);
  }
};

export const clearCacheByPattern = async (pattern: string) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      const deletedCount = await redisClient.del(...keys);
      logger.info(`Cleared ${deletedCount} cache keys matching pattern: ${pattern}`);
    } else {
      logger.debug(`No cache keys found matching pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error(`Failed to clear cache by pattern ${pattern}:`, error);
  }
};
