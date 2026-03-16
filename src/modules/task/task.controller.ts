import { BaseController } from '@core/base.controller';
import { Request, Response } from 'express';
import { TaskService } from './task.service';

export class TaskController extends BaseController {
  private taskService: TaskService;

  constructor() {
    const service = new TaskService();
    super(service);
    this.taskService = service;
  }

  getAllTasks = this.catchAsync(async (req: Request, res: Response) => {
    const { filters, pagination, search } = this.parseQuery(req);

    const result = await this.taskService.getAllTasks({
      filters,
      pagination,
      search,
    });

    this.sendResponse(res, {
      message: 'Tasks retrieved successfully',
      data: result.data,
      meta: result.meta,
    });
  });

  getTaskById = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.taskService.findById(req.params.id as string);
    this.sendResponse(res, {
      message: 'Task retrieved successfully',
      data: result,
    });
  });

  createTask = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.taskService.create(req.body);
    this.sendResponse(res, {
      message: 'Task created successfully',
      data: result,
      statusCode: 201,
    });
  });

  updateTask = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.taskService.update(req.params.id as string, req.body);
    this.sendResponse(res, {
      message: 'Task updated successfully',
      data: result,
    });
  });

  deleteTask = this.catchAsync(async (req: Request, res: Response) => {
    await this.taskService.softDelete(req.params.id as string);
    this.sendResponse(res, {
      message: 'Task deleted successfully',
    });
  });
}
