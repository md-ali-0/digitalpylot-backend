import env from '@config/env';
import logger from '@config/winston';
import { addUserVerificationEmailJob, addWelcomeEmailJob } from '@jobs/queue';
import { User } from '@prisma/client';
import { generateUserVerificationToken } from '@utils/verification.util';

export async function SendVerificationEmail(user: User, roles: string[] = []) {
  const isAdvertiser = roles.includes('ADVERTISER') || roles.includes('Advertiser');
  const verificationToken = generateUserVerificationToken({
    userId: user.id,
    email: user.email,
    type: isAdvertiser ? 'advertiser-registration' : 'user-registration',
  });

  const clientUrl = env.NODE_ENV === 'production' ? env.CLIENT_URL_PROD : env.CLIENT_URL;

  const verificationUrl = `${clientUrl}/auth/verify-email?token=${verificationToken}`;

  // Send verification email
  try {
    await addUserVerificationEmailJob(user.email, user.name || 'User', verificationUrl);
  } catch (error) {
    logger.error('Failed to queue user verification email:', error);
  }
}

export async function SendWelcomeEmail(user: User, roles: string[] = []) {
  try {
    const primaryRole = roles[0] || 'AFFILIATE'; // Default fallback
    await addWelcomeEmailJob(user.email, user.name || 'User', primaryRole);
  } catch (error) {
    logger.error('Failed to queue welcome email:', error);
  }
}
