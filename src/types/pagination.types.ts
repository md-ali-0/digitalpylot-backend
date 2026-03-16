import { TMeta } from '@core/base.interface';

/**
 * Paginated response interface
 * Used for all list endpoints that return data with pagination
 */
export interface PaginatedResponse<T> {
  meta: TMeta;
  data: T[];
}

/**
 * Helper type for extracting array element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;
