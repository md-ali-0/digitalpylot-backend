import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import logger from './winston';

// Load base .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Load environment-specific file based on NODE_ENV only if it exists
const nodeEnv = process.env.NODE_ENV || 'development';
const envLocalPath = path.resolve(__dirname, '../../.env.local');
const envProductionPath = path.resolve(__dirname, '../../.env.production');

if (nodeEnv === 'production' && fs.existsSync(envProductionPath)) {
  dotenv.config({ path: envProductionPath, override: true });
} else if (nodeEnv === 'development' && fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

interface Env {
  NODE_ENV: string;
  PORT: number;
  API_URL: string;
  API_PREFIX: string;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_USER: string;
  REDIS_PASSWORD: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_EXPIRATION: string;
  REFRESH_TOKEN_EXPIRATION: string;
  SENTRY_DSN?: string;
  SESSION_SECRET: string;
  CORS_ORIGIN?: string;
  CLIENT_URL?: string;
  CLIENT_URL_PROD?: string;
  DASHBOARD_URL?: string;
  DASHBOARD_URL_PROD?: string;
  STORAGE_TYPE: 'LOCAL' | 'S3' | 'CLOUDINARY' | 'R2';
  // Base URL for file access
  LOCAL_STORAGE_BASE_URL?: string;
  LOCAL_STORAGE_BASE_URL_DEV?: string;
  LOCAL_STORAGE_BASE_URL_PROD?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET_NAME?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  // Cloudflare R2
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
  R2_ENDPOINT?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_REDIRECT_URI?: string;
  // Email Configuration
  EMAIL_HOST?: string;
  EMAIL_PORT?: number;
  EMAIL_USER?: string;
  EMAIL_PASS?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  EMAIL_SECURE?: boolean;
  // SendGrid Configuration
  SENDGRID_API_KEY?: string;
  EMAIL_PROVIDER?: 'nodemailer' | 'sendgrid';
  // Verification Settings
  VERIFICATION_METHOD: 'LINK' | 'OTP' | 'BOTH';
  // Database Pool Configuration
  DB_POOL_SIZE: number;
  DB_POOL_IDLE_TIMEOUT: number;
  DB_POOL_CONNECTION_TIMEOUT: number;
  REVALIDATION_SECRET_KEY: string;
  // Stripe Configuration
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

// Database URL must be provided in all environments
const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error('DATABASE_URL environment variable is required');
};

const env: Env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.parseInt(process.env.PORT || '5000', 10),
  API_URL: process.env.API_URL || 'http://localhost:5000',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  DATABASE_URL: getDatabaseUrl(),
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_USER: process.env.REDIS_USER || 'default',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  // Security: No default secrets - must be provided via environment variables
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  ACCESS_TOKEN_EXPIRATION: process.env.ACCESS_TOKEN_EXPIRATION || '1h',
  REFRESH_TOKEN_EXPIRATION: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  SENTRY_DSN: process.env.SENTRY_DSN,
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  CLIENT_URL: process.env.CLIENT_URL,
  CLIENT_URL_PROD: process.env.CLIENT_URL_PROD,
  DASHBOARD_URL: process.env.DASHBOARD_URL,
  DASHBOARD_URL_PROD: process.env.DASHBOARD_URL_PROD,
  STORAGE_TYPE: (process.env.STORAGE_TYPE as 'LOCAL' | 'S3' | 'CLOUDINARY' | 'R2') || 'LOCAL',
  // Base URL for file access
  LOCAL_STORAGE_BASE_URL: process.env.LOCAL_STORAGE_BASE_URL,
  LOCAL_STORAGE_BASE_URL_DEV: process.env.LOCAL_STORAGE_BASE_URL_DEV || 'http://localhost:5000',
  LOCAL_STORAGE_BASE_URL_PROD: process.env.LOCAL_STORAGE_BASE_URL_PROD || 'https://api.zlivoo.com',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  FACEBOOK_REDIRECT_URI: process.env.FACEBOOK_REDIRECT_URI,
  // Email Configuration
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: Number.parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
  // SendGrid Configuration
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER as 'nodemailer' | 'sendgrid') || 'nodemailer',
  // Verification Settings
  VERIFICATION_METHOD: (process.env.VERIFICATION_METHOD as 'LINK' | 'OTP' | 'BOTH') || 'BOTH',
  // Database Pool Configuration
  DB_POOL_SIZE: Number.parseInt(process.env.DB_POOL_SIZE || '20', 10),
  DB_POOL_IDLE_TIMEOUT: Number.parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
  DB_POOL_CONNECTION_TIMEOUT: Number.parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
  REVALIDATION_SECRET_KEY: process.env.REVALIDATION_SECRET_KEY || '',
  // Stripe Configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
};

// Validate essential environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'REVALIDATION_SECRET_KEY',
];

// Minimum length requirements for security-critical secrets
const SECRET_MIN_LENGTH = 32;

for (const key of requiredEnvVars) {
  const value = env[key as keyof Env];

  if (!value) {
    logger.error(`❌ Missing required environment variable: ${key}`);
    logger.error(`Please set ${key} in your .env file`);
    process.exit(1);
  }

  // Validate secret length for JWT and session secrets
  if (['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'].includes(key)) {
    if (typeof value === 'string' && value.length < SECRET_MIN_LENGTH) {
      logger.error(`❌ ${key} must be at least ${SECRET_MIN_LENGTH} characters long`);
      logger.error(`Current length: ${value.length} characters`);
      logger.error(`Generate a secure secret using: openssl rand -base64 ${SECRET_MIN_LENGTH}`);
      process.exit(1);
    }
  }
}

// Validate storage-specific environment variables
if (env.STORAGE_TYPE === 'S3') {
  const s3Required = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET_NAME',
  ];
  for (const key of s3Required) {
    if (!env[key as keyof Env]) {
      logger.warn(
        `Missing S3 environment variable: ${key}. S3 storage may not function correctly.`,
      );
    }
  }
} else if (env.STORAGE_TYPE === 'CLOUDINARY') {
  const cloudinaryRequired = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  for (const key of cloudinaryRequired) {
    if (!env[key as keyof Env]) {
      logger.warn(
        `Missing Cloudinary environment variable: ${key}. Cloudinary storage may not function correctly.`,
      );
    }
  }
} else if (env.STORAGE_TYPE === 'R2') {
  const r2Required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_ENDPOINT',
  ];
  for (const key of r2Required) {
    if (!env[key as keyof Env]) {
      logger.warn(
        `Missing Cloudflare R2 environment variable: ${key}. R2 storage may not function correctly.`,
      );
    }
  }
}

export default env;

// Export commonly used environment variables as named exports
export const {
  NODE_ENV,
  PORT,
  API_URL,
  API_PREFIX,
  DATABASE_URL,
  REDIS_HOST,
  REDIS_PORT,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION,
  SENTRY_DSN,
  SESSION_SECRET,
  CORS_ORIGIN,
  CLIENT_URL,
  CLIENT_URL_PROD,
  DASHBOARD_URL,
  DASHBOARD_URL_PROD,
  STORAGE_TYPE,
  LOCAL_STORAGE_BASE_URL,
  LOCAL_STORAGE_BASE_URL_DEV,
  LOCAL_STORAGE_BASE_URL_PROD,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  FACEBOOK_REDIRECT_URI,
  // Email Configuration
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
  EMAIL_FROM_NAME,
  EMAIL_SECURE,
  // SendGrid Configuration
  SENDGRID_API_KEY,
  EMAIL_PROVIDER,
  // Verification Settings
  VERIFICATION_METHOD,
  // Database Pool Configuration
  DB_POOL_SIZE,
  DB_POOL_IDLE_TIMEOUT,
  DB_POOL_CONNECTION_TIMEOUT,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  R2_ENDPOINT,
  REVALIDATION_SECRET_KEY,
  // Stripe Configuration
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
} = env;
