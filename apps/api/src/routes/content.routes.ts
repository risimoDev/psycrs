import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { contentService } from '../services/content.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { ValidationError } from '../lib/errors.js';

const VALID_TYPES = ['lecture', 'affirmation', 'article_pdf'] as const;

export async function contentRoutes(app: FastifyInstance) {
  // GET /content?type=lecture|affirmation|article_pdf
  app.get(
    '/',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const query = z
        .object({ type: z.enum(VALID_TYPES) })
        .safeParse(req.query);

      if (!query.success) {
        throw new ValidationError('type must be one of: lecture, affirmation, article_pdf');
      }

      const items = await contentService.listByType(req.userId, query.data.type);
      return reply.send(items);
    },
  );

  // GET /content/:id  — single item
  app.get(
    '/:id',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const item = await contentService.getById(req.userId, id);
      return reply.send(item);
    },
  );

  // POST /content/:id/mark-viewed   body: { viewed: boolean }
  app.post(
    '/:id/mark-viewed',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const body = z
        .object({ viewed: z.boolean() })
        .safeParse(req.body);

      if (!body.success) {
        throw new ValidationError('viewed must be a boolean');
      }

      const result = await contentService.markViewed(req.userId, id, body.data.viewed);
      return reply.send(result);
    },
  );
}
