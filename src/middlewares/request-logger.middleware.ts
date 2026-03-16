import logger from '@config/winston';
import type { NextFunction, Request, Response } from 'express';

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds

    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    const requestId = req.id || 'N/A'; // Use the request ID if available

    logger.info(
      `[${requestId}] ${method} ${originalUrl} - ${statusCode} - ${duration.toFixed(2)}ms from ${ip}`,
    );
  });

  next();
};
