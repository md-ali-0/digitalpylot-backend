import { authenticate, authorizePermissions } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { LeadController } from './lead.controller';
import { leadValidation } from './lead.validation';

export class LeadRoutes {
  public router: Router;
  private controller: LeadController;

  constructor() {
    this.router = Router();
    this.controller = new LeadController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticate);

    this.router.get('/', authorizePermissions(['leads:read']), this.controller.getAllLeads);

    this.router.get('/:id', authorizePermissions(['leads:read']), this.controller.getLeadById);

    this.router.post(
      '/',
      authorizePermissions(['leads:create']),
      validate(leadValidation.createLead),
      this.controller.createLead,
    );

    this.router.patch(
      '/:id',
      authorizePermissions(['leads:update']),
      validate(leadValidation.updateLead),
      this.controller.updateLead,
    );

    this.router.delete('/:id', authorizePermissions(['leads:delete']), this.controller.deleteLead);
  }
}
