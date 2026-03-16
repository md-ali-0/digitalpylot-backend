import env from '@config/env';
import logger from '@config/winston';
import * as Sentry from '@sentry/node';

// Initialize Sentry early (must be called before Express is imported)
export const initSentryEarly = () => {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      integrations: [Sentry.expressIntegration()],
      tracesSampleRate: 1.0,
      environment: env.NODE_ENV,
    });
    logger.info('Sentry initialized early.');
  } else {
    logger.warn('SENTRY_DSN not provided. Sentry will not be initialized.');
  }
};

// Setup Express error handler (called after app is created)
export const setupSentryErrorHandler = (app: any) => {
  if (env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
    logger.info('Sentry Express error handler setup complete.');
  }
};

// Legacy function for backward compatibility
export const initSentry = (app: any) => {
  initSentryEarly();
  setupSentryErrorHandler(app);
};

export const closeSentry = async () => {
  if (env.SENTRY_DSN) {
    try {
      await Sentry.close(2000);
      logger.info('Sentry closed.');
    } catch (error) {
      logger.error('Error closing Sentry:', error);
    }
  }
};

export default Sentry;
