import { prisma } from '../lib/prisma.js';

export class ProgressService {
  /** Upsert progress for a user + lesson */
  async upsert(userId: string, lessonId: string, progress: number, lastPosition: number) {
    return prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { progress, lastPosition },
      create: { userId, lessonId, progress, lastPosition },
    });
  }

  /** Get all progress records for a user */
  async getAllForUser(userId: string) {
    return prisma.progress.findMany({
      where: { userId },
      select: {
        lessonId: true,
        progress: true,
        lastPosition: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Get single progress record */
  async getForLesson(userId: string, lessonId: string) {
    return prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: {
        lessonId: true,
        progress: true,
        lastPosition: true,
        updatedAt: true,
      },
    });
  }

  /** Get "continue watching" — latest incomplete lesson */
  async getContinueWatching(userId: string) {
    return prisma.progress.findFirst({
      where: {
        userId,
        progress: { lt: 100 },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        lessonId: true,
        progress: true,
        lastPosition: true,
        lesson: {
          select: { id: true, title: true, slug: true, order: true },
        },
      },
    });
  }

  /** Calculate overall course completion percentage for a user */
  async getCourseCompletion(userId: string) {
    const [totalLessons, progressRecords] = await Promise.all([
      prisma.lesson.count(),
      prisma.progress.findMany({
        where: { userId },
        select: { progress: true },
      }),
    ]);

    if (totalLessons === 0) return { totalLessons: 0, completedLessons: 0, overallProgress: 0 };

    const completedLessons = progressRecords.filter((p) => p.progress >= 100).length;
    const sumProgress = progressRecords.reduce((sum, p) => sum + p.progress, 0);
    const overallProgress = Math.round((sumProgress / (totalLessons * 100)) * 100);

    return { totalLessons, completedLessons, overallProgress };
  }
}

export const progressService = new ProgressService();
