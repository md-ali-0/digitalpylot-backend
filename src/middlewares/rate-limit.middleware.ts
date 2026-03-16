import i18n from '@config/i18n-compat';
import { ApiError } from '@core/error.classes';
import { rateLimit } from 'express-rate-limit';

/**
 * Global rate limiting middleware.
 * Limits each IP to 1000 requests per 15 minutes.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(ApiError.TooManyRequests(i18n.__('too_many_requests'), 'too_many_requests'));
  },
});

/**
 * Stricter rate limiting for authentication routes.
 * Limits each IP to 15 requests per 5 minutes.
 */
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // Limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.TooManyRequests(i18n.__('too_many_auth_requests'), 'too_many_auth_requests'));
  },
});

/**
 * API rate limiting for general endpoints.
 * Limits each IP to 200 requests per 15 minutes.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.TooManyRequests(i18n.__('too_many_api_requests'), 'too_many_api_requests'));
  },
});

/**
 * Strict rate limiting for sensitive endpoints.
 * Limits each IP to 10 requests per 10 minutes.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Very strict limit
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res, next) => {
    next(ApiError.TooManyRequests(i18n.__('too_many_strict_requests'), 'too_many_strict_requests'));
  },
});

/**
 * Tracking endpoint rate limiting.
 * Higher limits for tracking endpoints since they're called frequently.
 */
export const trackingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.TooManyRequests(i18n.__('too_many_tracking_requests'), 'too_many_tracking_requests'),
    );
  },
});
