import prisma from '@config/db';
import i18n from '@config/i18n-compat';
import redisClient from '@config/redis';
import { authenticate } from '@middlewares/auth.middleware';
import { Router } from 'express';
import os from 'os';

// Helper function to format uptime
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  return `${days}d ${hours}h ${minutes}m ${Math.floor(seconds)}s`;
};

export class HealthRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public health check endpoint
    this.router.get('/', async (req, res) => {
      try {
        // Check Redis connection
        let redisStatus = 'disconnected';
        try {
          const pingResult = await redisClient.ping();
          redisStatus = pingResult === 'PONG' ? 'connected' : 'error';
        } catch (error) {
          redisStatus = 'error';
        }

        // Check Database connection
        let dbStatus = 'disconnected';
        try {
          // Simple query to check DB connection
          await prisma.$queryRaw`SELECT 1`;
          dbStatus = 'connected';
        } catch (error) {
          dbStatus = 'error';
        }

        const healthInfo = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: `${Math.floor(process.uptime())} seconds`,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          services: {
            redis: redisStatus,
            database: dbStatus,
          },
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
          },
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          },
          endpoints: {
            api: '/api/v1',
            health: '/health',
          },
        };

        res.status(200).json(healthInfo);
      } catch (error) {
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          message: i18n.__('health.check_failed'),
          error: error instanceof Error ? error.message : i18n.__('health.unknown_error'),
        });
      }
    });

    // Protected health check with detailed information
    this.router.get('/protected', authenticate, async (req, res) => {
      try {
        // Check Redis connection status
        let redisStatus = 'disconnected';
        let redisInfo: any = {};
        try {
          const pingResult = await redisClient.ping();
          redisStatus = pingResult === 'PONG' ? 'connected' : 'error';

          // Get Redis info
          const redisDbSize = await redisClient.dbsize();
          redisInfo = {
            dbSize: redisDbSize,
            version: await redisClient
              .info('server')
              .then((info) => {
                const lines = info.split('\r\n');
                const versionLine = lines.find((line) => line.startsWith('redis_version:'));
                return versionLine ? versionLine.split(':')[1] : 'unknown';
              })
              .catch(() => 'unknown'),
          };
        } catch (error) {
          redisStatus = 'error';
          redisInfo = {
            error: error instanceof Error ? error.message : i18n.__('health.unknown_error'),
          };
        }

        // Check Database connection status with additional info
        let dbStatus = 'disconnected';
        let dbInfo: any = {};
        try {
          const startTime = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          const responseTime = Date.now() - startTime;
          dbStatus = 'connected';

          // Get database version and connection info
          try {
            const versionResult: any = await prisma.$queryRaw`SELECT version() as version`;
            const dbSizeResult: any =
              await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;

            dbInfo = {
              responseTime: `${responseTime}ms`,
              version: versionResult[0]?.version || 'unknown',
              size: dbSizeResult[0]?.size || 'unknown',
              connectionPool: {
                database: process.env.DATABASE_URL ? 'configured' : 'not configured',
              },
            };
          } catch (infoError) {
            dbInfo = {
              responseTime: `${responseTime}ms`,
              error: i18n.__('health.db_info_error'),
            };
          }
        } catch (error) {
          dbStatus = 'error';
          dbInfo = {
            error: error instanceof Error ? error.message : i18n.__('health.unknown_error'),
          };
        }

        // Get detailed memory usage
        const memoryUsage = process.memoryUsage();
        const memoryInfo = {
          rss: {
            bytes: memoryUsage.rss,
            mb: Math.round(memoryUsage.rss / 1024 / 1024),
          },
          heapTotal: {
            bytes: memoryUsage.heapTotal,
            mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          },
          heapUsed: {
            bytes: memoryUsage.heapUsed,
            mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          },
          external: {
            bytes: memoryUsage.external,
            mb: Math.round(memoryUsage.external / 1024 / 1024),
          },
          arrayBuffers: {
            bytes: memoryUsage.arrayBuffers,
            mb: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
          },
        };

        // Get process and system information
        const systemInfo = {
          node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            ppid: process.ppid,
            cwd: process.cwd(),
          },
          uptime: {
            process: {
              seconds: Math.floor(process.uptime()),
              formatted: formatUptime(process.uptime()),
            },
            system: {
              seconds: Math.floor(os.uptime()),
              formatted: formatUptime(os.uptime()),
            },
          },
          cpu: {
            usage: process.cpuUsage(),
            architecture: os.arch(),
            cores: os.cpus().length,
          },
          environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
          },
        };

        // Prepare user information (sanitized)
        const userInfo = {
          id: req.user?.id,
          email: req.user?.email,
          role: req.user?.role,
          status: req.user?.status,
          advertiser: (req.user as any)?.advertiserProfile
            ? {
                id: (req.user as any).advertiserProfile.id,
                companyName: (req.user as any).advertiserProfile.companyName,
                status: (req.user as any).advertiserProfile.status,
              }
            : null,
          affiliate: (req.user as any)?.affiliateProfile
            ? {
                id: (req.user as any).affiliateProfile.id,
                status: (req.user as any).affiliateProfile.status,
              }
            : null,
        };

        // API endpoints information
        const endpoints = {
          api: {
            base: '/api/v1',
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            categories: '/api/v1/categories',
            brands: '/api/v1/brands',
            attributes: '/api/v1/attributes',
            products: '/api/v1/products',
            reviews: '/api/v1/reviews',
            files: '/api/v1/files',
            vendors: '/api/v1/vendors',
            system: '/api/v1/system',
          },
          health: {
            public: '/health',
            protected: '/health/protected',
          },
        };

        const detailedHealthInfo = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: `${Math.floor(process.uptime())} seconds`,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          services: {
            redis: {
              status: redisStatus,
              info: redisInfo,
            },
            database: {
              status: dbStatus,
              info: dbInfo,
            },
          },
          system: systemInfo,
          memory: memoryInfo,
          user: userInfo,
          endpoints,
        };

        res.status(200).json(detailedHealthInfo);
      } catch (error) {
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          message: i18n.__('health.detailed_check_failed'),
          error: error instanceof Error ? error.message : i18n.__('health.unknown_error'),
        });
      }
    });
  }

  public getRouter(): Router {
    return this.router;
  }
}
