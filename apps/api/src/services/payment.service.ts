import { prisma } from '../lib/prisma.js';
import { getEnv } from '../config/env.js';
import { getLogger } from '../lib/logger.js';
import {
  createPaymentProvider,
  type IPaymentProvider,
} from '../providers/payment/index.js';
import { subscriptionService } from './subscription.service.js';

interface CreatePaymentResult {
  paymentId: string;
  confirmationUrl: string;
}

export class PaymentService {
  private readonly logger = getLogger().child({ service: 'payment' });
  private provider: IPaymentProvider | undefined;

  private getProvider(): IPaymentProvider {
    if (!this.provider) {
      const env = getEnv();
      this.provider = createPaymentProvider({
        shopId: env.YOOKASSA_SHOP_ID,
        secretKey: env.YOOKASSA_SECRET_KEY,
        webhookSecret: env.YOOKASSA_WEBHOOK_SECRET,
        logger: getLogger(),
      });
    }
    return this.provider;
  }

  /** Start subscription payment flow */
  async startSubscription(userId: string, tariffId?: string): Promise<CreatePaymentResult> {
    const env = getEnv();

    // Look up tariff if provided
    let amount = env.SUBSCRIPTION_PRICE;
    let description = 'Подписка на курс — 30 дней';
    let resolvedTariffId: string | undefined;

    if (tariffId) {
      const tariff = await prisma.tariff.findUnique({ where: { id: tariffId, isActive: true } });
      if (tariff) {
        // Price stored in kopecks → convert to rubles for YooKassa
        amount = tariff.price / 100;
        description = `${tariff.title} — ${tariff.period === 'year' ? '365 дней' : tariff.period === 'lifetime' ? 'навсегда' : '30 дней'}`;
        resolvedTariffId = tariff.id;
      }
    }

    const idempotenceKey = `sub_${userId}_${resolvedTariffId ?? 'default'}_${Date.now()}`;

    // Prevent duplicate pending payments for the same tariff
    const pendingPayment = await prisma.payment.findFirst({
      where: { userId, status: 'pending', tariffId: resolvedTariffId ?? null },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingPayment && pendingPayment.confirmationUrl) {
      this.logger.debug({ userId, paymentId: pendingPayment.id }, 'Reusing pending payment');
      return {
        paymentId: pendingPayment.id,
        confirmationUrl: pendingPayment.confirmationUrl,
      };
    }

    // Create local payment record
    const localPayment = await prisma.payment.create({
      data: {
        userId,
        idempotenceKey,
        amount,
        currency: 'RUB',
        description,
        status: 'pending',
        tariffId: resolvedTariffId ?? null,
      },
    });

    // Create payment via provider
    try {
      const result = await this.getProvider().createPayment({
        userId,
        amount,
        currency: 'RUB',
        description,
        idempotenceKey,
        returnUrl: env.PAYMENT_RETURN_URL,
        metadata: { userId, internalPaymentId: localPayment.id },
      });

      // Update local record with external ID
      await prisma.payment.update({
        where: { id: localPayment.id },
        data: {
          externalId: result.externalId,
          confirmationUrl: result.confirmationUrl,
        },
      });

      this.logger.info(
        { userId, paymentId: localPayment.id, externalId: result.externalId },
        'Payment created',
      );

      return {
        paymentId: localPayment.id,
        confirmationUrl: result.confirmationUrl,
      };
    } catch (err) {
      // Clean up local record on provider error
      await prisma.payment.update({
        where: { id: localPayment.id },
        data: { status: 'canceled' },
      });
      throw err;
    }
  }

  /** Handle webhook from payment provider (idempotent) */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // 1. Verify signature and parse event
    const event = this.getProvider().parseWebhook(rawBody, signature);

    // 2. Idempotency check — transaction to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Check if already processed
      const existing = await tx.webhookLog.findUnique({
        where: { eventId: event.eventId },
      });

      if (existing) {
        this.logger.debug({ eventId: event.eventId }, 'Webhook already processed — skipping');
        return;
      }

      // Log webhook
      await tx.webhookLog.create({
        data: {
          provider: 'yookassa',
          eventId: event.eventId,
          payload: {
            type: event.type,
            paymentExternalId: event.paymentExternalId,
            amount: event.amount,
            currency: event.currency,
          },
        },
      });

      // 3. Update payment status
      const payment = await tx.payment.findUnique({
        where: { externalId: event.paymentExternalId },
        include: { tariff: true },
      });

      if (!payment) {
        this.logger.warn(
          { externalId: event.paymentExternalId },
          'Payment not found for webhook event',
        );
        return;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: event.status },
      });

      // 4. Process by event type
      switch (event.type) {
        case 'payment.succeeded':
          await subscriptionService.activateSubscription(payment.userId, payment.tariff ?? undefined);
          this.logger.info(
            { userId: payment.userId, paymentId: payment.id },
            'Payment succeeded — subscription activated',
          );
          break;

        case 'payment.canceled':
          await subscriptionService.moveToGracePeriod(payment.userId);
          this.logger.info(
            { userId: payment.userId, paymentId: payment.id },
            'Payment canceled — grace period started',
          );
          break;

        case 'payment.waiting_for_capture':
          this.logger.debug(
            { paymentId: payment.id },
            'Payment waiting for capture',
          );
          break;
      }
    });
  }
}

export const paymentService = new PaymentService();
