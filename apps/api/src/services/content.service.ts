import { type ContentType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  order: number;
  contentType: ContentType;
  pdfUrl: string | null;
  articleId: string | null;
  duration: number | null;
  isMarkedViewed: boolean;
  videoId: string | null;
}

export class ContentService {
  /**
   * List content by type for authenticated user.
   * Also attaches per-user `isMarkedViewed` flag from Progress table.
   */
  async listByType(userId: string, type: ContentType): Promise<ContentItem[]> {
    await this.requireActiveSubscription(userId);

    const lessons = await prisma.lesson.findMany({
      where: { contentType: type, isPublished: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        order: true,
        contentType: true,
        pdfUrl: true,
        articleId: true,
        duration: true,
        videoId: true,
      },
    });

    if (lessons.length === 0) return [];

    const lessonIds = lessons.map((l) => l.id);

    const progressRecords = await prisma.progress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, isMarkedViewed: true },
    });

    const viewedMap = new Map<string, boolean>(
      progressRecords.map((p) => [p.lessonId, p.isMarkedViewed]),
    );

    return lessons.map((lesson) => ({
      ...lesson,
      isMarkedViewed: viewedMap.get(lesson.id) ?? false,
    }));
  }

  /**
   * Get a single content item by id.
   * Also checks active subscription and returns isMarkedViewed for this user.
   */
  async getById(userId: string, lessonId: string): Promise<ContentItem> {
    await this.requireActiveSubscription(userId);

    this.logger.debug({ userId, lessonId }, 'Fetching content item');

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId, isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        order: true,
        contentType: true,
        pdfUrl: true,
        articleId: true,
        duration: true,
        videoId: true,
      },
    });

    if (!lesson) throw new NotFoundError('Content');

    this.logger.warn({ userId, lessonId }, 'Content not found');
    
    const progress = await prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { isMarkedViewed: true },
    });

    return { ...lesson, isMarkedViewed: progress?.isMarkedViewed ?? false };
  }

  /**
   * Toggle isMarkedViewed for a user+lesson.
   * Creates or updates a Progress record.
   */
  async markViewed(userId: string, lessonId: string, viewed: boolean): Promise<{ isMarkedViewed: boolean }> {
    await this.requireActiveSubscription(userId);

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId, isPublished: true },
      select: { id: true },
    });

    if (!lesson) throw new NotFoundError('Content');

    await prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { isMarkedViewed: viewed },
      create: { userId, lessonId, progress: 0, lastPosition: 0, isMarkedViewed: viewed },
    });

    return { isMarkedViewed: viewed };
  }

  // ─── Private helpers ──────────────────────────────

    private async requireActiveSubscription(userId: string): Promise<void> {
      const sub = await prisma.subscription.findUnique({ where: { userId } });

      this.logger.debug({ 
          userId, 
          subscriptionStatus: sub?.status, 
          periodEnd: sub?.currentPeriodEnd?.toISOString() 
        }, 'Checking subscription access');

      const now = new Date();
      const isActive =
        sub &&
        (sub.status === 'active' || sub.status === 'grace_period') &&
        sub.currentPeriodEnd.getTime() > now.getTime(); // ✅ Надёжное сравнение
      if (!isActive) throw new ForbiddenError('Active subscription required');
    }
}

export const contentService = new ContentService();
