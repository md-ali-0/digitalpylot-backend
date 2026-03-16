import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import type { Request, Response } from 'express';
import { RbacService } from '@services/rbac.service';

export class PermissionController extends BaseController {
  constructor() {
    super({} as never);
  }

  getCatalog = this.catchAsync(async (req: Request, res: Response) => {
    this.sendResponse(res, {
      message: i18n.__('role.fetch_all_success'),
      data: RbacService.getPermissionCatalog(),
    });
  });
}
