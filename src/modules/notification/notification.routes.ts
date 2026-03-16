import { authenticate, authorizeRoles, optionalAuthenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { NotificationController } from './notification.controller';
import {
  getNotificationsSchema,
  notificationIdSchema,
  pushSubscriptionSchema,
  sendAnnouncementSchema,
} from './notification.validation';

export class NotificationRoutes {
  public router: Router;
  private notificationController: NotificationController;

  constructor() {
    this.router = Router();
    this.notificationController = new NotificationController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public routes (no authentication required)
    // FCM token can be saved before user logs in, but if logged in, we want to associate it
    this.router.post('/fcm-token', optionalAuthenticate, this.notificationController.saveFCMToken);

    // Protected routes (authentication required)
    this.router.use(authenticate);

    this.router.get(
      '/',
      validate(getNotificationsSchema),
      this.notificationController.getNotifications,
    );

    this.router.get('/unread-count', this.notificationController.getUnreadCount);

    this.router.post(
      '/push-subscription',
      validate(pushSubscriptionSchema),
      this.notificationController.savePushSubscription,
    );

    this.router.post(
      '/announcement',
      authorizeRoles(['ADMIN']),
      validate(sendAnnouncementSchema),
      this.notificationController.sendAnnouncement,
    );

    this.router.patch('/read-all', this.notificationController.markAllAsRead);

    this.router.patch(
      '/:id/read',
      validate(notificationIdSchema),
      this.notificationController.markAsRead,
    );

    this.router.delete(
      '/:id',
      validate(notificationIdSchema),
      this.notificationController.deleteNotification,
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
