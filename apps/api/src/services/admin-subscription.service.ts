import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { videoService } from './video.service.js';

interface SubListQuery {
  page: number;
  limit: number;
  status?: string;
}

export class AdminSubscriptionService {
  private readonly logger = getLogger().child({ service: 'admin-subscription' });

  async list(query: SubListQuery) {
    const skip = (query.page - 1) * query.limit;

    const where = query.status
      ? { status: query.status as 'active' | 'grace_period' | 'expired' | 'cancelled' }
      : {};

    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async cancel(subscriptionId: string, adminId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundError('Subscription');

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'cancelled', nextRetryAt: null },
    });

    await auditService.log({
      adminId,
      action: 'cancel',
      entity: 'subscription',
      entityId: subscriptionId,
      details: { userId: sub.userId, previousStatus: sub.status },
    });

    // Immediately revoke active video tokens
    await videoService.revokeTokensForUser(sub.userId);

    this.logger.info({ subscriptionId, adminId }, 'Subscription cancelled by admin');
    return updated;
  }

  /** Grant subscription to a user by user ID */
  async grant(userId: string, days: number, adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + days);

    // Upsert subscription
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    let sub;
    if (existing) {
      sub = await prisma.subscription.update({
        where: { userId },
        data: {
          status: 'active',
          currentPeriodEnd,
          retryCount: 0,
          nextRetryAt: null,
        },
      });
    } else {
      sub = await prisma.subscription.create({
        data: {
          userId,
          status: 'active',
          currentPeriodEnd,
        },
      });
    }

    await auditService.log({
      adminId,
      action: 'grant',
      entity: 'subscription',
      entityId: sub.id,
      details: { userId, days },
    });

    this.logger.info({ userId, days, adminId }, 'Subscription granted by admin');
    return sub;
  }

  /** Revoke (expire) subscription for a user by user ID */
  async revoke(userId: string, adminId: string) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundError('Subscription');

    const updated = await prisma.subscription.update({
      where: { userId },
      data: { status: 'expired', nextRetryAt: null },
    });

    await auditService.log({
      adminId,
      action: 'revoke',
      entity: 'subscription',
      entityId: sub.id,
      details: { userId, previousStatus: sub.status },
    });

    // Immediately revoke active video tokens
    await videoService.revokeTokensForUser(userId);

    this.logger.info({ userId, adminId }, 'Subscription revoked by admin');
    return updated;
  }
}

export const adminSubscriptionService = new AdminSubscriptionService();
