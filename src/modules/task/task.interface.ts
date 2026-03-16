import { TaskPriority, TaskStatus } from '@prisma/client';

export interface ITaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: string;
  searchTerm?: string;
}

export const TASK_ALLOWED_FILTERS = ['status', 'priority', 'assignedToId', 'searchTerm'] as const;
