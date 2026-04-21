import type { FastifyInstance } from 'fastify';
import { progressController } from '../controllers/progress.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function progressRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { preHandler: [requireAuth] },
    (req, reply) => progressController.upsert(req, reply),
  );

  app.get(
    '/',
    { preHandler: [requireAuth] },
    (req, reply) => progressController.getAll(req, reply),
  );

  app.get(
    '/continue',
    { preHandler: [requireAuth] },
    (req, reply) => progressController.continueWatching(req, reply),
  );

  app.get(
    '/completion',
    { preHandler: [requireAuth] },
    (req, reply) => progressController.courseCompletion(req, reply),
  );
}
