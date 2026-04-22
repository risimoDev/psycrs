import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { adminArticleService } from '../services/admin-article.service.js';
import { ValidationError } from '../lib/errors.js';
import { contentService } from '../services/content.service.js';
import { prisma } from '../lib/prisma.js';

export async function articleRoutes(app: FastifyInstance) {
  /**
   * POST /articles/request-token
   * Authenticated user requests a one-time token to read a specific article.
   * We check that the lesson (and thus the article) belongs to a published content
   * and the user has an active subscription.
   */
  app.post(
    '/request-token',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const body = z
        .object({ lessonId: z.string().uuid() })
        .safeParse(req.body);

      if (!body.success) throw new ValidationError('lessonId is required');

      // Verify subscription via content service
      await contentService.getById(req.userId, body.data.lessonId);

      // Look up articleId directly — decoupled from ContentItem to avoid DB column dependency
      const lesson = await prisma.lesson.findUnique({
        where: { id: body.data.lessonId },
        select: { articleId: true },
      });

      const articleId = lesson?.articleId;
      if (!articleId) throw new ValidationError('No article attached to this lesson');

      const token = await adminArticleService.requestToken(
        req.userId,
        articleId,
        req.ip,
      );

      return reply.send({ token });
    },
  );

  /**
   * GET /articles/read?token=xxx
   * Serve the PDF inline (no download). Token is single-use.
   * No auth header required — token IS the auth.
   */
  app.get('/read', async (req, reply) => {
    const query = z
      .object({ token: z.string().min(10) })
      .safeParse(req.query);

    if (!query.success) throw new ValidationError('Invalid token');

    const { stream, filename, size } = await adminArticleService.serveArticle(query.data.token);

    const reply2 = reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'no-store')
      .header('X-Frame-Options', 'SAMEORIGIN');

    if (size > 0) reply2.header('Content-Length', String(size));

    return reply2.send(stream);
  });
}
