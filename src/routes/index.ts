import { AuthRoutes } from '@modules/auth/auth.routes';
import { FileRoutes } from '@modules/file/file.routes';
import { NotificationRoutes } from '@modules/notification/notification.routes';
import { RoleRoutes } from '@modules/role/role.route';
import { UserRoutes } from '@modules/user/user.routes';
import { HealthRoutes } from '@routes/health.routes';
import { SystemRoutes } from '@routes/system.routes';
import type { Request, Response } from 'express';
import { Router } from 'express';

export class MainRouter {
  public router: Router;
  private readonly apiPrefix = '/api/v1';

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Redirect root to health endpoint
    this.router.get('/', (req: Request, res: Response) => {
      res.redirect('/health');
    });

    // Health route (available at root level)
    this.router.use('/health', new HealthRoutes().router);

    // API routes configuration
    const routes: { path: string; handler: Router }[] = [
      // Core modules
      { path: '/auth', handler: new AuthRoutes().router },
      { path: '/users', handler: new UserRoutes().router },
      { path: '/files', handler: new FileRoutes().router },
      { path: '/notifications', handler: new NotificationRoutes().getRouter() },

      // New Role Modules
      { path: '/roles', handler: new RoleRoutes().router },
    ];

    // Dynamically mount all API routes under /api/v1
    routes.forEach(({ path, handler }) => {
      this.router.use(`${this.apiPrefix}${path}`, handler);
    });

    // System routes (also under /api/v1)
    this.router.use(`${this.apiPrefix}/system`, new SystemRoutes().router);
  }
}
