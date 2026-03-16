import env from '@config/env';
import logger from '@config/winston';
import Stripe from 'stripe';

class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      logger.warn('Stripe Secret Key not found. Stripe functionality will be disabled.');
      this.stripe = null as any;
      return;
    }

    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });

    logger.info('Stripe service initialized successfully');
  }

  // Customer Management
  async createCustomer(data: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: data.metadata,
    });
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return (await this.stripe.customers.retrieve(customerId)) as Stripe.Customer;
  }

  async updateCustomer(
    customerId: string,
    data: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    return await this.stripe.customers.update(customerId, data);
  }

  // Subscription Management
  async createSubscription(data: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: data.customerId,
      items: [{ price: data.priceId }],
      metadata: data.metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    };

    if (data.trialDays && data.trialDays > 0) {
      subscriptionData.trial_period_days = data.trialDays;
    }

    return await this.stripe.subscriptions.create(subscriptionData);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async updateSubscription(
    subscriptionId: string,
    data: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, data);
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<Stripe.Subscription> {
    if (cancelAtPeriodEnd) {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  // Payment Method Management
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    return await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // Invoice Management
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.stripe.invoices.retrieve(invoiceId);
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  }

  async retryInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.stripe.invoices.pay(invoiceId);
  }

  // Price Management
  async getPrice(priceId: string): Promise<Stripe.Price> {
    return await this.stripe.prices.retrieve(priceId);
  }

  async listPrices(productId?: string): Promise<Stripe.Price[]> {
    const params: Stripe.PriceListParams = { active: true };
    if (productId) {
      params.product = productId;
    }
    const prices = await this.stripe.prices.list(params);
    return prices.data;
  }

  // Webhook Handling
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // Payment Intent
  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    customerId?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.create({
      amount: data.amount,
      currency: data.currency,
      customer: data.customerId,
      metadata: data.metadata,
      automatic_payment_methods: { enabled: true },
    });
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }
}

export default new StripeService();
