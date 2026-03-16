import { HTTP_STATUS } from '@config/constants';
import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import type { Request, Response } from 'express';
import { NotificationService } from './notification.service';

export class NotificationController extends BaseController {
  protected notificationService: NotificationService;

  constructor() {
    super(new NotificationService());
    this.notificationService = this.service as NotificationService;
  }

  getNotifications = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { pagination, filters } = this.parseQuery(req);

    const result = await this.notificationService.getNotifications(userId, { pagination, filters });

    this.sendResponse(res, {
      message: i18n.__('notification.fetch_success'),
      data: result.data,
      meta: result.meta,
    });
  });

  markAsRead = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    await this.notificationService.markAsRead(id as string, userId);

    this.sendResponse(res, {
      message: i18n.__('notification.marked_as_read'),
      data: null,
    });
  });

  markAllAsRead = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    await this.notificationService.markAllAsRead(userId);

    this.sendResponse(res, {
      message: i18n.__('notification.all_marked_as_read'),
      data: null,
    });
  });

  deleteNotification = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    await this.notificationService.deleteNotification(id as string, userId);

    this.sendResponse(res, {
      message: i18n.__('notification.deleted'),
      statusCode: HTTP_STATUS.OK,
      data: null,
    });
  });

  getUnreadCount = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { type, read } = req.query;
    const typeStr = type ? (type as string) : undefined;
    const readStr = read ? (read as string) : undefined;

    const notifications = await this.notificationService.getNotifications(userId, {
      filters: {
        type: typeStr as any,
        isRead: readStr === 'true',
      },
    });
    this.sendResponse(res, {
      message: i18n.__('notification.unread_count_fetched'),
      data: notifications, // Assuming 'notifications' is the result to be sent
    });
  });

  savePushSubscription = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const subscription = req.body;

    await this.notificationService.savePushSubscription(userId, subscription);

    this.sendResponse(res, {
      message: i18n.__('notification.push_subscription_saved'),
      data: null,
    });
  });

  saveFCMToken = this.catchAsync(async (req: Request, res: Response) => {
    // User ID is optional - token can be saved before login
    const userId = req.user?.id;

    // Support both old field names (fcmToken, deviceType) and new ones (token, platform)
    // Mobile app sends: { token, platform, deviceId, appVersion }
    const fcmToken = req.body.fcmToken || req.body.token;
    const deviceType = req.body.deviceType || req.body.platform || 'mobile';

    console.log(
      `[NotificationController] saveFCMToken called. UserID: ${userId || 'Unauthenticated'}, Device: ${deviceType}, Token (prefix): ${fcmToken?.substring(0, 10)}...`,
    );

    if (!fcmToken) {
      throw new Error('FCM token is required');
    }

    await this.notificationService.saveFCMToken(userId, fcmToken, deviceType);

    this.sendResponse(res, {
      message: i18n.__('notification.fcm_token_saved'),
      data: null,
    });
  });

  sendAnnouncement = this.catchAsync(async (req: Request, res: Response) => {
    const result = await this.notificationService.sendAnnouncement(req.body);

    this.sendResponse(res, {
      message: i18n.__('notification.announcement_sent'),
      data: result,
    });
  });
}
