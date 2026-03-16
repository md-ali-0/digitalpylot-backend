import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { GetAllOptions } from '@utils/pagination.util';

type InMemoryNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

const notifications = new Map<string, InMemoryNotification[]>();

export class NotificationService extends BaseService {
  constructor() {
    super({} as never);
  }

  async getNotifications(userId: string, options: GetAllOptions) {
    const page = Number(options.pagination?.page || 1);
    const limit = Number(options.pagination?.limit || 20);
    const offset = (page - 1) * limit;
    const userNotifications = notifications.get(userId) || [];
    const data = userNotifications.slice(offset, offset + limit);

    return {
      data,
      meta: {
        page,
        limit,
        total: userNotifications.length,
        totalPage: Math.ceil(userNotifications.length / limit) || 1,
      },
    };
  }

  async markAsRead(id: string, userId: string) {
    const userNotifications = notifications.get(userId) || [];
    const notification = userNotifications.find((item) => item.id === id);
    if (!notification) {
      throw ApiError.NotFound('Notification not found', 'notification.not_found');
    }
    notification.isRead = true;
    return notification;
  }

  async markAllAsRead(userId: string) {
    const userNotifications = notifications.get(userId) || [];
    userNotifications.forEach((notification) => {
      notification.isRead = true;
    });
    return { count: userNotifications.length };
  }

  async deleteNotification(id: string, userId: string) {
    const userNotifications = notifications.get(userId) || [];
    const filtered = userNotifications.filter((notification) => notification.id !== id);
    notifications.set(userId, filtered);
    return true;
  }

  async savePushSubscription(_userId: string, _subscription: unknown) {
    return { success: true };
  }

  async saveFCMToken(_userId: string | undefined, _fcmToken: string, _deviceType: string) {
    return { success: true };
  }

  async sendAnnouncement(data: {
    target: 'ALL' | 'VENDORS' | 'CUSTOMERS' | 'SPECIFIC' | 'MOBILE_APP_USERS';
    userIds?: string[];
    title: string;
    message: string;
  }) {
    const targetUserIds = data.userIds || [];
    targetUserIds.forEach((userId) => {
      const current = notifications.get(userId) || [];
      current.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        title: data.title,
        message: data.message,
        isRead: false,
        createdAt: new Date(),
      });
      notifications.set(userId, current);
    });

    return { success: true, count: targetUserIds.length };
  }
}
