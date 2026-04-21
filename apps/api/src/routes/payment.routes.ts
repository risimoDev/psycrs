import type { FastifyInstance } from 'fastify';
import { paymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function paymentRoutes(app: FastifyInstance) {
  // Authenticated — start payment
  app.post(
    '/create',
    { preHandler: [requireAuth] },
    (req, reply) => paymentController.create(req, reply),
  );

  // Webhook — scoped with raw body parser for HMAC verification
  app.register(async function webhookScope(scope) {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => {
        done(null, body); // keep as Buffer for HMAC verification
      },
    );

    scope.post('/webhook', (req, reply) => paymentController.webhook(req, reply));
  });
}
