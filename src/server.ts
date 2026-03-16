/* eslint-disable @typescript-eslint/no-explicit-any */
// Initialize Sentry before importing Express or any files that import Express
import { initSentryEarly } from '@config/sentry';
initSentryEarly();

import env from '@config/env';
import { closeSentry } from '@config/sentry';
import logger from '@config/winston';
import { clickWorker, emailWorker, postbackWorker } from '@jobs/worker'; // Import named exports
import { createServer } from 'http';
import app from './app';

const PORT = env.PORT || 5000;

let server: any;

const startServer = () => {
  const httpServer = createServer(app);

  server = httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);
  });

  // Start the BullMQ workers
  emailWorker.on('ready', () => {
    logger.info('Email worker is ready and listening for jobs.');
  });
  emailWorker.on('closed', () => {
    logger.info('Email worker closed.');
  });

  clickWorker.on('ready', () => {
    logger.info('Click worker is ready and listening for jobs.');
  });
  clickWorker.on('closed', () => {
    logger.info('Click worker closed.');
  });

  postbackWorker.on('ready', () => {
    logger.info('Postback worker is ready and listening for jobs.');
  });
  postbackWorker.on('closed', () => {
    logger.info('Postback worker closed.');
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(`Error: ${err?.name || 'Error'} - ${err?.message || 'No message'}`);
  if (err?.stack) logger.error(err.stack);
  closeSentry().finally(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions with more detailed logging
process.on('uncaughtException', (err: any) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(`Error: ${err?.name || 'Error'} - ${err?.message || 'No message'}`);
  if (err?.stack) logger.error(err.stack);
  if (err?.cause) {
    logger.error('Error cause:', err.cause);
  }
  closeSentry().finally(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Start the server after a small delay to allow for better error capture
setTimeout(() => {
  try {
    startServer();
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}, 100);
