import { HTTP_STATUS } from '@config/constants';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import { NextFunction, Request, Response } from 'express';
import { IncomingHttpHeaders } from 'http';

interface DetectionResult {
  detected: boolean;
  type: string;
  pattern: string;
}

interface RequestPart {
  data: unknown;
  name: string;
}

// Common attack patterns
const ATTACK_PATTERNS: Record<string, RegExp[]> = {
  // SQL Injection patterns
  SQL_INJECTION: [
    /('|--|\/\*|\*\/|xp_|exec|execute|sp_|xp_cmdshell)/gi,
    /(union\s+select|insert\s+into|update\s+\w+\s+set|delete\s+from)/gi,
    /(drop\s+table|create\s+table|alter\s+table)/gi,
  ],

  // XSS patterns
  XSS: [
    /(<script|javascript:|on\w+\s*=)/gi,
    /(<iframe|<object|<embed|<applet)/gi,
    /(eval\(|expression\(|vbscript:|jscript:)/gi,
  ],

  // Command injection
  COMMAND_INJECTION: [/(&&|\|\||`|\$\(.*\)|\$\{.*\})/g, /(cat\s+\/|ls\s+\/|pwd|whoami|id\s+-u)/gi],

  // Path traversal
  PATH_TRAVERSAL: [/(\.\.\/|\.\.\\)/g, /(\/etc\/|\/proc\/|\/windows\/|\/system32\/)/gi],
};

/**
 * Check if input contains malicious patterns
 */
const containsMaliciousContent = (input: unknown): DetectionResult => {
  if (typeof input === 'string') {
    // Check each attack pattern category
    for (const [type, patterns] of Object.entries(ATTACK_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return {
            detected: true,
            type,
            pattern: pattern.toString(),
          };
        }
      }
    }
  } else if (Array.isArray(input)) {
    for (const item of input) {
      const result = containsMaliciousContent(item);
      if (result.detected) return result;
    }
  } else if (typeof input === 'object' && input !== null) {
    for (const value of Object.values(input)) {
      const result = containsMaliciousContent(value);
      if (result.detected) return result;
    }
  }

  return { detected: false, type: '', pattern: '' };
};

/**
 * Sanitize input by removing dangerous characters
 */
export const sanitizeInput = (input: unknown): unknown => {
  if (typeof input === 'string') {
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>]/g, '');
    return sanitized;
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
};

// Safe headers that should be excluded from security checks
const SAFE_HEADERS: string[] = [
  'user-agent',
  'accept',
  'accept-language',
  'accept-encoding',
  'content-type',
  'authorization',
  'cookie',
  'referer',
  'origin',
  'host',
  'x-forwarded-for',
  'x-real-ip',
  'x-tenant-id',
];

/**
 * Filter out safe headers and return only non-safe ones for inspection
 */
const filterUnsafeHeaders = (
  headers: IncomingHttpHeaders,
): Record<string, string | string[] | undefined> => {
  const filteredHeaders: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!SAFE_HEADERS.includes(key.toLowerCase())) {
      filteredHeaders[key] = value;
    }
  }
  return filteredHeaders;
};

/**
 * Middleware to detect and prevent malicious input
 */
export const securityMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Define sensitive fields that should be excluded from security checks (for auth purposes)
      // We'll skip security check for specific auth endpoints
      const authPaths: string[] = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/auth/refresh-token',
        '/api/v1/auth/logout',
        '/api/v1/auth/forgot-password',
        '/api/v1/auth/reset-password',
        '/api/v1/auth/verify-email',
      ];
      if (authPaths.some((path) => req.path.includes(path))) {
        // For auth routes, only check non-sensitive fields
        const requestParts: RequestPart[] = [
          { data: req.query, name: 'query' },
          { data: req.params, name: 'params' },
          { data: filterUnsafeHeaders(req.headers), name: 'headers' },
        ];

        for (const part of requestParts) {
          const result = containsMaliciousContent(part.data);
          if (result.detected) {
            logger.warn('Security threat detected', {
              type: result.type,
              pattern: result.pattern,
              part: part.name,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              url: req.url,
            });

            return next(
              new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                `Malicious ${result.type.toLowerCase()} pattern detected`,
                true,
                'security_threat_detected',
              ),
            );
          }
        }

        // Don't sanitize body for auth routes to preserve credentials
        // Sanitize query and params in-place (they are getter-only properties)
        for (const key of Object.keys(req.query)) {
          (req.query as Record<string, unknown>)[key] = sanitizeInput(req.query[key]);
        }
        for (const key of Object.keys(req.params)) {
          (req.params as Record<string, unknown>)[key] = sanitizeInput(req.params[key]);
        }
      } else {
        // For non-auth routes, check everything
        const requestParts: RequestPart[] = [
          { data: req.body, name: 'body' },
          { data: req.query, name: 'query' },
          { data: req.params, name: 'params' },
          { data: filterUnsafeHeaders(req.headers), name: 'headers' },
        ];

        for (const part of requestParts) {
          const result = containsMaliciousContent(part.data);
          if (result.detected) {
            logger.warn('Security threat detected', {
              type: result.type,
              pattern: result.pattern,
              part: part.name,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              url: req.url,
            });

            return next(
              new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                `Malicious ${result.type.toLowerCase()} pattern detected`,
                true,
                'security_threat_detected',
              ),
            );
          }
        }

        // Sanitize inputs
        req.body = sanitizeInput(req.body);
        // Sanitize query and params in-place (they are getter-only properties)
        for (const key of Object.keys(req.query)) {
          (req.query as Record<string, unknown>)[key] = sanitizeInput(req.query[key]);
        }
        for (const key of Object.keys(req.params)) {
          (req.params as Record<string, unknown>)[key] = sanitizeInput(req.params[key]);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Rate limiting by IP with more granular control
 */
export const ipRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    // Clean up old entries
    for (const [clientIp, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(clientIp);
      }
    }

    const clientData = requests.get(ip) || { count: 0, resetTime: now + windowMs };

    if (clientData.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip,
        count: clientData.count,
        maxRequests,
        userAgent: req.headers['user-agent'],
      });

      return next(
        new ApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'Rate limit exceeded',
          true,
          'rate_limit_exceeded',
        ),
      );
    }

    clientData.count++;
    requests.set(ip, clientData);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - clientData.count));
    res.setHeader('X-RateLimit-Reset', new Date(clientData.resetTime).toISOString());

    next();
  };
};

/**
 * Content Security Policy middleware
 */
export const cspMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
      ].join('; '),
    );

    next();
  };
};

/**
 * Security headers middleware
 */
export const securityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Strict transport security
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      [
        'geolocation=()',
        'midi=()',
        'notifications=()',
        'push=()',
        'sync-xhr=()',
        'microphone=()',
        'camera=()',
        'magnetometer=()',
        'gyroscope=()',
        'fullscreen=(self)',
        'payment=()',
      ].join(', '),
    );

    next();
  };
};
