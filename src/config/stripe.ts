import Stripe from 'stripe';
import env from './env';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as any,
  typescript: true,
});

// Ensure FRONTEND_URL has a proper scheme
const frontendUrl =
  process.env.NODE_ENV === 'production'
    ? env.CLIENT_URL_PROD
    : env.CLIENT_URL || 'http://localhost:3000';

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  currency: 'bdt',
  successUrl: `${frontendUrl}/payment/success`,
  cancelUrl: `${frontendUrl}/payment/cancel`,
};
