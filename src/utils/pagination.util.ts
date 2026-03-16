/* eslint-disable @typescript-eslint/no-explicit-any */

import { PAGINATION } from '@config/app-constants';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetAllOptions {
  filters?: Record<string, any>;
  search?: string;
  searchFields?: string[];
  pagination?: PaginationOptions;
}

export const calculatePagination = (options: PaginationOptions): PaginationResult => {
  const page = Number(options.page) || PAGINATION.DEFAULT_PAGE;
  // Security: Enforce maximum limit to prevent abuse
  const requestedLimit = Number(options.limit) || PAGINATION.DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy;
  const sortOrder = options.sortOrder || 'desc';

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
  };
};

export const createPaginationMeta = (total: number, page: number, limit: number) => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
