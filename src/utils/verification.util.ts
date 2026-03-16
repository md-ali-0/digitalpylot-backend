import env from '@config/env';
import i18n from '@config/i18n-compat';
import { ApiError } from '@core/error.classes';
import jwt from 'jsonwebtoken';
import { StringValue } from 'src/types/jwt-signin-options';

export interface UserVerificationPayload {
  userId: string;
  email: string;
  type: 'user-registration' | 'vendor-registration' | 'advertiser-registration';
}

export interface PasswordResetPayload {
  userId: string;
  email: string;
  type: 'password-reset';
}

/**
 * Generates a user verification token with 1-hour expiration
 */
export const generateUserVerificationToken = (payload: UserVerificationPayload): string => {
  const options = { expiresIn: '1h' as StringValue };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

/**
 * Generates a password reset token with 1-hour expiration
 */
export const generatePasswordResetToken = (payload: PasswordResetPayload): string => {
  const options = { expiresIn: '1h' as StringValue };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

/**
 * Verifies a user verification token
 */
export const verifyUserVerificationToken = (token: string): UserVerificationPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as UserVerificationPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.BadRequest(i18n.__('auth.token_expired'), 'auth.token_expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.BadRequest(i18n.__('auth.token_invalid'), 'auth.token_invalid');
    }
    throw ApiError.BadRequest(
      i18n.__('auth.token_verification_failed'),
      'auth.token_verification_failed',
    );
  }
};

/**
 * Verifies a password reset token
 */
export const verifyPasswordResetToken = (token: string): PasswordResetPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as PasswordResetPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.BadRequest(i18n.__('auth.token_expired'), 'auth.token_expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.BadRequest(i18n.__('auth.token_invalid'), 'auth.token_invalid');
    }
    throw ApiError.BadRequest(
      i18n.__('auth.token_verification_failed'),
      'auth.token_verification_failed',
    );
  }
};
