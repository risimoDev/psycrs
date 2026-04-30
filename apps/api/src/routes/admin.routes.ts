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
  app.patch('/reviews/:id/approve', (req, reply) => adminController.approveReview(req, reply));
  app.patch('/reviews/:id/reject', (req, reply) => adminController.rejectReview(req, reply));
  app.post('/gift-pdf', (req, reply) => adminController.uploadGiftPdf(req, reply));

  // ── Tariffs ───────────────────────────────────────
  app.get('/tariffs', (req, reply) => adminController.listTariffs(req, reply));
  app.post('/tariffs', (req, reply) => adminController.createTariff(req, reply));
  app.patch('/tariffs/:id', (req, reply) => adminController.updateTariff(req, reply));
  app.delete('/tariffs/:id', (req, reply) => adminController.deleteTariff(req, reply));

  // ── Articles ──────────────────────────────────────
  app.get('/articles', (req, reply) => adminController.listArticles(req, reply));
  app.post('/articles/upload', (req, reply) => adminController.uploadArticle(req, reply));
  app.delete('/articles/:id', (req, reply) => adminController.deleteArticle(req, reply));

  // ── Promo Codes ───────────────────────────────────
  app.get('/promo-codes', (req, reply) => adminController.listPromoCodes(req, reply));
  app.post('/promo-codes', (req, reply) => adminController.createPromoCode(req, reply));
  app.patch('/promo-codes/:id', (req, reply) => adminController.updatePromoCode(req, reply));
  app.delete('/promo-codes/:id', (req, reply) => adminController.deletePromoCode(req, reply));
}
