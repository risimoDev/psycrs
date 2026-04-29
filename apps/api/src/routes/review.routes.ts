import type { FastifyInstance } from 'fastify';
import { reviewController } from '../controllers/review.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function reviewRoutes(app: FastifyInstance) {
  // Public — approved reviews for landing page carousel
  app.get('/', (req, reply) => reviewController.listPublic(req, reply));

  // Authenticated — create review, get my review status, claim gift
  app.post('/', { preHandler: [requireAuth] }, (req, reply) => reviewController.create(req, reply));
  app.get('/my', { preHandler: [requireAuth] }, (req, reply) => reviewController.getMyReview(req, reply));
  app.post('/claim-gift', { preHandler: [requireAuth] }, (req, reply) => reviewController.claimGift(req, reply));
}
