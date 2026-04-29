import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { getLogger } from '../lib/logger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const GIFT_UPLOAD_DIR = path.resolve(process.cwd(), 'storage', 'gifts');

interface ReviewListQuery {
  page: number;
  limit: number;
}

export class AdminReviewService {
  private readonly logger = getLogger().child({ service: 'admin-review' });

  constructor() {
    if (!fs.existsSync(GIFT_UPLOAD_DIR)) {
      fs.mkdirSync(GIFT_UPLOAD_DIR, { recursive: true });
    }
  }

  async list(query: ReviewListQuery) {
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.userReview.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.userReview.count(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async approve(id: string) {
    const review = await prisma.userReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundError('Review');

    const updated = await prisma.userReview.update({
      where: { id },
      data: { status: 'approved' },
    });

    this.logger.info({ reviewId: id }, 'Review approved');
    return updated;
  }

  async reject(id: string) {
    const review = await prisma.userReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundError('Review');

    const updated = await prisma.userReview.update({
      where: { id },
      data: { status: 'rejected' },
    });

    this.logger.info({ reviewId: id }, 'Review rejected');
    return updated;
  }

  async uploadGiftPdf(fileStream: Readable, filename: string) {
    const ext = path.extname(filename).toLowerCase() || '.pdf';
    if (ext !== '.pdf') throw new Error('Only PDF files allowed');
    const newFilename = `${randomUUID()}${ext}`;
    const filePath = path.join(GIFT_UPLOAD_DIR, newFilename);

    await pipeline(fileStream, fs.createWriteStream(filePath));

    const pdfUrl = `/storage/gifts/${newFilename}`;

    await prisma.setting.upsert({
      where: { key: 'gift_pdf_url' },
      update: { value: pdfUrl },
      create: { key: 'gift_pdf_url', value: pdfUrl },
    });

    this.logger.info({ pdfUrl }, 'Gift PDF uploaded');
    return { pdfUrl };
  }

  async getGiftPdfUrl(): Promise<string | null> {
    const setting = await prisma.setting.findUnique({
      where: { key: 'gift_pdf_url' },
    });
    return setting?.value ?? null;
  }

  async claimGift(reviewId: string) {
    const review = await prisma.userReview.findUnique({ where: { id: reviewId } });
    if (!review || review.status !== 'approved') throw new NotFoundError('Review');

    const updated = await prisma.userReview.update({
      where: { id: reviewId },
      data: { giftClaimed: true },
    });

    return updated;
  }
}

export const adminReviewService = new AdminReviewService();
