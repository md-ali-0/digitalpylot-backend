import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import type { Request, Response } from 'express';
import { RbacService } from '@services/rbac.service';

export class AuditLogController extends BaseController {
  constructor() {
    super({} as never);
  }

  list = this.catchAsync(async (req: Request, res: Response) => {
    const logs = await RbacService.listAuditLogs(req.user?.tenantId);
    this.sendResponse(res, {
      message: i18n.__('role.fetch_all_success'),
      data: logs,
    });
  });
}
