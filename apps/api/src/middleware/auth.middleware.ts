import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

/** Verify Bearer token and attach userId / userRole to request */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  const payload = authService.verifyAccessToken(token);

  request.userId = payload.sub;
  request.userRole = payload.role;
}

/** Require admin role (calls requireAuth first) */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);

  if (request.userRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
}
