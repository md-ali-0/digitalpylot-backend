import logger from '@config/winston';
import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000], // buckets for response time
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code'],
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);

/**
 * Middleware to collect HTTP request metrics.
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  const route = req.route ? req.route.path : req.path; // Use req.route.path for parameterized routes

  res.on('finish', () => {
    const statusCode = res.statusCode.toString();
    httpRequestsTotal.labels(req.method, route, statusCode).inc();
    end({ method: req.method, route, code: statusCode });
  });

  next();
};

/**
 * Express route to expose Prometheus metrics.
 */
export const metricsRoute = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
};

logger.info('Prometheus metrics initialized.');
