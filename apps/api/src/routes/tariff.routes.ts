import type { FastifyInstance } from 'fastify';
import { adminTariffService } from '../services/admin-tariff.service.js';

export async function tariffRoutes(app: FastifyInstance) {
  // Public route — active tariffs for the subscribe page
  app.get('/', async (_request, reply) => {
    const tariffs = await adminTariffService.listPublic();
    return reply.send(tariffs);
  });
}
