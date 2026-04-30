import type { FastifyInstance } from 'fastify';
import { promoController } from '../controllers/promo.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function promoRoutes(app: FastifyInstance) {
  // Authenticated — validate promo code
  app.post(
    '/validate',
    { preHandler: [requireAuth] },
    (req, reply) => promoController.validate(req, reply),
  );
}
