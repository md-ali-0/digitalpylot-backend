import i18n from '@config/i18n-compat';
import { z } from 'zod';

export const roleIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, i18n.__('validation.role_id_required')),
  }),
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2, i18n.__('validation.role_name_length')),
    permissionIds: z.array(z.string()).min(1, i18n.__('validation.permissions_required')),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2, i18n.__('validation.role_name_length')).optional(),
    permissionIds: z
      .array(z.string())
      .min(1, i18n.__('validation.permissions_required'))
      .optional(),
  }),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>['body'];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>['body'];
