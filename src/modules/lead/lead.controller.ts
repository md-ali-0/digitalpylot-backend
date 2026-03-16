import { BaseController } from '@core/base.controller';
import { Request, Response } from 'express';
import { LeadService } from './lead.service';

export class LeadController extends BaseController {
  private leadService: LeadService;

  constructor() {
    const service = new LeadService();
    super(service);
    this.leadService = service;
  }

  getAllLeads = this.catchAsync(async (req: Request, res: Response) => {
    const { filters, pagination } = this.parseQuery(req);

    const result = await this.leadService.getAllLeads({
      filters,
      pagination,
    });

    this.sendResponse(res, {
      message: 'Leads retrieved successfully',
      data: result.data,
      meta: result.meta,
    });
  });

  getLeadById = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.leadService.findById(req.params.id as string);
    this.sendResponse(res, {
      message: 'Lead retrieved successfully',
      data: result,
    });
  });

  createLead = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.leadService.create(req.body);
    this.sendResponse(res, {
      message: 'Lead created successfully',
      data: result,
      statusCode: 201,
    });
  });

  updateLead = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.leadService.update(req.params.id as string, req.body);
    this.sendResponse(res, {
      message: 'Lead updated successfully',
      data: result,
    });
  });

  deleteLead = this.catchAsync(async (req: Request, res: Response) => {
    await this.leadService.softDelete(req.params.id as string);
    this.sendResponse(res, {
      message: 'Lead deleted successfully',
    });
  });
}
