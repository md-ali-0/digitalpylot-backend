import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  PaymentsController,
} from '@paypal/paypal-server-sdk';
import env from './env';

// Lazy initialization - only initialize when actually needed
let paypalClient: Client | null = null;
let ordersControllerInstance: OrdersController | null = null;
let paymentsControllerInstance: PaymentsController | null = null;

function initializePayPalClient(): Client {
  if (!paypalClient) {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required');
    }

    paypalClient = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
      },
      timeout: 0,
      environment:
        process.env.PAYPAL_MODE === 'live' ? Environment.Production : Environment.Sandbox,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
      },
    });
  }
  return paypalClient;
}

// Lazy getter for Orders Controller
export const getOrdersController = (): OrdersController => {
  if (!ordersControllerInstance) {
    const client = initializePayPalClient();
    ordersControllerInstance = new OrdersController(client);
  }
  return ordersControllerInstance;
};

// Lazy getter for Payments Controller
export const getPaymentsController = (): PaymentsController => {
  if (!paymentsControllerInstance) {
    const client = initializePayPalClient();
    paymentsControllerInstance = new PaymentsController(client);
  }
  return paymentsControllerInstance;
};

// Ensure FRONTEND_URL has a proper scheme
const frontendUrl =
  process.env.NODE_ENV === 'production'
    ? env.CLIENT_URL_PROD
    : env.CLIENT_URL || 'http://localhost:3000';

export const PAYPAL_CONFIG = {
  mode: process.env.PAYPAL_MODE || 'sandbox',
  currency: 'USD',
  returnUrl: `${frontendUrl}/payment/success`,
  cancelUrl: `${frontendUrl}/payment/cancel`,
};

// Validate credentials on startup to fail fast
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_ID.length < 40) {
  console.warn(
    'WARNING: PAYPAL_CLIENT_ID appears to be too short. Please check your .env.local file.',
  );
}
