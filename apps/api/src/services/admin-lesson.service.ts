import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { auditService } from './audit.service.js';

interface CreateLessonInput {
  title: string;
  slug: string;
  description?: string;
  videoId?: string;
  order?: number;
  module?: number;
  duration?: number;
  isPublished?: boolean;
}

interface UpdateLessonInput {
  title?: string;
  slug?: string;
  description?: string;
  videoId?: string;
  order?: number;
  module?: number;
  duration?: number;
  isPublished?: boolean;
}

interface LessonListQuery {
  page: number;
  limit: number;
}

export class AdminLessonService {
  private readonly logger = getLogger().child({ service: 'admin-lesson' });

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
        order: input.order ?? 0,
        module: input.module ?? 1,
        duration: input.duration ?? null,
        isPublished: input.isPublished ?? false,
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
        ...(input.order !== undefined && { order: input.order }),
        ...(input.module !== undefined && { module: input.module }),
        ...(input.duration !== undefined && { duration: input.duration }),
        ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
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
}

export const adminLessonService = new AdminLessonService();
