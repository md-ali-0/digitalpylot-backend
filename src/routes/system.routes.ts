import { authenticate } from '@middlewares/auth.middleware';
import { metricsMiddleware } from '@middlewares/metrics.middleware';
import { Router } from 'express';

export class SystemRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Metrics route
    this.router.get('/metrics', metricsMiddleware);

    // System info route
    this.router.get('/info', authenticate, (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: process.memoryUsage().rss,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsed: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cwd: process.cwd(),
      });
    });

    // Test Email Route
    this.router.post('/test-email', authenticate, async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          res.status(400).json({ error: 'Email is required' });
          return;
        }

        const emailService = (await import('@services/email.service')).default;
        const env = (await import('@config/env')).default;

        const success = await emailService.sendEmail({
          to: email,
          subject: 'Test Email System',
          template: 'test-email',
          context: {
            provider: env.EMAIL_PROVIDER || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });

        if (success) {
          res.status(200).json({ message: 'Test email sent successfully' });
        } else {
          res.status(500).json({ error: 'Failed to send test email' });
        }
      } catch (error) {
        const logger = (await import('@config/winston')).default;
        logger.error('Test email error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Swagger Docs - handled by setupSwagger in app.ts
  }

  public getRouter(): Router {
    return this.router;
  }
}
