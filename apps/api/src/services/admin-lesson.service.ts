import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { type ContentType } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const THUMBNAIL_DIR = path.resolve(process.cwd(), 'storage', 'thumbnails');

interface CreateLessonInput {
  title: string;
  slug: string;
  description?: string;
  videoId?: string;
  articleId?: string;
  order?: number;
  module?: number;
  duration?: number;
  isPublished?: boolean;
  contentType?: ContentType;
  pdfUrl?: string;
  thumbnailUrl?: string;
}

interface UpdateLessonInput {
  title?: string;
  slug?: string;
  description?: string;
  videoId?: string;
  articleId?: string | null;
  order?: number;
  module?: number;
  duration?: number;
  isPublished?: boolean;
  contentType?: ContentType;
  pdfUrl?: string | null;
  thumbnailUrl?: string | null;
}

interface LessonListQuery {
  page: number;
  limit: number;
}

export class AdminLessonService {
  private readonly logger = getLogger().child({ service: 'admin-lesson' });

  constructor() {
    if (!fs.existsSync(THUMBNAIL_DIR)) {
      fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
    }
  }

  async list(query: LessonListQuery) {
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.lesson.findMany({
        orderBy: { order: 'asc' },
        skip,
        take: query.limit,
      }),
      prisma.lesson.count(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getById(id: string) {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundError('Lesson');
    return lesson;
  }

  async create(input: CreateLessonInput, adminId: string) {
    const existing = await prisma.lesson.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictError('Lesson with this slug already exists');

    const lesson = await prisma.lesson.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description ?? null,
        videoId: input.videoId,
        articleId: input.articleId ?? null,
        order: input.order ?? 0,
        module: input.module ?? 1,
        duration: input.duration ?? null,
        isPublished: input.isPublished ?? false,
        contentType: input.contentType ?? 'lecture',
        pdfUrl: input.pdfUrl ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
      },
    });

    await auditService.log({
      adminId,
      action: 'create',
      entity: 'lesson',
      entityId: lesson.id,
      details: { title: lesson.title, slug: lesson.slug },
    });

    this.logger.info({ lessonId: lesson.id, adminId }, 'Lesson created');
    return lesson;
  }

  async update(id: string, input: UpdateLessonInput, adminId: string) {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundError('Lesson');

    if (input.slug && input.slug !== lesson.slug) {
      const slugTaken = await prisma.lesson.findUnique({ where: { slug: input.slug } });
      if (slugTaken) throw new ConflictError('Slug already in use');
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.videoId !== undefined && { videoId: input.videoId }),
        ...(input.articleId !== undefined && { articleId: input.articleId }),
        ...(input.order !== undefined && { order: input.order }),
        ...(input.module !== undefined && { module: input.module }),
        ...(input.duration !== undefined && { duration: input.duration }),
        ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
        ...(input.contentType !== undefined && { contentType: input.contentType }),
        ...(input.pdfUrl !== undefined && { pdfUrl: input.pdfUrl }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
      },
    });

    await auditService.log({
      adminId,
      action: 'update',
      entity: 'lesson',
      entityId: id,
      details: JSON.parse(JSON.stringify(input)),
    });

    this.logger.info({ lessonId: id, adminId }, 'Lesson updated');
    return updated;
  }

  async delete(id: string, adminId: string) {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundError('Lesson');

    // Remove old thumbnail if exists
    if (lesson.thumbnailUrl) {
      const oldFilename = lesson.thumbnailUrl.replace(/^\/thumbnails\//, '');
      const oldPath = path.join(THUMBNAIL_DIR, oldFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await prisma.lesson.delete({ where: { id } });

    await auditService.log({
      adminId,
      action: 'delete',
      entity: 'lesson',
      entityId: id,
      details: { title: lesson.title },
    });

    this.logger.info({ lessonId: id, adminId }, 'Lesson deleted');
  }

  async uploadThumbnail(id: string, fileStream: Readable, filename: string, adminId: string) {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundError('Lesson');

    // Remove old thumbnail
    if (lesson.thumbnailUrl) {
      const oldFilename = lesson.thumbnailUrl.replace(/^\/thumbnails\//, '');
      const oldPath = path.join(THUMBNAIL_DIR, oldFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    if (!allowedExts.has(ext)) {
      throw new Error('Only image files are allowed for thumbnails');
    }
    const newFilename = `${randomUUID()}${ext}`;
    const filePath = path.join(THUMBNAIL_DIR, newFilename);

    await pipeline(fileStream, fs.createWriteStream(filePath));

    const thumbnailUrl = `/thumbnails/${newFilename}`;
    const updated = await prisma.lesson.update({
      where: { id },
      data: { thumbnailUrl },
    });

    await auditService.log({
      adminId,
      action: 'upload_thumbnail',
      entity: 'lesson',
      entityId: id,
      details: { thumbnailUrl },
    });

    this.logger.info({ lessonId: id, thumbnailUrl }, 'Lesson thumbnail uploaded');
    return updated;
  }
}

export const adminLessonService = new AdminLessonService();
