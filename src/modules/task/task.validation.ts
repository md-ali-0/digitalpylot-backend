import { TaskPriority, TaskStatus } from '@prisma/client';
import { z } from 'zod';

export const taskValidation = {
  createTask: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      priority: z.nativeEnum(TaskPriority).optional(),
      dueDate: z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : null)),
      assignedToId: z.string().uuid().optional(),
      relatedToType: z.enum(['LEAD', 'USER', 'OTHER']).optional(),
      relatedToId: z.string().uuid().optional(),
    }),
  }),

  updateTask: z.object({
    body: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      priority: z.nativeEnum(TaskPriority).optional(),
      dueDate: z
        .string()
        .optional()
        .transform((val) => (val ? new Date(val) : null)),
      assignedToId: z.string().uuid().optional(),
    }),
  }),
};
