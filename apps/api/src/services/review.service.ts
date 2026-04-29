import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';

export class ReviewService {
  private readonly logger = getLogger().child({ service: 'review' });

  async create(userId: string, name: string, text: string, rating = 5) {
    const existing = await prisma.userReview.findFirst({
      where: { userId },
    });
    if (existing) {
      const err = new Error('Вы уже оставили отзыв');
      (err as { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const review = await prisma.userReview.create({
      data: { userId, name, text, rating },
    });

    this.logger.info({ reviewId: review.id, userId }, 'Review created');
    return review;
  }

  async getPublicApproved() {
    return prisma.userReview.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        text: true,
        rating: true,
        createdAt: true,
      },
    });
  }

  async getMyReview(userId: string) {
    return prisma.userReview.findFirst({
      where: { userId },
      select: {
        id: true,
        name: true,
        text: true,
        rating: true,
        status: true,
        giftClaimed: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}

export const reviewService = new ReviewService();
