import { authenticate, authorizePermissions } from '@middlewares/auth.middleware';
import { validateCUID } from '@middlewares/id-validation.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { UserController } from './user.controller';
import {
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  userIdSchema,
} from './user.validation';
export class UserRoutes {
  public router: Router;
  private userController: UserController;

  constructor() {
    this.router = Router();
    this.userController = new UserController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticate);

    this.router.get('/', authorizePermissions(['users:read']), this.userController.getAllUsers);
    this.router.get('/me', this.userController.getProfile);
    this.router.get(
      '/:id',
      authorizePermissions(['users:read']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.getById,
    );
    this.router.get(
      '/:id/permissions',
      authorizePermissions(['permissions:read']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.getPermissions,
    );

    this.router.put('/me', validate(updateUserSchema), this.userController.updateProfile);

    this.router.patch('/me/deactivate', this.userController.deactivateProfile);

    this.router.patch(
      '/me/change-password',
      validate(changePasswordSchema),
      this.userController.changePassword,
    );

    this.router.post(
      '/',
      authorizePermissions(['users:create']),
      validate(createUserSchema),
      this.userController.create,
    );

    this.router.put(
      '/:id',
      authorizePermissions(['users:update']),
      validateCUID('id'),
      validate(userIdSchema),
      validate(updateUserSchema),
      this.userController.update,
    );

    this.router.patch(
      '/:id',
      authorizePermissions(['users:update']),
      validateCUID('id'),
      validate(userIdSchema),
      validate(updateUserSchema),
      this.userController.update,
    );

    this.router.put(
      '/:id/permissions',
      authorizePermissions(['permissions:manage']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.updatePermissions,
    );

    // Handle advertiser status (approve/reject) with a single route

    // Soft delete user (Admin only)
    this.router.delete(
      '/:id/soft',
      authorizePermissions(['users:delete']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.softDelete,
    );

    // Restore user (Admin only)
    this.router.patch(
      '/:id/restore',
      authorizePermissions(['users:update']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.restore,
    );

    // Hard delete user (Admin only)
    this.router.delete(
      '/:id/hard',
      authorizePermissions(['users:delete']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.hardDelete,
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
