import { prisma } from '../lib/prisma.js';
import { getEnv } from '../config/env.js';
import { getLogger } from '../lib/logger.js';
import {
  createPaymentProvider,
  type IPaymentProvider,
} from '../providers/payment/index.js';
import { subscriptionService } from './subscription.service.js';
import { promoService } from './promo.service.js';

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
  async startSubscription(userId: string, tariffId?: string, promoCode?: string): Promise<CreatePaymentResult> {
    const env = getEnv();

    // Look up tariff if provided
    let priceInKopecks = Math.round(env.SUBSCRIPTION_PRICE * 100);
    let description = 'Подписка на курс — 30 дней';
    let resolvedTariffId: string | undefined;

    if (tariffId) {
      const tariff = await prisma.tariff.findUnique({ where: { id: tariffId, isActive: true } });
      if (tariff) {
        priceInKopecks = tariff.price;
        description = `${tariff.title} — ${tariff.period === 'year' ? '365 дней' : tariff.period === 'lifetime' ? 'навсегда' : '30 дней'}`;
        resolvedTariffId = tariff.id;
      }
    }

    // Apply promo code if provided
    let isTrial = false;
    let promoCodeId: string | undefined;
    let finalAmountInKopecks = priceInKopecks;

    if (promoCode) {
      const promoResult = await promoService.validate(promoCode, priceInKopecks);
      finalAmountInKopecks = promoResult.finalAmount;
      promoCodeId = promoResult.promoCodeId;
      isTrial = promoResult.type === 'trial';
    }

    // Convert kopecks to rubles for YooKassa
    const amount = finalAmountInKopecks / 100;

    const idempotenceKey = `sub_${userId}_${resolvedTariffId ?? 'default'}_${promoCodeId ?? 'nopromo'}_${Date.now()}`;

    // Prevent duplicate pending payments for the same tariff + promo
    const pendingPayment = await prisma.payment.findFirst({
      where: { userId, status: 'pending', tariffId: resolvedTariffId ?? null, promoCodeId: promoCodeId ?? null },
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
        originalAmount: priceInKopecks !== finalAmountInKopecks ? priceInKopecks / 100 : null,
        currency: 'RUB',
        description,
        status: 'pending',
        isTrial,
        tariffId: resolvedTariffId ?? null,
        promoCodeId: promoCodeId ?? null,
      },
    });

    // Create payment via provider
    try {
      const result = await this.getProvider().createPayment({
        userId,
        amount,
        currency: 'RUB',
        description: isTrial ? `Тестовый доступ — ${description}` : description,
        idempotenceKey,
        returnUrl: env.PAYMENT_RETURN_URL,
        metadata: { userId, internalPaymentId: localPayment.id, isTrial: String(isTrial) },
        savePaymentMethod: isTrial,
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
        { userId, paymentId: localPayment.id, externalId: result.externalId, isTrial },
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
        case 'payment.succeeded': {
          // Save payment method for trial subscriptions (for auto-charge after trial)
          if (payment.isTrial && event.paymentMethodId) {
            await tx.subscription.upsert({
              where: { userId: payment.userId },
              update: { savedPaymentMethodId: event.paymentMethodId },
              create: {
                userId: payment.userId,
                status: 'active',
                currentPeriodEnd: new Date(), // will be overwritten by activateSubscription
                savedPaymentMethodId: event.paymentMethodId,
              },
            });
          }

          await subscriptionService.activateSubscription(payment.userId, payment.tariff ?? undefined, payment.isTrial);

          // Increment promo code usage
          if (payment.promoCodeId) {
            await promoService.incrementUsage(payment.promoCodeId);
          }

          this.logger.info(
            { userId: payment.userId, paymentId: payment.id, isTrial: payment.isTrial },
            'Payment succeeded — subscription activated',
          );
          break;
        }

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
