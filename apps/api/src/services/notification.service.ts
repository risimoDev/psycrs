import { createTransport, type Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { getEnv } from '../config/env.js';

export class NotificationService {
  private readonly logger = getLogger().child({ service: 'notification' });
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const env = getEnv();
    if (!env.SMTP_HOST || !env.SMTP_USER) {
      return null;
    }

    this.transporter = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    return this.transporter;
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const transport = this.getTransporter();
    const env = getEnv();

    if (!transport) {
      this.logger.warn({ to, subject }, 'SMTP not configured, skipping email');
      return;
    }

    try {
      await transport.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        html,
      });
      this.logger.info({ to, subject }, 'Email sent');
    } catch (err) {
      this.logger.error({ err, to, subject }, 'Failed to send email');
    }
  }

  /** Re-engagement: user hasn't visited in N days */
  async sendReEngagement(userId: string, daysSinceLastVisit: number): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;

    await this.sendEmail(
      user.email,
      'Мы скучаем! Вернитесь к обучению',
      this.wrapHtml(`
        <h2>Здравствуйте!</h2>
        <p>Вы не заходили уже <strong>${daysSinceLastVisit}</strong> дней.</p>
        <p>Продолжите курс — новые знания ждут вас!</p>
        <a href="${getEnv().CORS_ORIGIN}/course" style="display:inline-block;background:#b8956a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Продолжить обучение</a>
      `),
    );
  }

  /** New lesson published */
  async sendNewLessonNotification(lessonTitle: string): Promise<void> {
    const activeUsers = await prisma.subscription.findMany({
      where: { status: { in: ['active', 'grace_period'] } },
      select: { user: { select: { email: true } } },
    });

    for (const sub of activeUsers) {
      await this.sendEmail(
        sub.user.email,
        `Новый урок: ${lessonTitle}`,
        this.wrapHtml(`
          <h2>Новый урок!</h2>
          <p>В курсе появился новый урок: <strong>«${this.escapeHtml(lessonTitle)}»</strong></p>
          <p>Войдите, чтобы посмотреть!</p>
          <a href="${getEnv().CORS_ORIGIN}/course" style="display:inline-block;background:#b8956a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Перейти к курсу</a>
        `),
      );
    }

    this.logger.info({ lessonTitle, recipientCount: activeUsers.length }, 'New lesson notifications sent');
  }

  /** Grace period warning */
  async sendGracePeriodWarning(userId: string, retriesLeft: number): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;

    await this.sendEmail(
      user.email,
      'Проблема с оплатой подписки',
      this.wrapHtml(`
        <h2>Проблема с оплатой</h2>
        <p>Не удалось списать оплату подписки.</p>
        <p>Осталось попыток автосписания: <strong>${retriesLeft}</strong></p>
        <p>Проверьте данные карты или оплатите подписку вручную.</p>
        <a href="${getEnv().CORS_ORIGIN}/subscribe" style="display:inline-block;background:#b8956a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Продлить подписку</a>
      `),
    );
  }

  /** Find inactive users for re-engagement (utility for cron jobs) */
  async getInactiveUsers(inactiveDays: number) {
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    return prisma.$queryRaw<Array<{ id: string; email: string; last_activity: Date }>>`
      SELECT u.id, u.email, MAX(p.updated_at) AS last_activity
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      INNER JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      GROUP BY u.id, u.email
      HAVING MAX(p.updated_at) < ${cutoff} OR MAX(p.updated_at) IS NULL
    `;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private wrapHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:8px;padding:32px;border:1px solid rgba(0,0,0,0.08);">
      ${content}
    </div>
    <p style="text-align:center;color:#999;font-size:12px;margin-top:24px;">
      © PsyhoCourse. Вы получили это письмо, потому что зарегистрированы на платформе.
    </p>
  </div>
</body>
</html>`;
  }
}

export const notificationService = new NotificationService();
