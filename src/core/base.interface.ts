export interface BaseFilters {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  delete?: 'YES' | 'NO';
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: TMeta;
}

export type TError = {
  code: number | string;
  message: string;
  path: string;
  timestamp: string;
  type?: string;
  validationErrors?: Array<{ path: string; message: string }>;
  details?: Record<string, unknown>;
  stack?: string;
};

export type TMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type TResponse<T> = {
  data?: T;
  error?: TError;
  meta?: TMeta;
  success: boolean;
  message: string;
  statusCode?: number;
};
