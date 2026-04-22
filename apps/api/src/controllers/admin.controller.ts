import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminLessonService } from '../services/admin-lesson.service.js';
import { adminUserService } from '../services/admin-user.service.js';
import { adminSubscriptionService } from '../services/admin-subscription.service.js';
import { adminAnalyticsService } from '../services/admin-analytics.service.js';
import { adminVideoService } from '../services/admin-video.service.js';
import { adminArticleService } from '../services/admin-article.service.js';
import { adminReviewService } from '../services/admin-review.service.js';
import { adminTariffService } from '../services/admin-tariff.service.js';
import { settingsService } from '../services/settings.service.js';
import { ValidationError } from '../lib/errors.js';

// ─── Schemas ────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  videoId: z.string().min(1).optional(),
  articleId: z.string().uuid().optional(),
  order: z.number().int().min(0).optional(),
  module: z.number().int().min(1).optional(),
  duration: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  contentType: z.enum(['lecture', 'affirmation', 'article_pdf']).optional(),
  pdfUrl: z.string().url().optional(),
});

const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  videoId: z.string().min(1).optional(),
  articleId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
  module: z.number().int().min(1).optional(),
  duration: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  contentType: z.enum(['lecture', 'affirmation', 'article_pdf']).optional(),
  pdfUrl: z.string().url().nullable().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const userListSchema = paginationSchema.extend({
  search: z.string().optional(),
});

const subListSchema = paginationSchema.extend({
  status: z.enum(['active', 'grace_period', 'expired', 'cancelled']).optional(),
});

const createReviewSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  text: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

const updateReviewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().max(100).optional(),
  text: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

const grantSubscriptionSchema = z.object({
  days: z.number().int().min(1).max(3650).default(30),
});

const createTariffSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0),
  oldPrice: z.number().int().min(0).optional(),
  period: z.enum(['month', 'year', 'lifetime']).optional(),
  features: z.array(z.string().max(300)).max(20).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

const updateTariffSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0).optional(),
  oldPrice: z.number().int().min(0).nullable().optional(),
  period: z.enum(['month', 'year', 'lifetime']).optional(),
  features: z.array(z.string().max(300)).max(20).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ─── Controller ─────────────────────────────────────────

export class AdminController {
  // ── Lessons ─────────────────────────────────────────

  async listLessons(request: FastifyRequest, reply: FastifyReply) {
    const query = paginationSchema.parse(request.query);
    const result = await adminLessonService.list(query);
    return reply.send(result);
  }

  async getLesson(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const lesson = await adminLessonService.getById(id);
    return reply.send(lesson);
  }

  async createLesson(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createLessonSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }
    const lesson = await adminLessonService.create(parsed.data, request.userId);
    return reply.status(201).send(lesson);
  }

  async updateLesson(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const parsed = updateLessonSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }
    const lesson = await adminLessonService.update(id, parsed.data, request.userId);
    return reply.send(lesson);
  }

  async deleteLesson(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await adminLessonService.delete(id, request.userId);
    return reply.status(204).send();
  }

  // ── Users ───────────────────────────────────────────

  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const query = userListSchema.parse(request.query);
    const result = await adminUserService.list(query);
    return reply.send(result);
  }

  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const user = await adminUserService.getById(id);
    return reply.send(user);
  }

  // ── Subscriptions ───────────────────────────────────

  async listSubscriptions(request: FastifyRequest, reply: FastifyReply) {
    const query = subListSchema.parse(request.query);
    const result = await adminSubscriptionService.list(query);
    return reply.send(result);
  }

  async cancelSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const result = await adminSubscriptionService.cancel(id, request.userId);
    return reply.send(result);
  }

  // ── Dashboard / Analytics ───────────────────────────

  async getDashboard(_request: FastifyRequest, reply: FastifyReply) {
    const data = await adminAnalyticsService.getDashboard();
    return reply.send(data);
  }

  async getRetention(_request: FastifyRequest, reply: FastifyReply) {
    const data = await adminAnalyticsService.getRetentionMetrics();
    return reply.send(data);
  }

  // ── Videos ──────────────────────────────────────────

  async listVideos(request: FastifyRequest, reply: FastifyReply) {
    const query = paginationSchema.extend({
      status: z.string().optional(),
    }).parse(request.query);
    const result = await adminVideoService.list(query);
    return reply.send(result);
  }

  async getVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const video = await adminVideoService.getById(id);
    return reply.send(video);
  }

  async uploadVideo(request: FastifyRequest, reply: FastifyReply) {
    const file = await request.file();
    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    const result = await adminVideoService.upload(
      file.file,
      file.filename,
      file.fields?.size ? Number(file.fields.size) : undefined,
      request.userId,
    );

    return reply.status(201).send(result);
  }

  async deleteVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await adminVideoService.delete(id, request.userId);
    return reply.status(204).send();
  }

  // ── Settings ────────────────────────────────────────

  async getSettings(_request: FastifyRequest, reply: FastifyReply) {
    const data = await settingsService.getAll();
    return reply.send(data);
  }

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as Record<string, string>;
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Invalid settings data');
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(body)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new ValidationError(`Invalid setting: ${key}`);
      }
    }

    const data = await settingsService.updateMany(body, request.userId);
    return reply.send(data);
  }

  // ── Reviews ─────────────────────────────────────────

  async listReviews(request: FastifyRequest, reply: FastifyReply) {
    const query = paginationSchema.parse(request.query);
    const result = await adminReviewService.list(query);
    return reply.send(result);
  }

  async createReview(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }
    const review = await adminReviewService.create(parsed.data, request.userId);
    return reply.status(201).send(review);
  }

  async updateReview(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const parsed = updateReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }
    const review = await adminReviewService.update(id, parsed.data, request.userId);
    return reply.send(review);
  }

  async uploadReviewImage(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const file = await request.file();
    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new ValidationError('Only jpeg, png, webp, gif images are allowed');
    }

    const review = await adminReviewService.uploadImage(id, file.file, file.filename, request.userId);
    return reply.send(review);
  }

  async deleteReview(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await adminReviewService.delete(id, request.userId);
    return reply.status(204).send();
  }

  // ── User Management (ban/unban) ─────────────────────

  async banUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const user = await adminUserService.setBan(id, true, request.userId);
    return reply.send(user);
  }

  async unbanUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const user = await adminUserService.setBan(id, false, request.userId);
    return reply.send(user);
  }

  async setUserRole(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const { role } = z.object({ role: z.enum(['admin', 'user']) }).parse(request.body);
    const user = await adminUserService.setRole(id, role, request.userId);
    return reply.send(user);
  }

  // ── Subscription Grant/Revoke ───────────────────────

  async grantSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const { days } = grantSubscriptionSchema.parse(request.body);
    const result = await adminSubscriptionService.grant(id, days, request.userId);
    return reply.send(result);
  }

  async revokeSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const result = await adminSubscriptionService.revoke(id, request.userId);
    return reply.send(result);
  }
  // ── Tariffs ─────────────────────────────────────────

  async listTariffs(request: FastifyRequest, reply: FastifyReply) {
    const query = paginationSchema.parse(request.query);
    const result = await adminTariffService.list(query);
    return reply.send(result);
  }

  async createTariff(request: FastifyRequest, reply: FastifyReply) {
    const data = createTariffSchema.parse(request.body);
    const tariff = await adminTariffService.create(data, request.userId);
    return reply.status(201).send(tariff);
  }

  async updateTariff(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const data = updateTariffSchema.parse(request.body);
    const tariff = await adminTariffService.update(id, data, request.userId);
    return reply.send(tariff);
  }

  async deleteTariff(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await adminTariffService.delete(id, request.userId);
    return reply.status(204).send();
  }

  // ── Articles ─────────────────────────────────────────

  async listArticles(request: FastifyRequest, reply: FastifyReply) {
    const query = paginationSchema.parse(request.query);
    const result = await adminArticleService.list(query.page, query.limit);
    return reply.send(result);
  }

  async uploadArticle(request: FastifyRequest, reply: FastifyReply) {
    const data = await request.file();
    if (!data) throw new ValidationError('No file provided');
    if (!data.filename.toLowerCase().endsWith('.pdf') && data.mimetype !== 'application/pdf') {
      throw new ValidationError('Only PDF files are allowed');
    }
    const result = await adminArticleService.upload(
      data.file,
      data.filename,
      undefined,
      request.userId,
    );
    return reply.status(201).send(result);
  }

  async deleteArticle(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await adminArticleService.delete(id, request.userId);
    return reply.status(204).send();
  }
}

export const adminController = new AdminController();
