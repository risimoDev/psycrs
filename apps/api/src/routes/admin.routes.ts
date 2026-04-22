import type { FastifyInstance } from 'fastify';
import { adminController } from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require admin role
  app.addHook('preHandler', requireAdmin);

  // ── Dashboard ─────────────────────────────────────
  app.get('/dashboard', (req, reply) => adminController.getDashboard(req, reply));
  app.get('/retention', (req, reply) => adminController.getRetention(req, reply));

  // ── Lessons ───────────────────────────────────────
  app.get('/lessons', (req, reply) => adminController.listLessons(req, reply));
  app.get('/lessons/:id', (req, reply) => adminController.getLesson(req, reply));
  app.post('/lessons', (req, reply) => adminController.createLesson(req, reply));
  app.patch('/lessons/:id', (req, reply) => adminController.updateLesson(req, reply));
  app.delete('/lessons/:id', (req, reply) => adminController.deleteLesson(req, reply));
  app.post('/lessons/:id/thumbnail', (req, reply) => adminController.uploadLessonThumbnail(req, reply));

  // ── Videos ────────────────────────────────────────
  app.get('/videos', (req, reply) => adminController.listVideos(req, reply));
  app.get('/videos/:id', (req, reply) => adminController.getVideo(req, reply));
  app.post('/videos/upload', (req, reply) => adminController.uploadVideo(req, reply));
  app.delete('/videos/:id', (req, reply) => adminController.deleteVideo(req, reply));

  // ── Settings ──────────────────────────────────────
  app.get('/settings', (req, reply) => adminController.getSettings(req, reply));
  app.put('/settings', (req, reply) => adminController.updateSettings(req, reply));

  // ── Users ─────────────────────────────────────────
  app.get('/users', (req, reply) => adminController.listUsers(req, reply));
  app.get('/users/:id', (req, reply) => adminController.getUser(req, reply));
  app.post('/users/:id/ban', (req, reply) => adminController.banUser(req, reply));
  app.post('/users/:id/unban', (req, reply) => adminController.unbanUser(req, reply));
  app.post('/users/:id/role', (req, reply) => adminController.setUserRole(req, reply));

  // ── Subscriptions ─────────────────────────────────
  app.get('/subscriptions', (req, reply) => adminController.listSubscriptions(req, reply));
  app.post('/subscriptions/:id/cancel', (req, reply) => adminController.cancelSubscription(req, reply));
  app.post('/subscriptions/:id/grant', (req, reply) => adminController.grantSubscription(req, reply));
  app.post('/subscriptions/:id/revoke', (req, reply) => adminController.revokeSubscription(req, reply));

  // ── Reviews ───────────────────────────────────────
  app.get('/reviews', (req, reply) => adminController.listReviews(req, reply));
  app.post('/reviews', (req, reply) => adminController.createReview(req, reply));
  app.patch('/reviews/:id', (req, reply) => adminController.updateReview(req, reply));
  app.post('/reviews/:id/image', (req, reply) => adminController.uploadReviewImage(req, reply));
  app.delete('/reviews/:id', (req, reply) => adminController.deleteReview(req, reply));

  // ── Tariffs ───────────────────────────────────────
  app.get('/tariffs', (req, reply) => adminController.listTariffs(req, reply));
  app.post('/tariffs', (req, reply) => adminController.createTariff(req, reply));
  app.patch('/tariffs/:id', (req, reply) => adminController.updateTariff(req, reply));
  app.delete('/tariffs/:id', (req, reply) => adminController.deleteTariff(req, reply));

  // ── Articles ──────────────────────────────────────
  app.get('/articles', (req, reply) => adminController.listArticles(req, reply));
  app.post('/articles/upload', (req, reply) => adminController.uploadArticle(req, reply));
  app.delete('/articles/:id', (req, reply) => adminController.deleteArticle(req, reply));
}
