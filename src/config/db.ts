import logger from '@config/winston';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import env from '@config/env';

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({
  connectionString,
  max: env.DB_POOL_SIZE,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT,
});
const adapter = new PrismaPg(pool);

/**
 * Base Prisma client for event listeners
 */
const basePrisma = new PrismaClient({
  adapter,
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

/**
 * Enhanced Prisma client with query monitoring and performance tracking
 */
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const start = performance.now();
        const result = await query(args);
        const duration = performance.now() - start;

        // Log slow queries (> 500ms) - reduced from 1 second for better monitoring
        if (duration > 500) {
          logger.warn('Slow query detected', {
            model,
            operation,
            duration: `${duration.toFixed(2)}ms`,
            args: JSON.stringify(args).substring(0, 200), // Limit args length
          });
        }

        // Log very slow queries (> 2 seconds) as errors - reduced from 3 seconds
        if (duration > 2000) {
          logger.error('Very slow query detected', {
            model,
            operation,
            duration: `${duration.toFixed(2)}ms`,
            args: JSON.stringify(args).substring(0, 200),
          });
        }

        return result;
      },
    },
  },
});

// Log query events on the base client
basePrisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  }
});

// Log errors on the base client
basePrisma.$on('error', (e) => {
  logger.error('Prisma error', {
    message: e.message,
    target: e.target,
  });
});

// Log warnings on the base client
basePrisma.$on('warn', (e) => {
  logger.warn('Prisma warning', {
    message: e.message,
    target: e.target,
  });
});

export type ExtendedPrismaClient = typeof prisma;
export default prisma;
