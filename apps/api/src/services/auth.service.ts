import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { getEnv } from '../config/env.js';
import { getLogger } from '../lib/logger.js';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../lib/errors.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

/** Hash a refresh token for storage (SHA-256 — fast, sufficient for random tokens) */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  private readonly logger = getLogger().child({ service: 'auth' });

  /** Register a new user and return token pair */
  async register(email: string, password: string): Promise<TokenPair> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    this.logger.info({ userId: user.id }, 'User registered');
    return this.issueTokens(user.id, user.email, user.role);
  }

  /** Login with email and password */
  async login(email: string, password: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Неверный email или пароль');
    }

    this.logger.info({ userId: user.id }, 'User logged in');
    return this.issueTokens(user.id, user.email, user.role);
  }

  /** Rotate refresh token — old token is revoked, new pair is issued */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Token not found
    if (!stored) {
      throw new UnauthorizedError('Недействительный токен сессии');
    }

    // Token already revoked — potential theft (reuse detection)
    if (stored.revokedAt) {
      this.logger.warn(
        { userId: stored.userId, tokenId: stored.id },
        'Refresh token reuse detected — revoking all tokens for user',
      );
      await this.revokeAllUserTokens(stored.userId);
      throw new ForbiddenError('Обнаружено подозрительное использование сессии — все сессии завершены');
    }

    // Token expired
    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError('Сессия истекла, войдите снова');
    }

    // Issue new pair and rotate
    const newPair = await this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
    const newHash = hashToken(newPair.refreshToken);

    // Revoke old, link to new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByHash: newHash },
    });

    this.logger.debug({ userId: stored.userId }, 'Tokens refreshed');
    return newPair;
  }

  /** Revoke a single refresh token (logout) */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Verify access token and return payload */
  verifyAccessToken(token: string): AccessTokenPayload {
    const env = getEnv();
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
      return {
        sub: payload['sub'] as string,
        email: payload['email'] as string,
        role: (payload['role'] as string) ?? 'user',
      };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  /** Get user by ID (for /me endpoint) */
  async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedError('User not found');
    return user;
  }

  // ─── Private ──────────────────────────────────────────

  private async issueTokens(userId: string, email: string, role: string): Promise<TokenPair> {
    const env = getEnv();

    const accessToken = jwt.sign(
      { sub: userId, email, role },
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const rawRefresh = randomBytes(40).toString('hex');
    const refreshHash = hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const authService = new AuthService();
