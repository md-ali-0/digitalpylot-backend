/* eslint-disable @typescript-eslint/no-explicit-any */
import { CorsOptions } from 'cors';
import env from './env';

/**
 * CORS configuration for the application
 * Handles cross-origin requests based on environment
 */
export const corsConfig: CorsOptions = {
  // Allow requests from these origins
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins =
      env.NODE_ENV === 'production'
        ? env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || []
        : [
            // Development origins
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3002',
            'http://172.16.0.123:3001',
            'http://172.16.0.123:3002',
          ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // For development, be more permissive but log
    if (env.NODE_ENV === 'development') {
      console.warn(`CORS: Allowing origin ${origin} in development mode`);
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'x-tenant-id',
    'X-Request-ID',
  ],
  exposedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Total-Count',
    'X-Page-Count',
    'X-Response-Time',
    'X-Request-ID',
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 24 hours
};

export const dynamicCorsConfig = (req: any, callback: any) => {
  let corsOptions: CorsOptions;

  // Check if the request origin is in our allowed list
  const allowedOrigins =
    env.NODE_ENV === 'production'
      ? env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || []
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3002',
        ];

  if (!req.header('Origin') || allowedOrigins.includes(req.header('Origin'))) {
    corsOptions = { ...corsConfig, origin: true };
  } else {
    corsOptions = { ...corsConfig, origin: false };
  }

  callback(null, corsOptions);
};
