import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import * as nodePath from 'node:path';
import { getEnv } from './config/env.js';
import { getLogger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { ZodError } from 'zod';
import { authRoutes } from './routes/auth.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { progressRoutes } from './routes/progress.routes.js';
import { reviewRoutes } from './routes/review.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { tariffRoutes } from './routes/tariff.routes.js';
import { videoRoutes } from './routes/video.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { articleRoutes } from './routes/article.routes.js';
import { thumbnailRoutes } from './routes/thumbnail.routes.js';

// Augment FastifyRequest globally with auth context
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userRole: string;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();
  const logger = getLogger();

  const app = Fastify({ logger: false, trustProxy: true });

  // ─── Security ─────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
  });

  // ─── Multipart (file uploads) ──────────────────────
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024 * 1024, // 5 GB
      files: 1,
    },
  });

  // ─── Error handler ────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError || error?.name === 'ZodError') {
      const issues = (error as unknown as ZodError).issues ?? (error as unknown as { issues?: { message: string }[] }).issues;
      return reply.status(400).send({ message: issues?.[0]?.message ?? 'Validation error' });
    }

    if (error instanceof AppError) {
      // DuplicateWebhookError returns 200 OK
      if (error.statusCode === 200) {
        return reply.status(200).send({ status: 'ok' });
      }
      return reply.status(error.statusCode).send({ message: error.message });
    }

    // Fastify rate-limit returns its own response — let it through
    if (error.statusCode === 429) {
      return reply.status(429).send({ message: 'Too many requests' });
    }

    logger.error({ err: error, url: request.url }, 'Unhandled error');
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return reply.status(500).send({ message: msg });
  });

  // ─── Static file serving (review images, etc.) ───────────
  await app.register(staticPlugin, {
    root: nodePath.resolve(process.cwd(), 'storage'),
    prefix: '/storage/',
    decorateReply: false,
  });

  // ─── Health check ─────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString(), v: '2' }));

  // ─── Debug: list registered routes ────────────────────
  app.get('/health/routes', async (_req, reply) => {
    const routes = app.printRoutes({ commonPrefix: false });
    return reply.type('text/plain').send(routes);
  });

  // ─── Routes ───────────────────────────────────────
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(videoRoutes, { prefix: '/video' });
  await app.register(contentRoutes, { prefix: '/content' });
  await app.register(progressRoutes, { prefix: '/progress' });
  await app.register(paymentRoutes, { prefix: '/payment' });
  await app.register(subscriptionRoutes, { prefix: '/subscription' });
  await app.register(reviewRoutes, { prefix: '/reviews' });
  await app.register(tariffRoutes, { prefix: '/tariffs' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(articleRoutes, { prefix: '/articles' });
  await app.register(thumbnailRoutes, { prefix: '/thumbnails' });

  return app;
}
