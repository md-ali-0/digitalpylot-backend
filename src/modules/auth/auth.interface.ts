/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RegisterBody {
  email: string;
  password: string;
  name?: string;
  tenantId?: string;
  userType?: string;
  // Affiliate specific fields
  website?: string;
  niche?: string;
  trafficSource?: string;
  additionalInfo?: Record<string, any>;
}

export interface CompanyRegisterBody {
  companyName: string;
  subdomain?: string;
  email: string;
  name: string;
  password: string;
}

export interface AdvertiserRegisterBody {
  companyName: string;
  email: string;
  name: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
  tenantId?: string;
  platform?: string;
}

export interface ForgotPasswordBody {
  email: string;
  tenantId?: string;
}

export interface ResetPasswordBody {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyOtpBody {
  email: string;
  otp: string;
}

export interface ResetPasswordWithOtpBody {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyEmailBody {
  token: string;
}

export interface ResendVerificationBody {
  email: string;
  tenantId?: string;
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

// Export types inferred from validation schemas
export type RegisterInput = {
  body: RegisterBody;
};

export type CompanyRegisterInput = {
  body: CompanyRegisterBody;
};

export type AdvertiserRegisterInput = {
  body: AdvertiserRegisterBody;
};

export type LoginInput = {
  body: LoginBody;
};

export type ForgotPasswordInput = {
  body: ForgotPasswordBody;
};

export type ResetPasswordInput = {
  body: ResetPasswordBody;
};

export type VerifyOtpInput = {
  body: VerifyOtpBody;
};

export type ResetPasswordWithOtpInput = {
  body: ResetPasswordWithOtpBody;
};

export type VerifyEmailInput = {
  body: VerifyEmailBody;
};

export type ResendVerificationInput = {
  body: ResendVerificationBody;
};
