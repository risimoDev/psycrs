import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  /** GET /subscription/status — current user's subscription state */
  app.get(
    '/status',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const sub = await prisma.subscription.findUnique({
        where: { userId: request.userId },
        select: { status: true, currentPeriodEnd: true },
      });

      return reply.send({
        status: sub?.status ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      });
    },
  );
}
