import { RATE_LIMITS } from '@config/app-constants';
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register, etc.)
 * Limits: 5 requests per 15 minutes
 */
export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.WINDOW_MS,
  max: RATE_LIMITS.AUTH.MAX_REQUESTS,
  message: RATE_LIMITS.AUTH.MESSAGE,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for password reset endpoints
 * Limits: 3 requests per hour
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: RATE_LIMITS.PASSWORD_RESET.MAX_REQUESTS,
  message: RATE_LIMITS.PASSWORD_RESET.MESSAGE,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes
 */
export const generalRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.WINDOW_MS,
  max: RATE_LIMITS.GENERAL.MAX_REQUESTS,
  message: RATE_LIMITS.GENERAL.MESSAGE,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Create a custom rate limiter with specific options
 * @param windowMs - Time window in milliseconds
 * @param max - Maximum number of requests
 * @param message - Error message when limit exceeded
 */
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
};
