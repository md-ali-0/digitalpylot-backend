import { HTTP_STATUS } from '@config/constants';
import { ApiError } from '@core/error.classes';
import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

interface ValidatedData {
  body?: any;
  query?: any;
  params?: any;
}

/**
 * Global input validation middleware
 * Ensures consistent validation across all endpoints
 */
export const validateInput = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request data
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as ValidatedData;

      // Attach validated data back to request
      // Use Object.defineProperty to handle potential read-only properties
      try {
        req.body = validatedData.body || req.body;
      } catch {
        // If body is read-only, try using defineProperty
        Object.defineProperty(req, 'body', {
          value: validatedData.body || req.body,
          writable: true,
          configurable: true,
        });
      }

      try {
        req.query = validatedData.query || req.query;
      } catch {
        // If query is read-only, try using defineProperty
        Object.defineProperty(req, 'query', {
          value: validatedData.query || req.query,
          writable: true,
          configurable: true,
        });
      }

      try {
        req.params = validatedData.params || req.params;
      } catch {
        // If params is read-only, try using defineProperty
        Object.defineProperty(req, 'params', {
          value: validatedData.params || req.params,
          writable: true,
          configurable: true,
        });
      }

      next();
    } catch (error: any) {
      // Handle validation errors
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return next(
          new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', true, 'validation_failed', {
            errors: validationErrors,
          }),
        );
      }

      next(error);
    }
  };
};

// Export validate as alias for validateInput
export const validate = validateInput;

/**
 * Sanitize input middleware
 * Removes potentially dangerous characters and patterns
 */
export const sanitizeInput = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        // Remove HTML tags
        return obj.replace(/<[^>]*>/g, '');
      } else if (Array.isArray(obj)) {
        return obj.map(sanitize);
      } else if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value);
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    req.params = sanitize(req.params);

    next();
  };
};

/**
 * Strict validation middleware for sensitive endpoints
 * Applies additional security checks
 */
export const strictValidation = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate with additional security checks
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as ValidatedData;

      // Additional security checks
      const securityChecks = [
        // Check for SQL injection patterns
        /('|--|\/\*|\*\/|xp_|exec|execute|sp_|xp_cmdshell)/gi,
        // Check for XSS patterns
        /(<script|javascript:|on\w+\s*=)/gi,
        // Check for command injection
        /(&|&&|\||\|\||;|`|\$\(.*\)|\$\{.*\})/g,
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return securityChecks.some((pattern) => pattern.test(value));
        } else if (Array.isArray(value)) {
          return value.some(checkValue);
        } else if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      const hasMaliciousContent =
        checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

      if (hasMaliciousContent) {
        return next(
          new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Malicious content detected',
            true,
            'malicious_content_detected',
          ),
        );
      }

      // Attach validated data
      req.body = validatedData.body || req.body;
      req.query = validatedData.query || req.query;
      req.params = validatedData.params || req.params;

      next();
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return next(
          new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', true, 'validation_failed', {
            errors: validationErrors,
          }),
        );
      }

      next(error);
    }
  };
};
