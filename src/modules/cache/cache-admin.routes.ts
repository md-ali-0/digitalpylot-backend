import { authenticate, authorizeRoles } from '@middlewares/auth.middleware';
import { Router } from 'express';
import { CacheAdminController } from './cache-admin.controller';

const router = Router();

// All cache admin routes require ADMIN role
router.use(authenticate, authorizeRoles(['ADMIN']));

/**
 * @route GET /api/v1/admin/cache/stats
 * @desc Get cache statistics
 * @access Admin
 */
router.get('/stats', CacheAdminController.getStats);

/**
 * @route GET /api/v1/admin/cache/health
 * @desc Get cache health status
 * @access Admin
 */
router.get('/health', CacheAdminController.getHealth);

/**
 * @route DELETE /api/v1/admin/cache
 * @desc Clear all cache
 * @access Admin
 */
router.delete('/', CacheAdminController.clearAll);

/**
 * @route DELETE /api/v1/admin/cache/pattern
 * @desc Clear cache by pattern
 * @access Admin
 */
router.delete('/pattern', CacheAdminController.clearByPattern);

/**
 * @route POST /api/v1/admin/cache/warm
 * @desc Warm cache
 * @access Admin
 */
router.post('/warm', CacheAdminController.warmCache);

/**
 * @route POST /api/v1/admin/cache/stats/reset
 * @desc Reset cache statistics
 * @access Admin
 */
router.post('/stats/reset', CacheAdminController.resetStats);

export default router;
