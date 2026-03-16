import { BaseFilters } from '@core/base.interface';

export interface FileFilters extends BaseFilters {
  mimeType?: string;
  provider?: string;
  searchTerm?: string;
}
