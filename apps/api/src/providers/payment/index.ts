import { createHmac, timingSafeEqual } from 'node:crypto';
import type pino from 'pino';
import { WebhookError } from '../../lib/errors.js';

// ─── Retry policy shared with subscription service ────────────────────────

export const RETRY_POLICY = {
  maxAttempts: 3,
  intervalMs: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// ─── Payment provider interface ──────────────────────────────────────────

export interface CreatePaymentParams {
  userId: string;
  amount: number;
  currency: string;
  description: string;
  idempotenceKey: string;
  returnUrl: string;
  metadata?: Record<string, string>;
  savePaymentMethod?: boolean;
}

export interface CreatePaymentResult {
  externalId: string;
  confirmationUrl: string;
  status: string;
}

export interface WebhookEvent {
  eventId: string;
  type: string;
  paymentExternalId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'canceled';
  paymentMethodId?: string;
}

export interface IPaymentProvider {
  /** Create a new payment and return confirmation URL */
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;

  /** Verify webhook signature and parse event payload */
  parseWebhook(rawBody: Buffer, signature: string): WebhookEvent;
}

// ─── YooKassa provider implementation ────────────────────────────────────

interface YooKassaConfig {
  shopId: string;
  secretKey: string;
  webhookSecret: string;
  logger: pino.Logger;
}

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

class YooKassaProvider implements IPaymentProvider {
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly logger: pino.Logger;

  constructor(config: YooKassaConfig) {
    this.shopId = config.shopId;
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.logger = config.logger.child({ provider: 'yookassa' });
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');

    const body = {
      amount: {
        value: (params.amount / 100).toFixed(2), // convert kopecks to rubles
        currency: params.currency,
      },
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      description: params.description,
      metadata: params.metadata ?? {},
      capture: true,
      ...(params.savePaymentMethod && { save_payment_method: true }),
    };

    const res = await fetch(`${YOOKASSA_API}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': params.idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error({ status: res.status, body: text }, 'YooKassa payment creation failed');
      throw new Error(`YooKassa error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      status: string;
      confirmation?: { confirmation_url?: string };
    };

    const confirmationUrl = data.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      throw new Error('YooKassa did not return a confirmation URL');
    }

    return {
      externalId: data.id,
      confirmationUrl,
      status: data.status,
    };
  }

  parseWebhook(rawBody: Buffer, signature: string): WebhookEvent {
    // YooKassa sends IP-based verification, not HMAC — signature header is empty in prod
    // For additional security, verify if webhookSecret is configured
    if (this.webhookSecret) {
      const expected = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      try {
        const expectedBuf = Buffer.from(expected, 'hex');
        const signatureBuf = Buffer.from(signature, 'hex');
        if (
          expectedBuf.length !== signatureBuf.length ||
          !timingSafeEqual(expectedBuf, signatureBuf)
        ) {
          throw new WebhookError('Invalid webhook signature');
        }
      } catch {
        throw new WebhookError('Invalid webhook signature');
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
    } catch {
      throw new WebhookError('Invalid webhook payload');
    }

    const type = payload['event'] as string;
    const obj = payload['object'] as Record<string, unknown> | undefined;

    if (!type || !obj) {
      throw new WebhookError('Missing event type or object in webhook payload');
    }

    const amount = obj['amount'] as { value?: string } | undefined;
    const amountValue = amount?.value ? parseFloat(amount.value) * 100 : 0;

    const currency = (amount as { currency?: string } | undefined)?.currency ?? 'RUB';

    let status: 'pending' | 'succeeded' | 'canceled';
    switch (type) {
      case 'payment.succeeded':
        status = 'succeeded';
        break;
      case 'payment.canceled':
        status = 'canceled';
        break;
      default:
        status = 'pending';
    }

    const paymentMethod = obj['payment_method'] as { id?: string } | undefined;

    return {
      eventId: `${obj['id'] as string}_${type}`,
      type,
      paymentExternalId: obj['id'] as string,
      amount: amountValue,
      currency,
      status,
      paymentMethodId: paymentMethod?.id,
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────

export function createPaymentProvider(config: YooKassaConfig): IPaymentProvider {
  return new YooKassaProvider(config);
}
