import { ApiError } from '@core/error.classes';
import type { NextFunction, Request, Response } from 'express';

const cuidRegex = /^c[a-z0-9]{24}$/i;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateCUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];

    if (!value) {
      return next(
        ApiError.BadRequest(`Missing parameter: ${paramName}`, 'validation.missing_param'),
      );
    }

    if (!cuidRegex.test(value as string) && !uuidRegex.test(value as string)) {
      return next(
        ApiError.BadRequest(
          `Invalid ${paramName} format. Expected CUID or UUID.`,
          'validation.invalid_id',
        ),
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

      if (!cuidRegex.test(value as string) && !uuidRegex.test(value as string)) {
        return next(
          ApiError.BadRequest(
            `Invalid ${paramName} format. Expected CUID or UUID.`,
            'validation.invalid_id',
          ),
        );
      }
    }

    next();
  };
};
