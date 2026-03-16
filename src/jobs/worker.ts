import logger from '@config/winston';
import emailService from '@services/email.service';
import { Worker } from 'bullmq';
import { clickQueue, connection, emailQueue, postbackQueue } from './queue';

// Define job types
export enum JobType {
  SEND_EMAIL = 'sendEmail',
  PROCESS_CLICK = 'processClick',
  FIRE_POSTBACK = 'firePostback',
}

// Worker for sending emails
export const emailWorker = new Worker(
  emailQueue.name,
  async (job) => {
    logger.info(`Processing email job ${job.id}: ${job.data.to}`);

    try {
      const { type, ...emailData } = job.data;

      let success = false;

      switch (type) {
        case 'welcome':
          success = await emailService.sendWelcomeEmail(
            emailData.to,
            emailData.userName,
            emailData.userRole,
          );
          break;
        case 'login-notification':
          success = await emailService.sendLoginNotification(emailData.to, emailData.userName);
          break;
        case 'password-reset':
          success = await emailService.sendPasswordResetEmail(
            emailData.to,
            emailData.userName,
            emailData.resetToken,
          );
          break;
        case 'comment-notification':
          success = await emailService.sendCommentNotification(
            emailData.to,
            emailData.authorName,
            emailData.commentData,
          );
          break;
        case 'user-verification':
          success = await emailService.sendEmailVerificationEmail(
            emailData.to,
            emailData.userName,
            emailData.verificationUrl,
          );
          break;

        default:
          // Generic email sending
          success = await emailService.sendEmail(emailData);
      }

      if (success) {
        logger.info(`Email sent successfully to ${emailData.to}`);
      } else {
        logger.error(`Failed to send email to ${emailData.to}`);
        throw new Error('Email sending failed');
      }
    } catch (error) {
      logger.error(`Error processing email job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection,
    // Increase concurrency to handle more emails simultaneously
    concurrency: 5,
    // Add rate limiting to prevent overwhelming the email service
    limiter: {
      max: 10, // Max 10 jobs per second
      duration: 1000,
    },
  },
);

// Add more workers for different job types

emailWorker.on('completed', (job) => {
  logger.info(`Email job ${job.id} completed.`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job?.id} failed with error: ${err.message}`);

  // Retry failed jobs with exponential backoff
  if (job && job.attemptsMade < 3) {
    logger.info(`Retrying email job ${job.id}. Attempt ${job.attemptsMade + 1}/3`);
  } else {
    logger.error(`Email job ${job?.id} failed after 3 attempts`);
  }
});

logger.info('BullMQ workers initialized.');

import axios from 'axios';

export const postbackWorker = new Worker(
  postbackQueue.name,
  async (job) => {
    logger.info(`Processing postback job ${job.id}: ${job.data.url}`);

    try {
      const { url, method, data, headers } = job.data;

      const response = await axios({
        method: method || 'GET',
        url,
        data,
        headers,
        timeout: 10000,
      });

      logger.info(`Postback sent successfully to ${url}. Status: ${response.status}`);
      return { status: response.status, data: response.data };
    } catch (error: any) {
      logger.error(`Error processing postback job ${job.id}:`, error.message);
      if (error.response) {
        logger.error(`Postback Response Data:`, error.response.data);
      }
      throw error;
    }
  },
  {
    connection,
    concurrency: 20, // High concurrency for postbacks
    limiter: {
      max: 100, // Max 100 postbacks per second
      duration: 1000,
    },
  },
);

postbackWorker.on('completed', (job) => {
  logger.info(`Postback job ${job.id} completed.`);
});

postbackWorker.on('failed', (job, err) => {
  logger.error(
    `Postback job ${job?.id} failed. Attempt ${job?.attemptsMade}. Error: ${err.message}`,
  );
});

export const clickWorker = new Worker(
  clickQueue.name,
  async (job) => {
    logger.warn(
      `Skipping click job ${job.id}: click tracking worker is disabled in the starter backend.`,
    );
    return { skipped: true };
  },
  {
    connection,
    concurrency: 50, // High concurrency for click recording
  },
);

clickWorker.on('completed', (job) => {
  logger.info(`Click job ${job.id} completed.`);
});

clickWorker.on('failed', (job, err) => {
  logger.error(`Click job ${job?.id} failed with error: ${err.message}`);
});
