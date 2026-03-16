import { authenticate, authorizePermissions } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { RoleController } from './role.controller';
import { createRoleSchema, roleIdSchema, updateRoleSchema } from './role.validation';

export class RoleRoutes {
  public router: Router;
  private controller: RoleController;

  constructor() {
    this.router = Router();
    this.controller = new RoleController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticate); // Require authentication for all

    this.router.get('/', authorizePermissions(['permissions:read']), this.controller.getRoles);
    this.router.get(
      '/:id',
      authorizePermissions(['permissions:read']),
      validate(roleIdSchema),
      this.controller.getRole,
    );
    this.router.post(
      '/',
      authorizePermissions(['permissions:manage']),
      validate(createRoleSchema),
      this.controller.createRole,
    );
    this.router.patch(
      '/:id',
      authorizePermissions(['permissions:manage']),
      validate(roleIdSchema),
      validate(updateRoleSchema),
      this.controller.updateRole,
    );
    this.router.delete(
      '/:id',
      authorizePermissions(['permissions:manage']),
      validate(roleIdSchema),
      this.controller.deleteRole,
    );
  }
}
