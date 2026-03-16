import { authenticate, authorizeRoles } from '@middlewares/auth.middleware';
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

    this.router.get('/', this.userController.getAllUsers);
    this.router.get('/me', this.userController.getProfile);

    this.router.put('/me', validate(updateUserSchema), this.userController.updateProfile);

    this.router.patch('/me/deactivate', this.userController.deactivateProfile);

    this.router.patch(
      '/me/change-password',
      validate(changePasswordSchema),
      this.userController.changePassword,
    );

    this.router.post(
      '/',
      authorizeRoles(['ADMIN']),
      validate(createUserSchema),
      this.userController.create,
    );

    this.router.put(
      '/:id',
      authorizeRoles(['ADMIN']),
      validateCUID('id'),
      validate(userIdSchema),
      validate(updateUserSchema),
      this.userController.update,
    );

    this.router.patch(
      '/:id',
      authorizeRoles(['ADMIN']),
      validateCUID('id'),
      validate(userIdSchema),
      validate(updateUserSchema),
      this.userController.update,
    );

    // Handle advertiser status (approve/reject) with a single route

    // Soft delete user (Admin only)
    this.router.delete(
      '/:id/soft',
      authorizeRoles(['ADMIN']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.softDelete,
    );

    // Restore user (Admin only)
    this.router.patch(
      '/:id/restore',
      authorizeRoles(['ADMIN']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.restore,
    );

    // Hard delete user (Admin only)
    this.router.delete(
      '/:id/hard',
      authorizeRoles(['ADMIN']),
      validateCUID('id'),
      validate(userIdSchema),
      this.userController.hardDelete,
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
