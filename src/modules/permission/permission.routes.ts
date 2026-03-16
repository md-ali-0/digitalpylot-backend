import { authenticate, authorizePermissions } from '@middlewares/auth.middleware';
import { Router } from 'express';
import { PermissionController } from './permission.controller';

export class PermissionRoutes {
  public router: Router;
  private controller: PermissionController;

  constructor() {
    this.router = Router();
    this.controller = new PermissionController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticate);
    this.router.get(
      '/',
      authorizePermissions(['permissions:read']),
      this.controller.getCatalog,
    );
  }
}
