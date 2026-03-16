import i18n from '@config/i18n-compat';
import { z } from 'zod';

// Regular user registration schema
export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email(i18n.__('validation.email_invalid'))
      .min(1, i18n.__('validation.email_required')),
    password: z
      .string()
      .min(
        8,
        i18n.__('validation.password_min_length', { min: String(8) }), // ✅ convert number to string
      )
      .max(100, i18n.__('validation.password_max_length', { max: String(100) })),
    name: z.string().min(1, i18n.__('validation.name_required')).optional(),
    userType: z.string().optional(),
    // Affiliate specific fields
    website: z.string().optional(),
    niche: z.string().optional(),
    trafficSource: z.string().optional(),
    additionalInfo: z.record(z.string(), z.any()).optional(),
  }),
});

export const companyRegisterSchema = z.object({
  body: z.object({
    companyName: z.string().min(1, i18n.__('validation.company_name_required')),
    subdomain: z.string().optional(),
    name: z.string().min(1, i18n.__('validation.name_required')),
    email: z.string().email().min(1, i18n.__('validation.email_required')),
    password: z.string().min(8).max(100),
  }),
});

export const advertiserRegisterSchema = z.object({
  body: z.object({
    companyName: z.string().min(1, i18n.__('validation.company_name_required')),
    name: z.string().min(1, i18n.__('validation.name_required')),
    email: z.string().email().min(1, i18n.__('validation.email_required')),
    password: z.string().min(8).max(100),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email(i18n.__('validation.email_invalid'))
      .min(1, i18n.__('validation.email_required')),
    password: z.string().min(1, i18n.__('validation.password_required')),
    tenantId: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email(i18n.__('validation.email_invalid'))
      .min(1, i18n.__('validation.email_required')),
    tenantId: z.string().optional(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, i18n.__('validation.token_required')),
      password: z
        .string()
        .min(8, i18n.__('validation.password_min_length', { min: String(8) }))
        .max(100, i18n.__('validation.password_max_length', { max: String(100) })),
      confirmPassword: z.string().min(1, i18n.__('validation.password_confirmation_required')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: i18n.__('validation.passwords_do_not_match'),
      path: ['confirmPassword'],
    }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email(i18n.__('validation.email_invalid'))
      .min(1, i18n.__('validation.email_required')),
    otp: z.string().length(6, i18n.__('validation.otp_must_be_6_digits')),
  }),
});

export const resetPasswordWithOtpSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .email(i18n.__('validation.email_invalid'))
        .min(1, i18n.__('validation.email_required')),
      otp: z.string().length(6, i18n.__('validation.otp_must_be_6_digits')),
      password: z
        .string()
        .min(8, i18n.__('validation.password_min_length', { min: String(8) }))
        .max(100, i18n.__('validation.password_max_length', { max: String(100) })),
      confirmPassword: z.string().min(1, i18n.__('validation.password_confirmation_required')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: i18n.__('validation.passwords_do_not_match'),
      path: ['confirmPassword'],
    }),
});

// Email verification schemas
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, i18n.__('validation.verification_token_required')),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email(i18n.__('validation.email_invalid'))
      .min(1, i18n.__('validation.email_required')),
    tenantId: z.string().optional(),
  }),
});

export type {
  AdvertiserRegisterInput,
  CompanyRegisterInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  ResetPasswordWithOtpInput,
  VerifyEmailInput,
  VerifyOtpInput,
} from './auth.interface';
