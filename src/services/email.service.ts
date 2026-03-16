import env from '@config/env';
import logger from '@config/winston';
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import handlebars from 'handlebars';
import nodemailer from 'nodemailer';
import path from 'path';

export interface EmailData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export interface EmailTemplate {
  subject: string;
  template: string;
}

export class EmailService {
  private transporter?: nodemailer.Transporter;
  private isSendGridAvailable: boolean = false;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    logger.info('EmailService: Initializing instance...');
    this.initializeEmailProviders();
    this.loadTemplates();
  }

  private getCurrencySymbol(currency?: string): string {
    switch (currency?.toUpperCase()) {
      case 'EUR':
        return '€';
      case 'SEK':
        return 'kr';
      case 'USD':
      default:
        return '$';
    }
  }

  private initializeEmailProviders() {
    logger.info('Initializing Email Service providers...');

    // Initialize SendGrid
    if (env.SENDGRID_API_KEY) {
      sgMail.setApiKey(env.SENDGRID_API_KEY);
      this.isSendGridAvailable = true;
      logger.info('Email provider initialized: SendGrid');
    } else {
      logger.warn('SendGrid API Key missing. SendGrid provider will not be available.');
    }

    // Initialize Nodemailer
    if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        secure: env.EMAIL_SECURE,
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });

      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error('Nodemailer transporter verification failed:', error);
          this.transporter = undefined;
        } else {
          logger.info('Email provider initialized: NodeMailer');
        }
      });
    } else {
      logger.warn('SMTP configuration incomplete. Nodemailer provider will not be available.');
    }

    if (!this.isSendGridAvailable && !this.transporter) {
      logger.error(
        'No email providers initialized successfully. Email service will be unavailable.',
      );
    }
  }

  private loadTemplates() {
    // Use absolute path to ensure correct resolution
    const templatesDir = path.resolve(__dirname, '../templates/emails');

    try {
      if (!fs.existsSync(templatesDir)) {
        logger.warn(`Email templates directory not found: ${templatesDir}`);
        return;
      }

      const templateFiles = fs.readdirSync(templatesDir);

      templateFiles.forEach((file) => {
        if (file.endsWith('.json')) {
          try {
            const templateName = path.basename(file, '.json');
            const templatePath = path.join(templatesDir, file);
            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            const template = JSON.parse(templateContent);

            this.templates.set(templateName, template);
          } catch (parseError) {
            logger.error(`Error parsing email template ${file}:`, parseError);
          }
        }
      });

      logger.info(`Loaded ${this.templates.size} email templates from JSON files`);
    } catch (error) {
      logger.error('Error loading email templates:', error);
    }
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      const template = this.templates.get(emailData.template);
      if (!template) {
        logger.error(`Email template '${emailData.template}' not found`);
        return false;
      }

      const compiledTemplate = handlebars.compile(template.template);
      const html = compiledTemplate(emailData.context);
      const subject = emailData.subject || template.subject;
      const from = `${env.EMAIL_FROM_NAME || 'Zlivoo'} <${env.EMAIL_FROM || 'no-reply@zlivoo.com'}>`;

      // Define providers to try based on configuration or priority
      const providers = [];
      if (env.EMAIL_PROVIDER === 'sendgrid') {
        providers.push('sendgrid', 'nodemailer');
      } else {
        providers.push('nodemailer', 'sendgrid');
      }

      let success = false;
      const errors: string[] = [];

      for (const provider of providers) {
        try {
          if (provider === 'sendgrid' && this.isSendGridAvailable) {
            const msg = {
              to: emailData.to,
              from: from,
              subject: subject,
              html: html,
            };
            await sgMail.send(msg);
            logger.info(`Email sent successfully via SendGrid to ${emailData.to}`);
            success = true;
            break;
          } else if (provider === 'nodemailer' && this.transporter) {
            const mailOptions = {
              from: from,
              to: emailData.to,
              subject: subject,
              html: html,
            };
            const result = await this.transporter.sendMail(mailOptions);
            logger.info(
              `Email sent successfully via Nodemailer to ${emailData.to}: ${result.messageId}`,
            );
            success = true;
            break;
          }
        } catch (error: any) {
          const errMsg = `Failed to send email via ${provider}: ${error.message}`;
          logger.error(errMsg);
          errors.push(errMsg);
        }
      }

      if (!success) {
        logger.error(
          `All email providers failed to send email to ${emailData.to}. Errors: ${errors.join(' | ')}`,
        );
      }

      return success;
    } catch (error) {
      logger.error('Error in sendEmail process:', error);
      return false;
    }
  }

  // Convenience methods for different email types
  async sendWelcomeEmail(userEmail: string, userName: string, userRole: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Welcome to Our Ecommerce Platform!',
      template: 'welcome',
      context: {
        name: userName,
        email: userEmail,
        role: userRole,
        joinDate: new Date().toLocaleDateString(),
        loginUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/login`,
      },
    });
  }

  // Login notification method
  async sendLoginNotification(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'New Login Detected',
      template: 'login-notification',
      context: {
        name: userName,
        loginDate: new Date().toLocaleString(),
      },
    });
  }

  async sendPasswordResetEmail(
    userEmail: string,
    userName: string,
    resetToken: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context: {
        name: userName,
        resetUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
        expiryTime: '60',
      },
    });
  }

  async sendForgotPasswordOtpEmail(
    userEmail: string,
    authorName: string,
    otp: any,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset OTP',
      template: 'forgot-password-otp',
      context: {
        name: authorName,
        otp: otp, // commentData is actually the OTP here
        expiryTime: '10', // OTP expiry time in minutes
      },
    });
  }

  async sendForgotPasswordLinkEmail(
    userEmail: string,
    authorName: string,
    link: any,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset Link',
      template: 'forgot-password-link',
      context: {
        name: authorName,
        resetLink: link, // commentData is actually the OTP here
        expiryTime: '10', // OTP expiry time in minutes
      },
    });
  }

  async sendForgotPasswordBothEmail(
    userEmail: string,
    authorName: string,
    otp: string,
    resetLink: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset - OTP & Link',
      template: 'forgot-password-both',
      context: {
        name: authorName,
        otp: otp,
        resetLink: resetLink,
        expiryTime: '10', // OTP expiry time in minutes
      },
    });
  }

  // Email verification method
  async sendEmailVerificationEmail(
    userEmail: string,
    userName: string,
    verificationUrl: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Please Verify Your Email Address',
      template: 'email-verification',
      context: {
        name: userName,
        verificationUrl: verificationUrl,
        expiryTime: '24', // Verification link expiry time in hours
      },
    });
  }

  // Affiliate Application Emails
  async sendAffiliateApplicationReceived(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Affiliate Application Received',
      template: 'affiliate-application-received',
      context: {
        name: userName,
      },
    });
  }

  async sendAffiliateApplicationApproved(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Welcome to the Affiliate Program!',
      template: 'affiliate-application-approved',
      context: {
        name: userName,
        dashboardUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard`,
      },
    });
  }

  async sendAffiliateApplicationRejected(
    userEmail: string,
    userName: string,
    reason?: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Update on Your Affiliate Application',
      template: 'affiliate-application-rejected',
      context: {
        name: userName,
        reason: reason,
      },
    });
  }

  // Referral Commission Email
  async sendReferralCommissionEmail(
    userEmail: string,
    userName: string,
    commissionData: {
      amount: number;
      saleAmount: number;
      rate: string;
      date: string;
      currency?: string;
    },
  ): Promise<boolean> {
    const currencySymbol = this.getCurrencySymbol(commissionData.currency);
    return this.sendEmail({
      to: userEmail,
      subject: 'You Earned a New Commission!',
      template: 'referral-commission',
      context: {
        name: userName,
        commissionAmount: `${currencySymbol}${commissionData.amount.toFixed(2)}`,
        saleAmount: `${currencySymbol}${commissionData.saleAmount.toFixed(2)}`,
        commissionRate: commissionData.rate,
        date: commissionData.date,
        dashboardUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard/reports`,
      },
    });
  }

  // Affiliate Payout Emails
  async sendAffiliatePayoutRequested(
    userEmail: string,
    userName: string,
    payoutData: {
      amount: number;
      method: string;
      currency?: string;
    },
  ): Promise<boolean> {
    const currencySymbol = this.getCurrencySymbol(payoutData.currency);
    return this.sendEmail({
      to: userEmail,
      subject: 'Payout Request Received',
      template: 'affiliate-payout-requested',
      context: {
        name: userName,
        amount: `${currencySymbol}${payoutData.amount.toFixed(2)}`,
        method: payoutData.method,
      },
    });
  }

  async sendAffiliatePayoutApproved(
    userEmail: string,
    userName: string,
    payoutData: {
      amount: number;
      currency?: string;
    },
  ): Promise<boolean> {
    const currencySymbol = this.getCurrencySymbol(payoutData.currency);
    return this.sendEmail({
      to: userEmail,
      subject: 'Payout on the Way!',
      template: 'affiliate-payout-approved',
      context: {
        name: userName,
        amount: `${currencySymbol}${payoutData.amount.toFixed(2)}`,
      },
    });
  }

  async sendAffiliatePayoutRejected(
    userEmail: string,
    userName: string,
    payoutData: {
      amount: number;
      reason: string;
      currency?: string;
    },
  ): Promise<boolean> {
    const currencySymbol = this.getCurrencySymbol(payoutData.currency);
    return this.sendEmail({
      to: userEmail,
      subject: 'Issue with Payout Request',
      template: 'affiliate-payout-rejected',
      context: {
        name: userName,
        amount: `${currencySymbol}${payoutData.amount.toFixed(2)}`,
        reason: payoutData.reason,
        walletUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard/wallet`,
      },
    });
  }

  // Advertiser Application Emails
  async sendAdvertiserApplicationReceived(
    userEmail: string,
    userName: string,
    companyName: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Advertiser Application Received - AffTrack',
      template: 'advertiser-application-received',
      context: {
        name: userName,
        companyName: companyName,
      },
    });
  }

  async sendAdvertiserApplicationApproved(
    userEmail: string,
    userName: string,
    companyName: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Advertiser Account Approved - AffTrack',
      template: 'advertiser-application-approved',
      context: {
        name: userName,
        companyName: companyName,
        dashboardUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard`,
      },
    });
  }

  async sendAdvertiserApplicationRejected(
    userEmail: string,
    userName: string,
    companyName: string,
    reason?: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Update on Your Advertiser Account - AffTrack',
      template: 'advertiser-application-rejected',
      context: {
        name: userName,
        companyName: companyName,
        reason: reason,
      },
    });
  }

  // Manager Account Emails
  async sendManagerAccountActivated(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Manager Account Activated',
      template: 'manager-account-activated',
      context: {
        name: userName,
        dashboardUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard`,
      },
    });
  }

  async sendManagerAccountDeactivated(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Manager Account Deactivated',
      template: 'manager-account-deactivated',
      context: {
        name: userName,
        contactUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/contact`,
      },
    });
  }

  async sendCommentNotification(
    userEmail: string,
    authorName: string,
    commentData: any,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'New Comment Notification',
      template: 'comment-notification',
      context: {
        name: authorName,
        comment: commentData,
        dashboardUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/dashboard`,
      },
    });
  }

  // Team Invitation Email
  async sendTeamInvitation(data: {
    to: string;
    invitationToken: string;
    tenantName: string;
    inviterName: string;
    role: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.to,
      subject: `You've been invited to join ${data.tenantName}`,
      template: 'team-invitation',
      context: {
        tenantName: data.tenantName,
        inviterName: data.inviterName,
        role: data.role,
        invitationUrl: `${env.CORS_ORIGIN || 'http://localhost:3000'}/auth/accept-invitation?token=${data.invitationToken}`,
        expiryTime: '48', // hours
      },
    });
  }
}

export default new EmailService();
