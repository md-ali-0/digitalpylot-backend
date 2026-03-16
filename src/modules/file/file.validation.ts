import { z } from 'zod';

export const fileIdSchema = z.object({
  params: z.object({
    id: z.string().min(5, 'Invalid file ID'),
  }),
});

export const fileQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a positive integer').optional().default('1'),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive integer').optional().default('10'),
    search: z.string().max(100, 'Search term cannot exceed 100 characters').optional(),
    mimeType: z.string().optional(),
    provider: z.string().optional(),
    sortBy: z
      .enum(['filename', 'mimeType', 'provider', 'createdAt'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});
