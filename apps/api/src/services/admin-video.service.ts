import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { createVideoProvider } from '../providers/video/index.js';
import { getEnv } from '../config/env.js';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

interface VideoListQuery {
  page: number;
  limit: number;
  status?: string;
}

export class AdminVideoService {
  private readonly logger = getLogger().child({ service: 'admin-video' });

  async list(query: VideoListQuery) {
    const skip = (query.page - 1) * query.limit;

    const where = query.status ? { status: query.status as import('@prisma/client').VideoStatus } : {};

    const [items, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.video.count({ where }),
    ]);

    return {
      items: items.map((v) => ({
        ...v,
        size: v.size ? Number(v.size) : null,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getById(id: string) {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundError('Video');
    return { ...video, size: video.size ? Number(video.size) : null };
  }

  async upload(
    stream: Readable,
    filename: string,
    fileSize: number | undefined,
    adminId: string,
  ) {
    const videoId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Create DB record
    await prisma.video.create({
      data: {
        id: videoId,
        filename: safeFilename,
        originalName: filename,
        status: 'uploading',
        size: fileSize ? BigInt(fileSize) : null,
      },
    });

    try {
      // Upload to storage
      const env = getEnv();
      const provider = createVideoProvider({
        provider: env.VIDEO_PROVIDER,
        storagePath: env.VIDEO_STORAGE_PATH,
        logger: getLogger(),
      });

      await provider.uploadVideo(videoId, stream, safeFilename);

      // Mark as processing
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'processing' },
      });

      // Start HLS processing (async - don't await)
      this.processVideoAsync(videoId, provider, adminId);

      await auditService.log({
        adminId,
        action: 'upload',
        entity: 'video',
        entityId: videoId,
        details: { filename: safeFilename, originalName: filename },
      });

      this.logger.info({ videoId, adminId, filename: safeFilename }, 'Video uploaded, processing started');

      return {
        id: videoId,
        filename: safeFilename,
        originalName: filename,
        status: 'processing' as const,
      };
    } catch (err) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'error' },
      });
      throw err;
    }
  }

  async delete(id: string, adminId: string) {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) throw new NotFoundError('Video');

    // Check if any lesson references this video
    const lessonCount = await prisma.lesson.count({ where: { videoId: id } });
    if (lessonCount > 0) {
      throw new Error('Cannot delete video that is used by lessons');
    }

    await prisma.video.delete({ where: { id } });

    await auditService.log({
      adminId,
      action: 'delete',
      entity: 'video',
      entityId: id,
      details: { filename: video.filename },
    });

    this.logger.info({ videoId: id, adminId }, 'Video deleted');
  }

  private async processVideoAsync(
    videoId: string,
    provider: ReturnType<typeof createVideoProvider>,
    _adminId: string,
  ) {
    try {
      const result = await provider.processToHLS(videoId);

      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'ready' },
      });

      this.logger.info(
        { videoId, variants: result.variants },
        'Video processing completed',
      );
    } catch (err) {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'error' },
      });

      this.logger.error({ videoId, err }, 'Video processing failed');
    }
  }
}

export const adminVideoService = new AdminVideoService();
