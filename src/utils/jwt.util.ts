import env from '@config/env';
import i18n from '@config/i18n-compat';
import { ApiError } from '@core/error.classes';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'src/types/jwt-signin-options';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
  permissions?: string[];
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  tenantId: string;
}

/**
 * Generates a JWT token.
 */
export const generateToken = (payload: TokenPayload, secret: string, expiresIn: string): string => {
  const options: SignOptions = { expiresIn: expiresIn as StringValue }; // Ensure expiresIn is of type StringValue
  return jwt.sign(payload, secret, options);
};

/**
 * Verifies a JWT token.
 */
export const verifyToken = (token: string, secret: string): TokenPayload => {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.Unauthorized(i18n.__('auth.token_expired'), 'auth.token_expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.Unauthorized(i18n.__('auth.token_invalid'), 'auth.token_invalid');
    }
    throw ApiError.Unauthorized(
      i18n.__('auth.token_verification_failed'),
      'auth.token_verification_failed',
    );
  }
};

/**
 * Generates an access token.
 */
export const generateAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_EXPIRATION as StringValue };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

/**
 * Generates a refresh token.
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = { expiresIn: env.REFRESH_TOKEN_EXPIRATION as StringValue };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

/**
 * Verifies an access token.
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.Unauthorized(i18n.__('auth.token_expired'), 'auth.token_expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.Unauthorized(i18n.__('auth.token_invalid'), 'auth.token_invalid');
    }
    throw ApiError.Unauthorized(
      i18n.__('auth.token_verification_failed'),
      'auth.token_verification_failed',
    );
  }
};

/**
 * Verifies a refresh token.
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.Unauthorized(i18n.__('auth.token_expired'), 'auth.token_expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.Unauthorized(i18n.__('auth.token_invalid'), 'auth.token_invalid');
    }
    throw ApiError.Unauthorized(
      i18n.__('auth.token_verification_failed'),
      'auth.token_verification_failed',
    );
  }
};
