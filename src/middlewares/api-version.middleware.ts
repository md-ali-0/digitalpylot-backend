import { NextFunction, Request, Response } from 'express';

/**
 * Add API version headers to all responses
 */
export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add API version header
  res.setHeader('X-API-Version', 'v1');

  // Add deprecation warning if needed (for future v2)
  res.setHeader('X-API-Deprecation', 'false');

  // Add response time tracking
  const start = Date.now();

  // Override res.send to add response time
  const originalSend = res.send.bind(res);
  res.send = function (data: unknown) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalSend(data);
  };

  next();
};

/**
 * Add request ID to response headers
 */
export const requestIdHeaderMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.id) {
    res.setHeader('X-Request-ID', req.id);
  }
  next();
};
