import type { TError, TMeta, TResponse } from './base.interface';

export function buildResponse<T>(
  success: boolean,
  message: string,
  statusCode: number,
  data?: T,
  meta?: TMeta,
  error?: Partial<TError>,
): TResponse<T> {
  return {
    success,
    message,
    statusCode,
    ...(data && { data }),
    ...(meta && { meta }),
    ...(error && {
      error: {
        code: error.code || statusCode,
        message: error.message || message,
        path: error.path || '',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack || '' }),
      },
    }),
  };
}
