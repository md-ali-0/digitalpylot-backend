/* eslint-disable @typescript-eslint/no-explicit-any */
import env from '@config/env';
import logger from '@config/winston';
import { Queue, QueueEvents } from 'bullmq';

export const connection = {
  host: env.REDIS_HOST,
  port: Number(env.REDIS_PORT),
  username: env.REDIS_USER || 'default',
  password: env.REDIS_PASSWORD,
};

export const emailQueue = new Queue('emailQueue', {
  connection,
  // Configure default job options for better reliability
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { age: 3600 }, // Remove completed jobs after 1 hour
    removeOnFail: { age: 86400 }, // Remove failed jobs after 24 hours
  },
});

export const orderCleanupQueue = new Queue('orderCleanupQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export const postbackQueue = new Queue('postbackQueue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5s, then 10s, 20s...
    },
    removeOnComplete: { age: 3600 * 24 }, // Keep for 24 hours
    removeOnFail: { age: 3600 * 24 * 7 }, // Keep failed for 7 days for debugging
  },
});

export const clickQueue = new Queue('clickQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

// Use QueueEvents for job lifecycle events
const emailQueueEvents = new QueueEvents('emailQueue', { connection });

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Job ${jobId} completed for queue emailQueue`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed for queue emailQueue with error: ${failedReason}`);
});

emailQueueEvents.on('error', (err) => {
  logger.error('Email QueueEvents error:', err);
});

const postbackQueueEvents = new QueueEvents('postbackQueue', { connection });

postbackQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Job ${jobId} completed for queue postbackQueue`);
});

postbackQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed for queue postbackQueue with error: ${failedReason}`);
});

logger.info('BullMQ queues initialized.');

// Helper functions for adding email jobs
export const addEmailJob = async (emailData: any) => {
  return emailQueue.add('sendEmail', emailData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
};

export const addWelcomeEmailJob = async (userEmail: string, userName: string, userRole: string) => {
  return emailQueue.add(
    'sendWelcomeEmail',
    {
      type: 'welcome',
      to: userEmail,
      userName,
      userRole,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );
};

export const addLoginNotificationJob = async (userEmail: string, userName: string) => {
  return emailQueue.add(
    'sendLoginNotification',
    {
      type: 'login-notification',
      to: userEmail,
      userName,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );
};

export const addPasswordResetEmailJob = async (
  userEmail: string,
  userName: string,
  resetToken: string,
) => {
  return emailQueue.add(
    'sendPasswordResetEmail',
    {
      type: 'password-reset',
      to: userEmail,
      userName,
      resetToken,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );
};

export const addCommentNotificationJob = async (
  userEmail: string,
  authorName: string,
  commentData: any,
) => {
  return emailQueue.add(
    'sendCommentNotification',
    {
      type: 'comment-notification',
      to: userEmail,
      authorName,
      commentData,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );
};

// User verification email job
export const addUserVerificationEmailJob = async (
  userEmail: string,
  userName: string,
  verificationUrl: string,
) => {
  return emailQueue.add(
    'sendUserVerificationEmail',
    {
      type: 'user-verification',
      to: userEmail,
      userName,
      verificationUrl,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      // Set a higher priority for vendor verification emails
    },
  );
};

export const addPostbackJob = async (url: string, method: string, data?: any, headers?: any) => {
  return postbackQueue.add('firePostback', {
    url,
    method,
    data,
    headers,
  });
};

export const addClickJob = async (data: any) => {
  return clickQueue.add('processClick', data);
};
