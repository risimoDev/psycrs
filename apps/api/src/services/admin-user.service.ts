import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { getLogger } from '../lib/logger.js';

interface UserListQuery {
  page: number;
  limit: number;
  search?: string;
}

export class AdminUserService {
  private readonly logger = getLogger().child({ service: 'admin-user' });

  async list(query: UserListQuery) {
    const skip = (query.page - 1) * query.limit;

    const where = query.search
      ? { email: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isBanned: true,
          lastIp: true,
          lastLoginAt: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              currentPeriodEnd: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
        lastIp: true,
        lastUserAgent: true,
        lastLoginAt: true,
        createdAt: true,
        subscription: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
        progress: {
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: {
            lessonId: true,
            progress: true,
            lastPosition: true,
            updatedAt: true,
            lesson: {
              select: { title: true, slug: true, module: true, order: true },
            },
          },
        },
        refreshTokens: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
          },
        },
        _count: {
          select: {
            payments: true,
            progress: true,
            refreshTokens: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');
    return user;
  }

  async setBan(userId: string, banned: boolean, adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: banned },
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
    });

    // If banning, revoke all refresh tokens
    if (banned) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await auditService.log({
      adminId,
      action: banned ? 'ban' : 'unban',
      entity: 'user',
      entityId: userId,
      details: { email: user.email },
    });

    this.logger.info({ userId, banned, adminId }, `User ${banned ? 'banned' : 'unbanned'}`);
    return updated;
  }

  async setRole(userId: string, role: 'admin' | 'user', adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
    });

    await auditService.log({
      adminId,
      action: 'set_role',
      entity: 'user',
      entityId: userId,
      details: { email: user.email, role },
    });

    this.logger.info({ userId, role, adminId }, `User role set to ${role}`);
    return updated;
  }

  /** Called from auth service on login to track IP and user-agent */
  async trackLogin(userId: string, ip: string, userAgent: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastIp: ip,
        lastUserAgent: userAgent,
        lastLoginAt: new Date(),
      },
    });
  }
}

export const adminUserService = new AdminUserService();
