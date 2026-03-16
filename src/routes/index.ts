import env from '@config/env';
import { AuditLogRoutes } from '@modules/audit-log/audit-log.routes';
import { AuthRoutes } from '@modules/auth/auth.routes';
import { FileRoutes } from '@modules/file/file.routes';
import { LeadRoutes } from '@modules/lead/lead.routes';
import { PermissionRoutes } from '@modules/permission/permission.routes';
import { RoleRoutes } from '@modules/role/role.route';
import { TaskRoutes } from '@modules/task/task.routes';
import { UserRoutes } from '@modules/user/user.routes';
import { HealthRoutes } from '@routes/health.routes';
import { SystemRoutes } from '@routes/system.routes';
import type { Request, Response } from 'express';
import { Router } from 'express';

export class MainRouter {
  public router: Router;
  private readonly apiPrefix = env.API_PREFIX || '/api/v1';

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

      // CRM & System Modules
      { path: '/roles', handler: new RoleRoutes().router },
      { path: '/permissions', handler: new PermissionRoutes().router },
      { path: '/audit-logs', handler: new AuditLogRoutes().router },
      { path: '/leads', handler: new LeadRoutes().router },
      { path: '/tasks', handler: new TaskRoutes().router },
    ];

    // Dynamically mount all API routes under /api/v1
    routes.forEach(({ path, handler }) => {
      this.router.use(`${this.apiPrefix}${path}`, handler);
    });

    // System routes (also under /api/v1)
    this.router.use(`${this.apiPrefix}/system`, new SystemRoutes().router);
  }
}
