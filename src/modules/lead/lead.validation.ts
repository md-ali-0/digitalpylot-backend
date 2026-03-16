import { LeadStatus } from '@prisma/client';
import { z } from 'zod';

export const leadValidation = {
  createLead: z.object({
    body: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      company: z.string().optional(),
      source: z.string().optional(),
      status: z.nativeEnum(LeadStatus).optional(),
      assignedToId: z.string().uuid().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    }),
  }),

  updateLead: z.object({
    body: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      company: z.string().optional(),
      source: z.string().optional(),
      status: z.nativeEnum(LeadStatus).optional(),
      assignedToId: z.string().uuid().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    }),
  }),
};
