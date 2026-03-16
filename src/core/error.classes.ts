/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTP_STATUS } from '@config/constants';

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public translationKey?: string | string[];
  public translationParams?: Record<string, any>;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
    stack = '',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.translationKey = translationKey;
    this.translationParams = translationParams;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Helper methods for common HTTP errors
  static BadRequest(
    message = 'Bad Request',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, true, translationKey, translationParams);
  }

  static Unauthorized(
    message = 'Unauthorized',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, true, translationKey, translationParams);
  }

  static Forbidden(
    message = 'Forbidden',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, true, translationKey, translationParams);
  }

  static NotFound(
    message = 'Not Found',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, true, translationKey, translationParams);
  }

  static Conflict(
    message = 'Conflict',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, true, translationKey, translationParams);
  }

  static UnprocessableEntity(
    message = 'Unprocessable Entity',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      message,
      true,
      translationKey,
      translationParams,
    );
  }

  static TooManyRequests(
    message = 'Too Many Requests',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(
      HTTP_STATUS.TOO_MANY_REQUESTS,
      message,
      true,
      translationKey,
      translationParams,
    );
  }

  static InternalServerError(
    message = 'Internal Server Error',
    translationKey?: string | string[],
    translationParams?: Record<string, any>,
  ) {
    return new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message,
      false,
      translationKey,
      translationParams,
    );
  }
}
