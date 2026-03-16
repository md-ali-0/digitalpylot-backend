/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { NotificationTypeEnum } from '@prisma/client';
import { calculatePagination, createPaginationMeta, GetAllOptions } from '@utils/pagination.util';
import webpush from 'web-push';
import prisma from '../../config/db';
import { socketService } from '../../services/socket.service';

let isWebPushConfigured = false;

// Configure web-push with VAPID keys only when they are valid.
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:contact@zlivoo.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    isWebPushConfigured = true;
  } catch {
    isWebPushConfigured = false;
  }
}

export class NotificationService extends BaseService {
  constructor() {
    super(prisma.notification);
  }

  async createNotification(data: {
    tenantId: string;
    userId: string;
    type: NotificationTypeEnum;
    title: string;
    message: string;
    data?: any;
    channel?: string;
  }) {
    const {
      tenantId,
      userId,
      type,
      title,
      message,
      data: extraData,
      channel: channelName = 'IN_APP',
    } = data;

    // Get or create notification type
    let notificationType = await prisma.notificationType.findFirst({
      where: { type },
    });

    if (!notificationType) {
      try {
        notificationType = await prisma.notificationType.create({
          data: {
            name: type.toString(),
            type,
            isActive: true,
          },
        });
      } catch (error: any) {
        // If unique constraint failed (P2002), it means another request created it just now
        // So we can fetch it again
        if (error.code === 'P2002') {
          notificationType = await prisma.notificationType.findFirst({
            where: { type },
          });
        }

        // If still not found or other error, throw it
        if (!notificationType) {
          // Log but don't crash if we can't create type - maybe try to proceed with null?
          // Better to throw so we know there's an issue
          throw error;
        }
      }
    }

    // Get or create channel
    let channel = await prisma.notificationChannel.findFirst({
      where: { name: channelName },
    });

    if (!channel) {
      try {
        channel = await prisma.notificationChannel.create({
          data: {
            name: channelName,
            type: 'IN_APP',
            isActive: true,
          },
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          channel = await prisma.notificationChannel.findFirst({
            where: { name: channelName },
          });
        }

        if (!channel) throw error;
      }
    }

    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId,
        notificationTypeId: notificationType.id,
        channelId: channel.id,
        title,
        message,
        data: extraData,
      },
      include: {
        type: true,
        channel: true,
      },
    });

    // Emit real-time notification
    socketService.emitToUser(userId, 'new-notification', notification);
    socketService.emitToUser(userId, 'unread-count-update', { type: 'notification' });

    // Send Browser Push Notification (web-push) if subscription exists
    this.sendPushNotification(userId, {
      title,
      body: message,
      data: {
        ...extraData,
        notificationId: notification.id,
      },
    }).catch((err) => {
      console.error('Failed to send push notification:', err);
    });

    return notification;
  }

  private async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; data?: any },
  ) {
    if (!isWebPushConfigured) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
        endpoint: { not: null },
        p256dh: { not: null },
        auth: { not: null },
      },
    });

    if (subscriptions.length === 0) return;

    const pushPayload = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        data: payload.data,
        icon: '/logo.png', // Default icon
        badge: '/badge.png', // Default badge
      },
    });

    const sendPromises = subscriptions.map(async (sub) => {
      // Skip if any required field is null
      if (!sub.endpoint || !sub.p256dh || !sub.auth) return;

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
        );
      } catch (error: any) {
        // If subscription is expired or invalid, mark it as inactive
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          });
        }
      }
    });

    await Promise.allSettled(sendPromises);
  }

  async savePushSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    // Find existing subscription by endpoint
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      return await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          isActive: true,
        },
      });
    }

    return await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        isActive: true,
      },
    });
  }

  /**
   * Save FCM token for a user
   * userId is optional - allows saving tokens before login
   */
  async saveFCMToken(userId: string | undefined, fcmToken: string, deviceType: string = 'web') {
    // Find existing subscription by fcmToken
    const existing = await prisma.pushSubscription.findUnique({
      where: { fcmToken },
    });

    if (existing) {
      // Update existing subscription
      const updateData: any = {
        deviceType,
        isActive: true,
      };

      // Only update userId if provided (user logged in)
      if (userId) {
        updateData.userId = userId;
        console.log(`[NotificationService] Linking existing FCM token to user ${userId}`);
      } else {
        console.log(`[NotificationService] Updating existing FCM token without user ID`);
      }

      return await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    console.log(
      `[NotificationService] Creating new FCM token subscription. UserID: ${userId || 'None'}`,
    );

    // Create new subscription
    const createData: any = {
      fcmToken,
      deviceType,
      isActive: true,
      // Add userAgent and platform to prevent null constraint violations
      userAgent: deviceType || 'mobile',
      platform: deviceType || 'mobile',
    };

    // Only connect user if userId is provided
    if (userId) {
      createData.user = {
        connect: { id: userId },
      };
    }

    return await prisma.pushSubscription.create({
      data: createData,
    });
  }

  async getNotifications(userId: string, options: GetAllOptions) {
    const { pagination, filters } = options;
    const { page, limit, skip } = calculatePagination(pagination || {});

    const where: any = {
      userId,
    };

    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead === 'true' || filters.isRead === true;
    }

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          type: true,
          channel: true,
        },
      }),
      prisma.notification.count({ where }),
    ]);

    const meta = createPaginationMeta(total, page, limit);

    return { data, meta };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw ApiError.NotFound('Notification not found', 'notification.not_found');
    }

    const result = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emit unread count update
    socketService.emitToUser(userId, 'unread-count-update', { type: 'notification' });

    return result;
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Emit unread count update
    socketService.emitToUser(userId, 'unread-count-update', { type: 'notification' });

    return result;
  }

  async deleteNotification(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw ApiError.NotFound('Notification not found', 'notification.not_found');
    }

    return await prisma.notification.delete({
      where: { id },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // Product approval notifications
  async createProductPendingNotification(
    adminId: string,
    productData: {
      advertiserName: string;
      productName: string;
      productId: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: productData.tenantId,
      userId: adminId,
      type: NotificationTypeEnum.VENDOR_APPROVED,
      title: 'New Product Pending Approval',
      message: `${productData.advertiserName} has submitted "${productData.productName}" for approval`,
      data: {
        productId: productData.productId,
        productName: productData.productName,
        advertiserName: productData.advertiserName,
        action: 'PRODUCT_PENDING_APPROVAL',
      },
    });
  }

  async createProductApprovedNotification(
    vendorId: string,
    productData: {
      productName: string;
      productId: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: productData.tenantId,
      userId: vendorId,
      type: NotificationTypeEnum.VENDOR_APPROVED,
      title: 'Product Approved',
      message: `Your product "${productData.productName}" has been approved and is now live!`,
      data: {
        productId: productData.productId,
        productName: productData.productName,
        action: 'PRODUCT_APPROVED',
      },
    });
  }

  async createProductRejectedNotification(
    vendorId: string,
    productData: {
      productName: string;
      productId: string;
      rejectionReason: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: productData.tenantId,
      userId: vendorId,
      type: NotificationTypeEnum.VENDOR_APPROVED,
      title: 'Product Rejected',
      message: `Your product "${productData.productName}" was rejected. Reason: ${productData.rejectionReason}`,
      data: {
        productId: productData.productId,
        productName: productData.productName,
        rejectionReason: productData.rejectionReason,
        action: 'PRODUCT_REJECTED',
      },
    });
  }

  // Order notifications
  async createOrderCreatedNotification(
    userId: string,
    orderData: {
      orderNumber: string;
      orderId: string;
      affiliateName: string;
      totalAmount: number;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: orderData.tenantId,
      userId: userId,
      type: NotificationTypeEnum.ORDER_CONFIRMED,
      title: 'New Order Received',
      message: `New order ${orderData.orderNumber} from ${orderData.affiliateName} - $${orderData.totalAmount.toFixed(2)}`,
      data: {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        affiliateName: orderData.affiliateName,
        totalAmount: orderData.totalAmount,
        action: 'ORDER_CREATED',
      },
    });
  }

  async createOrderRefundedNotification(
    userId: string,
    refundData: {
      orderNumber: string;
      orderId: string;
      refundAmount: number;
      tenantId: string;
      refundReason?: string;
    },
  ) {
    return this.createNotification({
      tenantId: refundData.tenantId,
      userId: userId,
      type: NotificationTypeEnum.ORDER_CANCELLED,
      title: 'Order Refund Processed',
      message: `Refund of $${refundData.refundAmount.toFixed(2)} processed for order ${refundData.orderNumber}`,
      data: {
        orderId: refundData.orderId,
        orderNumber: refundData.orderNumber,
        refundAmount: refundData.refundAmount,
        refundReason: refundData.refundReason,
        action: 'ORDER_REFUNDED',
      },
    });
  }

  async createOrderStatusUpdateNotification(
    userId: string,
    orderData: {
      orderNumber: string;
      orderId: string;
      status: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: orderData.tenantId,
      userId: userId,
      type: NotificationTypeEnum.ORDER_CONFIRMED,
      title: 'Order Status Updated',
      message: `Your order ${orderData.orderNumber} status has been updated to ${orderData.status}`,
      data: {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        status: orderData.status,
        action: 'ORDER_STATUS_UPDATED',
      },
    });
  }

  async createAdvertiserApplicationNotification(
    adminId: string,
    data: {
      companyName: string;
      advertiserId: string;
      userId: string;
    },
  ) {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { tenantId: true },
    });
    if (!admin) return;

    return this.createNotification({
      tenantId: admin.tenantId,
      userId: adminId,
      type: NotificationTypeEnum.VENDOR_APPROVED,
      title: 'New Advertiser Application',
      message: `New advertiser application from "${data.companyName}"`,
      data: {
        advertiserId: data.advertiserId,
        userId: data.userId,
        companyName: data.companyName,
        action: 'ADVERTISER_APPLICATION_RECEIVED',
      },
    });
  }

  async createAdvertiserStatusNotification(
    userId: string,
    data: {
      status: string;
      reason?: string;
    },
  ) {
    const isApproved = data.status === 'ACTIVE';
    // We need to fetch user's tenantId if we don't have it, but usually it's in context
    // For now we'll assume we can get it or use a default
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    if (!user) return;

    return this.createNotification({
      tenantId: user.tenantId,
      userId,
      type: NotificationTypeEnum.VENDOR_APPROVED,
      title: isApproved ? 'Advertiser Account Approved' : 'Advertiser Account Blocked',
      message: isApproved
        ? `Congratulations! Your advertiser account has been approved.`
        : `Your advertiser account has been blocked.${data.reason ? ` Reason: ${data.reason}` : ''}`,
      data: {
        status: data.status,
        action: isApproved ? 'ADVERTISER_APPROVED' : 'ADVERTISER_BLOCKED',
      },
    });
  }

  async createReviewNotification(
    userId: string,
    reviewData: {
      productName: string;
      productId: string;
      rating: number;
      customerName: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: reviewData.tenantId,
      userId,
      type: NotificationTypeEnum.NEW_REVIEW,
      title: 'New Product Review',
      message: `${reviewData.customerName} gave "${reviewData.productName}" a ${reviewData.rating}-star review`,
      data: {
        productId: reviewData.productId,
        rating: reviewData.rating,
        action: 'NEW_REVIEW',
      },
    });
  }

  async createReviewReplyNotification(
    userId: string,
    replyData: {
      productName: string;
      productId: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: replyData.tenantId,
      userId,
      type: NotificationTypeEnum.REVIEW_REPLY,
      title: 'Reply to Your Review',
      message: `A seller replied to your review of "${replyData.productName}"`,
      data: {
        productId: replyData.productId,
        action: 'REVIEW_REPLY',
      },
    });
  }

  async createNewQuestionNotification(
    userId: string,
    questionData: {
      productName: string;
      productId: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: questionData.tenantId,
      userId,
      type: NotificationTypeEnum.NEW_QUESTION,
      title: 'New Product Question',
      message: `A customer has a question about "${questionData.productName}"`,
      data: {
        productId: questionData.productId,
        action: 'NEW_QUESTION',
      },
    });
  }

  async createQuestionAnswerNotification(
    userId: string,
    answerData: {
      productName: string;
      productId: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: answerData.tenantId,
      userId,
      type: NotificationTypeEnum.QUESTION_ANSWER,
      title: 'Question Answered',
      message: `Your question about "${answerData.productName}" has been answered`,
      data: {
        productId: answerData.productId,
        action: 'QUESTION_ANSWER',
      },
    });
  }

  async createPayoutRequestNotification(
    adminId: string,
    payoutData: {
      vendorName: string;
      amount: number;
      payoutId: string;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: payoutData.tenantId,
      userId: adminId,
      type: NotificationTypeEnum.PAYOUT_REQUEST,
      title: 'New Payout Request',
      message: `${payoutData.vendorName} requested a payout of $${payoutData.amount.toFixed(2)}`,
      data: {
        payoutId: payoutData.payoutId,
        amount: payoutData.amount,
        action: 'PAYOUT_REQUEST',
      },
    });
  }

  async createPayoutStatusNotification(
    userId: string,
    payoutData: {
      amount: number;
      status: 'APPROVED' | 'REJECTED';
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: payoutData.tenantId,
      userId,
      type:
        payoutData.status === 'APPROVED'
          ? NotificationTypeEnum.PAYOUT_APPROVED
          : NotificationTypeEnum.PAYOUT_REJECTED,
      title: `Payout ${payoutData.status}`,
      message: `Your payout request of $${payoutData.amount.toFixed(2)} has been ${payoutData.status.toLowerCase()}`,
      data: {
        amount: payoutData.amount,
        status: payoutData.status,
        action: 'PAYOUT_STATUS_UPDATE',
      },
    });
  }

  async createLowStockNotification(
    userId: string,
    productData: {
      productName: string;
      productId: string;
      remainingStock: number;
      tenantId: string;
    },
  ) {
    return this.createNotification({
      tenantId: productData.tenantId,
      userId,
      type: NotificationTypeEnum.LOW_STOCK_ALERT,
      title: 'Low Stock Alert',
      message: `Product "${productData.productName}" has low stock: ${productData.remainingStock} remaining`,
      data: {
        productId: productData.productId,
        remainingStock: productData.remainingStock,
        action: 'LOW_STOCK_ALERT',
      },
    });
  }

  async sendAnnouncement(data: {
    target: 'ALL' | 'VENDORS' | 'CUSTOMERS' | 'SPECIFIC' | 'MOBILE_APP_USERS';
    userIds?: string[];
    title: string;
    message: string;
    data?: any;
    tenantId: string; // Added tenantId to the data interface
  }) {
    const { target, userIds, title, message, data: extraData, tenantId } = data; // Destructure tenantId

    let targetUserIds: string[] = [];

    if (target === 'SPECIFIC') {
      targetUserIds = userIds || [];
    } else if (target === 'MOBILE_APP_USERS') {
      // Get users who have mobile app FCM tokens
      console.log('[NotificationService] Fetching mobile app users...');
      const mobileSubscriptions = await prisma.pushSubscription.findMany({
        where: {
          fcmToken: { not: null },
          deviceType: { in: ['android', 'ios', 'mobile'] },
          isActive: true,
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      targetUserIds = mobileSubscriptions
        .map((sub) => sub.userId)
        .filter((id): id is string => id !== null);

      console.log(`[NotificationService] Found ${targetUserIds.length} mobile app users`);
    } else {
      const where: any = { status: 'ACTIVE' };

      if (target === 'VENDORS') {
        where.userRoles = {
          some: { role: { name: { in: ['Advertiser', 'Manager'] } } },
        };
      } else if (target === 'CUSTOMERS') {
        where.userRoles = { some: { role: { name: 'Affiliate' } } };
      }

      const users = await prisma.user.findMany({
        where,
        select: { id: true, tenantId: true },
      });

      targetUserIds = users.filter((u) => u.tenantId === data.tenantId).map((u) => u.id);
    }

    console.log(
      `[NotificationService] Sending announcement "${title}" to ${targetUserIds.length} users (Target: ${target})`,
    );

    // Split targetUserIds into chunks to avoid overwhelming the system
    const chunkSize = 50;
    for (let i = 0; i < targetUserIds.length; i += chunkSize) {
      const chunk = targetUserIds.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map((userId) =>
          this.createNotification({
            tenantId: tenantId, // Added tenantId here
            userId,
            type: NotificationTypeEnum.ANNOUNCEMENT,
            title,
            message,
            data: { ...extraData, isAnnouncement: true },
          }),
        ),
      );
    }

    // If target is ALL, also send to anonymous subscriptions
    // if (target === 'ALL') {
    //   console.log('[NotificationService] Fetching anonymous subscriptions for broadcast...');
    //   const anonymousSubs = await prisma.pushSubscription.findMany({
    //     where: {
    //       userId: null,
    //       isActive: true,
    //       fcmToken: { not: null },
    //     },
    //   });

    //   console.log(`[NotificationService] Found ${anonymousSubs.length} anonymous subscriptions.`);

    //   if (anonymousSubs.length > 0) {
    //     const tokens = anonymousSubs.map((sub) => sub.fcmToken as string);

    //     // Send in batches of 500 (FCM limit)
    //     const batchSize = 500;
    //     for (let i = 0; i < tokens.length; i += batchSize) {
    //       const batchTokens = tokens.slice(i, i + batchSize);
    //       await sendFCMNotificationToMultiple(batchTokens, {
    //         title,
    //         body: message,
    //         data: { ...extraData, isAnnouncement: 'true' },
    //       });
    //     }
    //   }
    // }

    return { success: true, count: targetUserIds.length };
  }
}
