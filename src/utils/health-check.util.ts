import prisma from '@config/db';
import env from '@config/env';
import redisClient from '@config/redis';
import { Request, Response } from 'express';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
  memory?: {
    used: string;
    total: string;
    percentage: string;
  };
}

interface ServiceStatus {
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  error?: string;
}

/**
 * Enhanced health check endpoint
 * GET /health
 */
export const healthCheck = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthCheckResponse = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
    services: {
      database: { status: 'disconnected' },
      redis: { status: 'disconnected' },
    },
  };

  // Check database connection
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = {
      status: 'connected',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    health.services.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'unhealthy';
  }

  // Check Redis connection
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    health.services.redis = {
      status: 'connected',
      responseTime: Date.now() - redisStart,
    };
  } catch (error) {
    health.services.redis = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    // Redis failure is degraded, not unhealthy (app can work without cache)
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  // Add memory usage
  const memUsage = process.memoryUsage();
  health.memory = {
    used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    percentage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`,
  };

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  // Add response time header
  res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);

  res.status(statusCode).json(health);
};

/**
 * Simple liveness probe
 * GET /health/live
 */
export const livenessProbe = (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
};

/**
 * Readiness probe - checks if app is ready to serve traffic
 * GET /health/ready
 */
export const readinessProbe = async (req: Request, res: Response) => {
  try {
    // Check if database is accessible
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
