import type { FastifyInstance } from 'fastify';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', (req, reply) => authController.register(req, reply));
  app.post('/login', (req, reply) => authController.login(req, reply));
  app.post('/refresh', (req, reply) => authController.refresh(req, reply));
  app.post('/logout', (req, reply) => authController.logout(req, reply));
  app.get('/me', { preHandler: [requireAuth] }, (req, reply) => authController.me(req, reply));
}
