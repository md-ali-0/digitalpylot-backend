import { authenticate } from '@middlewares/auth.middleware';
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

    // TODO: Add permission checks (e.g. 'role.read', 'role.manage')
    // For now, allow authenticated users (or restrict to ADMIN)
    // this.router.use(authorizeRoles([UserRole.ADMIN])); // If reusing enum or string check

    this.router.get('/', this.controller.getRoles);
    this.router.get('/:id', validate(roleIdSchema), this.controller.getRole);
    this.router.post('/', validate(createRoleSchema), this.controller.createRole);
    this.router.patch(
      '/:id',
      validate(roleIdSchema),
      validate(updateRoleSchema),
      this.controller.updateRole,
    );
    this.router.delete('/:id', validate(roleIdSchema), this.controller.deleteRole);
  }
}
