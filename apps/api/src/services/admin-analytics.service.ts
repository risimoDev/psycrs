import { prisma } from '../lib/prisma.js';

export class AdminAnalyticsService {
  async getDashboard() {
    const [
      totalUsers,
      activeSubscriptions,
      gracePeriodSubscriptions,
      expiredSubscriptions,
      revenueResult,
      recentPayments,
      usersByMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'grace_period' } }),
      prisma.subscription.count({ where: { status: 'expired' } }),
      prisma.payment.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { status: 'succeeded' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      this.getUsersByMonth(),
    ]);

    const totalRevenue = revenueResult._sum.amount
      ? Number(revenueResult._sum.amount)
      : 0;
    const totalPayments = revenueResult._count;

    // MRR = active subscriptions * price
    const mrr = activeSubscriptions * 2990;

    // Churn rate = expired / (active + expired + grace_period)
    const totalSubs = activeSubscriptions + gracePeriodSubscriptions + expiredSubscriptions;
    const churnRate = totalSubs > 0
      ? Math.round((expiredSubscriptions / totalSubs) * 10000) / 100
      : 0;

    return {
      totalUsers,
      activeSubscriptions,
      gracePeriodSubscriptions,
      expiredSubscriptions,
      totalRevenue,
      totalPayments,
      mrr,
      churnRate,
      recentPayments,
      usersByMonth,
    };
  }

  /** Retention metrics: DAU, WAU, MAU, 7/30-day retention */
  async getRetentionMetrics() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dau, wau, mau, retention7d, retention30d, avgCourseCompletion] = await Promise.all([
      // DAU — distinct users with progress updates in last 24h
      prisma.progress.groupBy({
        by: ['userId'],
        where: { updatedAt: { gte: oneDayAgo } },
      }).then((r) => r.length),

      // WAU — distinct users in last 7 days
      prisma.progress.groupBy({
        by: ['userId'],
        where: { updatedAt: { gte: sevenDaysAgo } },
      }).then((r) => r.length),

      // MAU — distinct users in last 30 days
      prisma.progress.groupBy({
        by: ['userId'],
        where: { updatedAt: { gte: thirtyDaysAgo } },
      }).then((r) => r.length),

      // 7-day retention: users created > 7 days ago who were active in last 7 days
      this.calculateRetention(7),

      // 30-day retention: users created > 30 days ago who were active in last 30 days
      this.calculateRetention(30),

      // Average course completion across all users with any progress
      this.getAvgCourseCompletion(),
    ]);

    return { dau, wau, mau, retention7d, retention30d, avgCourseCompletion };
  }

  private async calculateRetention(days: number): Promise<number> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.$queryRaw<Array<{ cohort: bigint; retained: bigint }>>`
      SELECT
        COUNT(DISTINCT u.id) AS cohort,
        COUNT(DISTINCT p.user_id) AS retained
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id AND p.updated_at >= ${cutoff}
      WHERE u.created_at < ${cutoff}
    `;

    const row = result[0];
    if (!row || Number(row.cohort) === 0) return 0;
    return Math.round((Number(row.retained) / Number(row.cohort)) * 10000) / 100;
  }

  private async getAvgCourseCompletion(): Promise<number> {
    const totalLessons = await prisma.lesson.count();
    if (totalLessons === 0) return 0;

    const result = await prisma.$queryRaw<Array<{ avg_pct: number }>>`
      SELECT COALESCE(AVG(user_pct), 0) AS avg_pct FROM (
        SELECT user_id, SUM(progress) / (${totalLessons} * 100.0) * 100 AS user_pct
        FROM progress
        GROUP BY user_id
      ) sub
    `;

    return Math.round((result[0]?.avg_pct ?? 0) * 100) / 100;
  }

  private async getUsersByMonth(): Promise<Array<{ month: string; count: number }>> {
    const result = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*)::bigint AS count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `;

    return result.map((r) => ({ month: r.month, count: Number(r.count) }));
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
