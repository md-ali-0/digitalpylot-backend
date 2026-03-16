import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import type { Request, Response } from 'express';
import { RoleService } from './role.service';

export class RoleController extends BaseController {
  constructor() {
    super(new RoleService());
  }

  getRoles = this.catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId;
    const roles = await (this.service as RoleService).getRoles(tenantId!);
    this.sendResponse(res, {
      message: i18n.__('role.fetch_all_success'),
      data: roles,
    });
  });

  getRole = this.catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const role = await (this.service as RoleService).getRoleById(tenantId!, id as string);
    this.sendResponse(res, {
      message: i18n.__('role.fetch_success'),
      data: role,
    });
  });

  createRole = this.catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId;
    const role = await (this.service as RoleService).createRole(tenantId!, req.body);
    this.sendResponse(res, {
      message: i18n.__('role.create_success'),
      data: role,
    });
  });

  updateRole = this.catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const role = await (this.service as RoleService).updateRole(tenantId!, id as string, req.body);
    this.sendResponse(res, {
      message: i18n.__('role.update_success'),
      data: role,
    });
  });

  deleteRole = this.catchAsync(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    await (this.service as RoleService).deleteRole(tenantId!, id as string);
    this.sendResponse(res, {
      message: i18n.__('role.delete_success'),
    });
  });
}
