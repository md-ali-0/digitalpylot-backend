import env from '@config/env';
import logger from '@config/winston';
import cors from 'cors';

const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      logger.warn(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Accept-Language', 'X-API-Key'],
  credentials: true, // Allow cookies to be sent with requests
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

export const corsMiddleware = cors(corsOptions);
