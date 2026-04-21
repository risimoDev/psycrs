import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { getLogger } from '../lib/logger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const UPLOAD_DIR = path.resolve(process.cwd(), 'storage', 'reviews');

interface ReviewListQuery {
  page: number;
  limit: number;
}

interface CreateReviewInput {
  name: string;
  role?: string;
  text?: string;
  order?: number;
  isVisible?: boolean;
}

interface UpdateReviewInput {
  name?: string;
  role?: string;
  text?: string;
  order?: number;
  isVisible?: boolean;
}

export class AdminReviewService {
  private readonly logger = getLogger().child({ service: 'admin-review' });

  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async list(query: ReviewListQuery) {
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        orderBy: { order: 'asc' },
        skip,
        take: query.limit,
      }),
      prisma.review.count(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async create(input: CreateReviewInput, adminId: string) {
    const review = await prisma.review.create({
      data: {
        name: input.name,
        role: input.role ?? null,
        text: input.text ?? null,
        order: input.order ?? 0,
        isVisible: input.isVisible ?? true,
      },
    });

    await auditService.log({
      adminId,
      action: 'create',
      entity: 'review',
      entityId: review.id,
      details: { name: input.name },
    });

    return review;
  }

  async update(id: string, input: UpdateReviewInput, adminId: string) {
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Review');

    const review = await prisma.review.update({
      where: { id },
      data: input,
    });

    await auditService.log({
      adminId,
      action: 'update',
      entity: 'review',
      entityId: id,
      details: JSON.parse(JSON.stringify(input)),
    });

    return review;
  }

  async uploadImage(id: string, fileStream: Readable, filename: string, adminId: string) {
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Review');

    // Delete old image if exists
    if (existing.imageUrl) {
      const oldPath = path.resolve(process.cwd(), 'storage', existing.imageUrl.replace(/^\/storage\//, ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const newFilename = `${randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, newFilename);

    await pipeline(fileStream, fs.createWriteStream(filePath));

    const imageUrl = `/storage/reviews/${newFilename}`;

    const review = await prisma.review.update({
      where: { id },
      data: { imageUrl },
    });

    await auditService.log({
      adminId,
      action: 'upload_image',
      entity: 'review',
      entityId: id,
      details: { imageUrl },
    });

    this.logger.info({ reviewId: id, imageUrl }, 'Review image uploaded');
    return review;
  }

  async delete(id: string, adminId: string) {
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Review');

    // Delete image file if exists
    if (existing.imageUrl) {
      const imgPath = path.resolve(process.cwd(), 'storage', existing.imageUrl.replace(/^\/storage\//, ''));
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    await prisma.review.delete({ where: { id } });

    await auditService.log({
      adminId,
      action: 'delete',
      entity: 'review',
      entityId: id,
      details: { name: existing.name },
    });
  }

  /** Public: get visible reviews for landing page */
  async getPublicReviews() {
    return prisma.review.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        text: true,
        imageUrl: true,
      },
    });
  }
}

export const adminReviewService = new AdminReviewService();
