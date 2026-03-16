import logger from '@config/winston';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { LeveledLogMethod } from 'winston';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Wraps a Winston log method to inject requestId
 */
function wrapLogMethod(original: LeveledLogMethod, requestId: string): LeveledLogMethod {
  return ((...args: any[]) => {
    // If called as logger.info("message", { meta })
    if (typeof args[0] === 'string') {
      const message = args[0];
      const meta = { ...(args[1] || {}), requestId };
      return original(message, meta);
    }

    // If called as logger.info({ level, message, ... })
    if (typeof args[0] === 'object') {
      return original({ ...args[0], requestId });
    }

    // Fallback: call original with first argument only (to avoid spread error)
    return original(args[0]);
  }) as LeveledLogMethod;
}

/**
 * Middleware to attach a unique requestId to each incoming request
 * and inject it into all logger calls for that request.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Backup original logger methods
  const originalInfo = logger.info.bind(logger);
  const originalError = logger.error.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  const originalHttp = logger.http.bind(logger);
  const originalDebug = logger.debug.bind(logger);

  // Override logger methods for this request
  logger.info = wrapLogMethod(originalInfo, requestId);
  logger.error = wrapLogMethod(originalError, requestId);
  logger.warn = wrapLogMethod(originalWarn, requestId);
  logger.http = wrapLogMethod(originalHttp, requestId);
  logger.debug = wrapLogMethod(originalDebug, requestId);

  // Restore original logger after response is finished
  res.on('finish', () => {
    logger.info = originalInfo;
    logger.error = originalError;
    logger.warn = originalWarn;
    logger.http = originalHttp;
    logger.debug = originalDebug;
  });

  next();
};
