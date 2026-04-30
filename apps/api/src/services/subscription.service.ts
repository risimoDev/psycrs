import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { RETRY_POLICY } from '../providers/payment/index.js';
import { videoService } from './video.service.js';

const SUBSCRIPTION_PERIOD_DAYS = 30;

function periodToDays(period: string): number {
  if (period === '2month') return 60;
  if (period === '3month') return 90;
  if (period === 'year') return 365;
  if (period === 'lifetime') return 36500; // ~100 years
  return 30; // month or anything else
}

export class SubscriptionService {
  private readonly logger = getLogger().child({ service: 'subscription' });

  /** Activate or extend subscription after successful payment */
  async activateSubscription(userId: string, tariff?: { period: string }, isTrial = false, trialDays?: number): Promise<void> {
    const days = isTrial && trialDays ? trialDays : (tariff ? periodToDays(tariff.period) : SUBSCRIPTION_PERIOD_DAYS);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { userId },
      });

      if (existing) {
        // Extend: use current period end if still active, otherwise start from now
        const baseDate = existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
        const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

        await tx.subscription.update({
          where: { userId },
          data: {
            status: 'active',
            currentPeriodEnd: newEnd,
            isTrial,
            trialEndsAt: isTrial ? periodEnd : null,
            retryCount: 0,
            nextRetryAt: null,
          },
        });
        this.logger.info({ userId, periodEnd: newEnd, isTrial }, 'Subscription extended');
      } else {
        await tx.subscription.create({
          data: {
            userId,
            status: 'active',
            currentPeriodEnd: periodEnd,
            isTrial,
            trialEndsAt: isTrial ? periodEnd : null,
          },
        });
        this.logger.info({ userId, periodEnd, isTrial }, 'Subscription created');
      }
    });
  }

  /** Move subscription to grace period (payment failed, retries pending) */
  async moveToGracePeriod(userId: string): Promise<void> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return;

    const newRetryCount = sub.retryCount + 1;

    if (newRetryCount > RETRY_POLICY.maxAttempts) {
      await this.expireSubscription(userId);
      return;
    }

    const nextRetry = new Date(Date.now() + RETRY_POLICY.intervalMs);

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'grace_period',
        retryCount: newRetryCount,
        nextRetryAt: nextRetry,
      },
    });

    this.logger.info(
      { userId, retryCount: newRetryCount, nextRetryAt: nextRetry },
      'Subscription moved to grace period',
    );
  }

  /** Expire subscription (all retries exhausted) */
  async expireSubscription(userId: string): Promise<void> {
    await prisma.subscription.updateMany({
      where: { userId, status: { not: 'expired' } },
      data: {
        status: 'expired',
        retryCount: 0,
        nextRetryAt: null,
      },
    });
    this.logger.info({ userId }, 'Subscription expired');
  }

  /** Cancel subscription (user-initiated) */
  async cancelSubscription(userId: string): Promise<void> {
    await prisma.subscription.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'cancelled' },
    });
    // Immediately revoke active video tokens
    await videoService.revokeTokensForUser(userId);
    this.logger.info({ userId }, 'Subscription cancelled');
  }

  /** Get subscription status for a user */
  async getStatus(userId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        status: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    });
    return sub ?? { status: 'none' as const, currentPeriodEnd: null, createdAt: null };
  }
}

export const subscriptionService = new SubscriptionService();
