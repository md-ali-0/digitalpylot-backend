import i18n from '@config/i18n-compat';
import { z } from 'zod';

export const userIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, i18n.__('validation.user_id_required')),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email(i18n.__('validation.email_invalid'))
      .min(1, i18n.__('validation.email_required')),
    password: z
      .string()
      .min(8, i18n.__('validation.password_min_length', { min: '8' }))
      .max(100, i18n.__('validation.password_max_length', { max: '100' })),
    name: z.string().min(1, i18n.__('validation.name_required')).optional(),
    role: z.string().min(1, i18n.__('validation.name_required')),
    // Manager specific fields
    monthlyTarget: z.number().optional(),
    commissionType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    commissionValue: z.number().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    email: z.string().email(i18n.__('validation.email_invalid')).optional(),
    password: z
      .string()
      .min(8, i18n.__('validation.password_min_length', { min: '8' }))
      .max(100, i18n.__('validation.password_max_length', { max: '100' }))
      .optional(),
    name: z.string().min(1, i18n.__('validation.name_required')).optional(),
    phone: z.string().optional(),
    role: z.string().optional(),
    deletedAt: z.string().datetime().nullable().optional(),
    // Manager specific fields
    monthlyTarget: z.number().optional(),
    commissionType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    commissionValue: z.number().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, i18n.__('validation.old_password_required')),
    newPassword: z
      .string()
      .min(8, i18n.__('validation.password_min_length', { min: '8' }))
      .max(100, i18n.__('validation.password_max_length', { max: '100' })),
  }),
});

export const vendorStatusSchema = z.object({
  body: z.object({
    action: z.enum(['approve', 'reject']),
    rejectionReason: z.string().optional(),
  }),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type UserIdInput = z.infer<typeof userIdSchema>['params'];
export type VendorStatusInput = z.infer<typeof vendorStatusSchema>['body'];
