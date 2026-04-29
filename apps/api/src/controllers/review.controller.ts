import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { reviewService } from '../services/review.service.js';
import { adminReviewService } from '../services/admin-review.service.js';
import { ValidationError } from '../lib/errors.js';

const createReviewSchema = z.object({
  name: z.string().min(1).max(100),
  text: z.string().min(10).max(2000),
  rating: z.number().int().min(1).max(5).default(5),
});

export class ReviewController {
  async listPublic(_request: FastifyRequest, reply: FastifyReply) {
    const reviews = await reviewService.getPublicApproved();
    return reply.send(reviews);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid review data');
    }
    const review = await reviewService.create(
      request.userId,
      parsed.data.name,
      parsed.data.text,
      parsed.data.rating,
    );
    return reply.status(201).send(review);
  }

  async getMyReview(request: FastifyRequest, reply: FastifyReply) {
    const review = await reviewService.getMyReview(request.userId);
    const giftPdfUrl = review?.status === 'approved' && !review.giftClaimed
      ? await adminReviewService.getGiftPdfUrl()
      : null;
    return reply.send({ review, giftAvailable: !!giftPdfUrl, giftPdfUrl });
  }

  async claimGift(request: FastifyRequest, reply: FastifyReply) {
    const review = await reviewService.getMyReview(request.userId);
    if (!review || review.status !== 'approved') {
      throw new ValidationError('Нет одобренного отзыва для получения подарка');
    }
    const giftPdfUrl = await adminReviewService.getGiftPdfUrl();
    if (!giftPdfUrl) {
      throw new ValidationError('Подарок пока недоступен');
    }
    await adminReviewService.claimGift(review.id);
    return reply.send({ giftPdfUrl });
  }
}

export const reviewController = new ReviewController();
