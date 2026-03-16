import { z } from 'zod';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isRead: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
});

export const pushSubscriptionSchema = z.object({
  body: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});
export const sendAnnouncementSchema = z.object({
  body: z.object({
    target: z.enum(['ALL', 'VENDORS', 'CUSTOMERS', 'SPECIFIC', 'MOBILE_APP_USERS']),
    userIds: z.array(z.string()).optional(),
    title: z.string().min(1),
    message: z.string().min(1),
    data: z.record(z.string(), z.any()).optional(),
  }),
});
