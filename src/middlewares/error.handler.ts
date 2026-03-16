/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { HTTP_STATUS, NODE_ENV } from '@config/constants';
import i18n from '@config/i18n-compat';
import Sentry from '@config/sentry';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import { buildResponse } from '@core/response.utils';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError, ZodIssue } from 'zod';

interface ValidationApiError extends ApiError {
  details?: Array<{ path: string; message: string }>;
}

/**
 * Global error handling middleware.
 * Catches all errors, logs them, and sends appropriate responses.
 */

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  let error = err as Error & {
    statusCode?: number;
    isOperational?: boolean;
    translationKey?: string | string[];
    translationParams?: Record<string, unknown>;
    details?: Array<{ path: string; message: string }>;
    code?: string;
    meta?: Record<string, unknown>;
    name?: string;
    constraint?: string;
  };

  // If it's not an operational error, convert it to a generic InternalServerError
  if (!(error instanceof ApiError)) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const errors: Array<{ path: string; message: string }> = error.issues.map((e: ZodIssue) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      error = new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        i18n.__('validation_failed'),
        true,
        'validation_failed',
        { errors },
      ) as ApiError & { details: Array<{ path: string; message: string }> };
      // Attach validation errors to the error object for detailed response
      error.details = errors;
    }
    // Handle Prisma errors
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: Unique constraint violation
      if (error.code === 'P2002') {
        const fields = (error.meta?.target as string[] | undefined) || [];
        const fieldNames = fields.length > 0 ? fields.join(', ') : 'field';
        error = new ApiError(
          HTTP_STATUS.CONFLICT,
          `A record with this ${fieldNames} already exists`,
          true,
          'duplicate_entry',
          { fields, constraint: error.meta?.target },
        );
      }
      // P2025: Record not found (e.g., for update/delete where record doesn't exist)
      else if (error.code === 'P2025') {
        const cause = error.meta?.cause as string | undefined;
        error = new ApiError(
          HTTP_STATUS.NOT_FOUND,
          cause || 'Record not found',
          true,
          'record_not_found',
          { cause },
        );
      }
      // P2003: Foreign key constraint failed
      else if (error.code === 'P2003') {
        const field = error.meta?.field_name as string | undefined;
        error = new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          field ? `Invalid reference: ${field} does not exist` : 'Foreign key constraint failed',
          true,
          'foreign_key_constraint_failed',
          { field },
        );
      }
      // P2014: Invalid ID
      else if (error.code === 'P2014') {
        error = new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid ID format provided',
          true,
          'invalid_id',
        );
      }
      // P2023: Inconsistent column data
      else if (error.code === 'P2023') {
        error = new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid data format provided',
          true,
          'invalid_data_format',
        );
      }
      // Generic Prisma error
      else {
        error = ApiError.InternalServerError('Database operation failed', 'database_error');
        // Log the original Prisma error for debugging
        logger.error('Original Prisma Error:', {
          code: error.code,
          meta: error.meta,
          message: error.message,
        });
      }
    }
    // Handle other unexpected errors
    else {
      // Log the actual error with proper logger
      logger.error('Unexpected error occurred', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      error = ApiError.InternalServerError(
        i18n.__('internal_server_error'),
        'internal_server_error',
      );
    }
  }

  // Log the error
  if (error.isOperational) {
    logger.warn(`Operational Error: ${error.message}`, {
      statusCode: error.statusCode,
      requestId: (req as any).id,
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      stack: error.stack,
    });
  } else {
    logger.error(`Non-Operational Error: ${error.message}`, {
      statusCode: error.statusCode,
      requestId: (req as any).id,
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      stack: error.stack,
    });
    // Send to Sentry for non-operational errors in production
    if (NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }

  // Send error response
  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = error.translationKey
    ? i18n.__(error.translationKey as string, error.translationParams)
    : error.message;

  // For validation errors, include details if available
  const validationError = error as ValidationApiError;
  if (validationError.details && statusCode === HTTP_STATUS.BAD_REQUEST) {
    // Send validation error response with detailed field errors
    const response = buildResponse(false, message, statusCode, undefined, undefined, {
      type: 'ValidationError',
      message: message,
      path: req.path,
      timestamp: new Date().toISOString(),
      validationErrors: validationError.details,
      ...(NODE_ENV === 'development' && error.stack ? { stack: error.stack } : {}),
    });
    return res.status(statusCode).json(response);
  }

  // For Prisma errors, provide more context
  if (
    'code' in error &&
    error.code &&
    typeof error.code === 'string' &&
    error.code.startsWith('P')
  ) {
    const response = buildResponse(false, message, statusCode, undefined, undefined, {
      type: 'DatabaseError',
      code: error.code,
      message: message,
      path: req.path,
      timestamp: new Date().toISOString(),
      ...('meta' in error && error.meta ? { details: error.meta } : {}),
      ...(NODE_ENV === 'development' && error.stack ? { stack: error.stack } : {}),
    });
    return res.status(statusCode).json(response);
  }

  // Include translationKey as code so clients can handle specific errors (e.g. auth.multiple_accounts, auth.subdomain_taken)
  const code =
    typeof error.translationKey === 'string'
      ? error.translationKey
      : Array.isArray(error.translationKey) && error.translationKey[0]
        ? error.translationKey[0]
        : undefined;

  const response = buildResponse(false, message, statusCode, undefined, undefined, {
    type: error.name || 'Error',
    code: code || statusCode,
    message: message,
    path: req.path,
    timestamp: new Date().toISOString(),
    ...(NODE_ENV === 'development' && error.stack ? { stack: error.stack } : {}),
  });

  res.status(statusCode).json(response);
};
