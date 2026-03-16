/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsConfig } from '@config/cors';
import env from '@config/env';
import redisClient from '@config/redis';
import { setupSentryErrorHandler } from '@config/sentry';
import { errorHandler } from '@middlewares/error.handler';
import { i18nMiddleware } from '@middlewares/i18n.middleware';
import { metricsMiddleware } from '@middlewares/metrics.middleware';
import { globalRateLimiter } from '@middlewares/rate-limit.middleware';
import { requestIdMiddleware } from '@middlewares/request-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import {
  cspMiddleware,
  securityHeaders,
  securityMiddleware,
} from '@middlewares/security.middleware';
import { MainRouter } from '@routes/index';
import { NotFoundRoutes } from '@routes/not-found.routes';
import { DatabasePoolMonitor } from '@utils/db-monitor';
import { performanceMiddleware } from '@utils/performance';
import { RbacService } from '@services/rbac.service';
import compression from 'compression';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import prisma from './config/db';
import { facebookStrategy, jwtStrategy } from './config/passport';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    void RbacService.ensureInfrastructure();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeMonitoring();
  }

  private initializeMiddlewares() {
    // Setup Sentry Express error handler (Sentry is already initialized)
    setupSentryErrorHandler(this.app);
    // Core Middlewares
    this.app.use(
      express.json({
        limit: '50mb',
        verify: (req: any, res, buf) => {
          req.rawBody = buf;
        },
      }),
    ); // Body parser for JSON (increased to 50mb)
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Body parser for URL-encoded data
    this.app.use(cookieParser()); // Cookie parser

    // Session management for Passport.js
    this.app.use(
      session({
        store: new RedisStore({ client: redisClient }),
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: env.NODE_ENV === 'production', // Use secure cookies in production
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          sameSite: 'lax', // SameSite setting for security
        },
      }) as any,
    );

    // Passport.js initialization
    passport.use(jwtStrategy);
    passport.use(facebookStrategy);

    // Serialization for session support
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user as any);
      } catch (err) {
        done(err, null);
      }
    });

    this.app.use(passport.initialize() as any);
    this.app.use(passport.session() as any);

    this.app.use(cors(corsConfig)); // CORS protection
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
        frameguard: {
          action: 'deny',
        },
        hidePoweredBy: true,
        noSniff: true,
        xssFilter: true,
      }),
    ); // Security headers
    this.app.use(securityHeaders()); // Additional security headers
    this.app.use(cspMiddleware()); // Content Security Policy
    this.app.use(securityMiddleware()); // Security threat detection
    this.app.use(performanceMiddleware()); // Performance monitoring
    this.app.use(morgan('dev')); // HTTP request logger
    this.app.use(requestIdMiddleware); // Add unique request ID
    this.app.use(requestLoggerMiddleware); // Log requests with request ID
    this.app.use(metricsMiddleware); // Use correct metrics middleware
    this.app.use(i18nMiddleware);
    this.app.use(compression()); // Compress response bodies
    this.app.use(globalRateLimiter); // Apply global rate limiting
  }

  private initializeRoutes() {
    // Serve static files from public directory
    this.app.use(express.static('public'));

    // Serve static files for local storage (if using LOCAL provider)
    if (env.STORAGE_TYPE === 'LOCAL') {
      this.app.use('/uploads', express.static('uploads'));
    }
    // API Routes
    const mainRouter = new MainRouter();
    this.app.use('/', mainRouter.router);

    // Handle favicon requests
    this.app.get('/favicon.ico', (req, res) => {
      res.sendFile('favicon.ico', { root: 'public' });
    });
    // Catch-all for undefined routes
    const notFoundRoutes = new NotFoundRoutes();
    this.app.use(notFoundRoutes.router);
  }

  private initializeErrorHandling() {
    // Sentry error handler is set up in initSentry
    // Custom error handling middleware
    this.app.use(errorHandler);
  }

  private initializeMonitoring() {
    // Start database pool monitoring
    DatabasePoolMonitor.start(30000); // Every 30 seconds

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      DatabasePoolMonitor.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      DatabasePoolMonitor.stop();
      process.exit(0);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

export default new App().getApp();
