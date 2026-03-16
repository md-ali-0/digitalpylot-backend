import { authenticate, authorizePermissions } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { TaskController } from './task.controller';
import { taskValidation } from './task.validation';

export class TaskRoutes {
  public router: Router;
  private controller: TaskController;

  constructor() {
    this.router = Router();
    this.controller = new TaskController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticate);

    this.router.get('/', authorizePermissions(['tasks:read']), this.controller.getAllTasks);

    this.router.get('/:id', authorizePermissions(['tasks:read']), this.controller.getTaskById);

    this.router.post(
      '/',
      authorizePermissions(['tasks:create']),
      validate(taskValidation.createTask),
      this.controller.createTask,
    );

    this.router.patch(
      '/:id',
      authorizePermissions(['tasks:update']),
      validate(taskValidation.updateTask),
      this.controller.updateTask,
    );

    this.router.delete('/:id', authorizePermissions(['tasks:delete']), this.controller.deleteTask);
  }
}
