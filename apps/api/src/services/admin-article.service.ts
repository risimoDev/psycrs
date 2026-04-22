import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, unlink, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID, createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { getEnv } from '../config/env.js';

export class AdminArticleService {
  private readonly logger = getLogger().child({ service: 'admin-article' });

  private storagePath(): string {
    const env = getEnv();
    // Store articles alongside videos in storage root
    return join(dirname(env.VIDEO_STORAGE_PATH), 'articles');
  }

  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.article.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          filename: true,
          originalName: true,
          size: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { lessons: true } },
        },
      }),
      prisma.article.count(),
    ]);

    return {
      items: items.map((a: typeof items[number]) => ({
        ...a,
        size: a.size ? Number(a.size) : null,
        lessonCount: a._count.lessons,
      })),
      total,
      page,
      limit,
    };
  }

  async upload(stream: Readable, filename: string, _fileSize: number | undefined, adminId: string) {
    const articleId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = this.storagePath();
    const filePath = join(storagePath, `${articleId}.pdf`);

    await mkdir(storagePath, { recursive: true });

    const ws = createWriteStream(filePath);
    await pipeline(stream, ws);

    const info = await stat(filePath);

    const article = await prisma.article.create({
      data: {
        id: articleId,
        filename: safeFilename,
        originalName: filename,
        size: BigInt(info.size),
      },
    });

    await auditService.log({
      adminId,
      action: 'upload_article',
      entity: 'article',
      entityId: articleId,
      details: { filename },
    });

    this.logger.info({ articleId, filename }, 'Article PDF uploaded');
    return { ...article, size: Number(article.size) };
  }

  async delete(id: string, adminId: string) {
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundError('Article');

    // Delete file
    const filePath = join(this.storagePath(), `${id}.pdf`);
    try {
      await unlink(filePath);
    } catch {
      // file may not exist
    }

    await prisma.article.delete({ where: { id } });

    await auditService.log({
      adminId,
      action: 'delete_article',
      entity: 'article',
      entityId: id,
      details: { filename: article.originalName },
    });
  }

  /** Issue a short-lived signed token for reading a specific article */
  async requestToken(userId: string, articleId: string, ip?: string): Promise<string> {
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundError('Article');

    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await prisma.articleToken.create({
      data: {
        userId,
        articleId,
        tokenHash,
        issuedIp: ip ?? null,
        expiresAt,
      },
    });

    return rawToken;
  }

  /** Serve a PDF file after validating the token */
  async serveArticle(rawToken: string): Promise<{ stream: Readable; filename: string; size: number }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await prisma.articleToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { article: true },
    });

    if (!record) throw new NotFoundError('Token');

    // Token is NOT revoked on read — PDF.js needs to fetch the full binary and
    // the token is already user-bound + short-lived (30 min TTL).

    const filePath = join(this.storagePath(), `${record.articleId}.pdf`);
    return {
      stream: createReadStream(filePath),
      filename: record.article.originalName,
      size: record.article.size ? Number(record.article.size) : 0,
    };
  }
}

export const adminArticleService = new AdminArticleService();
