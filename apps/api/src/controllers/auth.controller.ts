import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { adminUserService } from '../services/admin-user.service.js';
import { ValidationError, ForbiddenError } from '../lib/errors.js';

const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }

    const tokens = await authService.register(parsed.data.email, parsed.data.password);
    return reply.status(201).send(tokens);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }

    // Check ban before issuing tokens
    const { prisma } = await import('../lib/prisma.js');
    const userCheck = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { isBanned: true } });
    if (userCheck?.isBanned) {
      throw new ForbiddenError('Аккаунт заблокирован');
    }

    const tokens = await authService.login(parsed.data.email, parsed.data.password);

    // Track IP and user-agent on login
    const ip = request.ip ?? request.headers['x-forwarded-for']?.toString() ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    const payload = authService.verifyAccessToken(tokens.accessToken);
    adminUserService.trackLogin(payload.sub, ip, userAgent).catch(() => {});

    return reply.send(tokens);
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Missing refresh token');
    }

    const tokens = await authService.refreshTokens(parsed.data.refreshToken);
    return reply.send(tokens);
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Missing refresh token');
    }

    await authService.logout(parsed.data.refreshToken);
    return reply.status(204).send();
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await authService.getUser(request.userId);
    return reply.send(user);
  }
}

export const authController = new AuthController();
