import compression from 'compression';
import { Express } from 'express';

/**
 * Configure response compression
 * Compresses responses to reduce bandwidth and improve performance
 */
export const setupCompression = (app: Express) => {
  app.use(
    compression({
      // Only compress responses larger than 1KB
      threshold: 1024,
      // Compression level (0-9, where 9 is maximum compression)
      level: 6,
      // Filter function to determine what to compress
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers['x-no-compression']) {
          return false;
        }

        // Use compression filter
        return compression.filter(req, res);
      },
    }),
  );
};
