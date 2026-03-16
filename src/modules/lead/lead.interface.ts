import { LeadStatus } from '@prisma/client';

export interface ILeadFilters {
  status?: LeadStatus;
  assignedToId?: string;
  searchTerm?: string;
}

export const LEAD_ALLOWED_FILTERS = ['status', 'assignedToId', 'searchTerm'] as const;
