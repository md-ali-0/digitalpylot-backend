/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTP_STATUS } from '@config/constants';
import { PaginationOptions } from '@utils/pagination.util';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { TError, TMeta } from './base.interface';
import { BaseService } from './base.service';
import { buildResponse } from './response.utils';

export class BaseController {
  protected service: BaseService;

  constructor(service: BaseService) {
    this.service = service;
  }

  protected catchAsync =
    (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(fn(req, res, next)).catch(next);

  protected parseQuery(req: Request) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      pagination: paginationParam,
      ...rest
    } = req.query;

    const pagination: PaginationOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      sortBy: sortBy ? String(sortBy) : undefined,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    const filters: Record<string, any> = {};
    Object.keys(rest).forEach((key) => {
      filters[key] = rest[key];
    });

    return {
      search: search ? String(search) : undefined,
      filters,
      pagination,
    };
  }

  protected sendResponse = <TData>(
    res: Response,
    {
      success = true,
      message,
      statusCode = HTTP_STATUS.OK,
      data,
      meta,
      error,
    }: {
      success?: boolean;
      message: string;
      statusCode?: number;
      data?: TData;
      meta?: TMeta;
      error?: Partial<TError>;
    },
  ) => {
    const response = buildResponse(success, message, statusCode, data, meta, error);
    return res.status(statusCode).json(response);
  };
}
