import { authenticate, authorizePermissions } from '@middlewares/auth.middleware';
import { Router } from 'express';
import { AuditLogController } from './audit-log.controller';

export class AuditLogRoutes {
  public router: Router;
  private controller: AuditLogController;

  constructor() {
    this.router = Router();
    this.controller = new AuditLogController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticate);
    this.router.get('/', authorizePermissions(['audit:read']), this.controller.list);
  }
}
