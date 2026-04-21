import type { FastifyInstance } from 'fastify';
import { adminReviewService } from '../services/admin-review.service.js';

export async function reviewRoutes(app: FastifyInstance) {
  // Public route — visible reviews for the landing page
  app.get('/', async (_request, reply) => {
    const reviews = await adminReviewService.getPublicReviews();
    return reply.send(reviews);
  });
}
