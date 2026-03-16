import { ApiError } from '@core/error.classes';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware to validate CUID format in route parameters
 * CUID format: starts with 'c', followed by timestamp and random string
 * Example: ckl3q3q3q0000qzqz3q3q3q3q
 * @param paramName - The name of the parameter to validate (default: 'id')
 */
export const validateCUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];

    if (!value) {
      return next(
        ApiError.BadRequest(`Missing parameter: ${paramName}`, 'validation.missing_param'),
      );
    }

    // CUID regex pattern: starts with 'c', length 25, alphanumeric
    const cuidRegex = /^c[a-z0-9]{24}$/i;

    if (!cuidRegex.test(value as string)) {
      return next(
        ApiError.BadRequest(`Invalid ${paramName} format. Expected CUID.`, 'validation.invalid_id'),
      );
    }

    next();
  };
};

/**
 * Middleware to validate multiple CUID parameters
 * @param paramNames - Array of parameter names to validate
 */
export const validateCUIDs = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];

      if (!value) {
        return next(
          ApiError.BadRequest(`Missing parameter: ${paramName}`, 'validation.missing_param'),
        );
      }

      const cuidRegex = /^c[a-z0-9]{24}$/i;

      if (!cuidRegex.test(value as string)) {
        return next(
          ApiError.BadRequest(
            `Invalid ${paramName} format. Expected CUID.`,
            'validation.invalid_id',
          ),
        );
      }
    }

    next();
  };
};
