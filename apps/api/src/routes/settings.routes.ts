import type { FastifyInstance } from 'fastify';
import { settingsService } from '../services/settings.service.js';

export async function settingsRoutes(app: FastifyInstance) {
  // Public endpoint — returns only public-safe settings
  app.get('/', async (_req, reply) => {
    const data = await settingsService.getPublic();
    return reply.send(data);
  });
}
