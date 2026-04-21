import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { getLogger } from '../lib/logger.js';

interface TariffListQuery {
  page: number;
  limit: number;
}

interface CreateTariffInput {
  title: string;
  description?: string;
  price: number;
  oldPrice?: number;
  period?: string;
  features?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  order?: number;
}

interface UpdateTariffInput {
  title?: string;
  description?: string;
  price?: number;
  oldPrice?: number | null;
  period?: string;
  features?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  order?: number;
}

export class AdminTariffService {
  private readonly logger = getLogger().child({ service: 'admin-tariff' });

  async list(query: TariffListQuery) {
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.tariff.findMany({
        orderBy: { order: 'asc' },
        skip,
        take: query.limit,
      }),
      prisma.tariff.count(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async create(input: CreateTariffInput, adminId: string) {
    const tariff = await prisma.tariff.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        price: input.price,
        oldPrice: input.oldPrice ?? null,
        period: input.period ?? 'month',
        features: input.features ?? [],
        isActive: input.isActive ?? true,
        isPopular: input.isPopular ?? false,
        order: input.order ?? 0,
      },
    });

    await auditService.log({
      adminId,
      action: 'create',
      entity: 'tariff',
      entityId: tariff.id,
      details: { title: input.title, price: input.price },
    });

    this.logger.info({ tariffId: tariff.id }, 'Tariff created');
    return tariff;
  }

  async update(id: string, input: UpdateTariffInput, adminId: string) {
    const existing = await prisma.tariff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Tariff');

    const tariff = await prisma.tariff.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.oldPrice !== undefined && { oldPrice: input.oldPrice }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.features !== undefined && { features: input.features }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.isPopular !== undefined && { isPopular: input.isPopular }),
        ...(input.order !== undefined && { order: input.order }),
      },
    });

    await auditService.log({
      adminId,
      action: 'update',
      entity: 'tariff',
      entityId: tariff.id,
      details: JSON.parse(JSON.stringify(input)),
    });

    this.logger.info({ tariffId: tariff.id }, 'Tariff updated');
    return tariff;
  }

  async delete(id: string, adminId: string) {
    const existing = await prisma.tariff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Tariff');

    await prisma.tariff.delete({ where: { id } });

    await auditService.log({
      adminId,
      action: 'delete',
      entity: 'tariff',
      entityId: id,
      details: { title: existing.title },
    });

    this.logger.info({ tariffId: id }, 'Tariff deleted');
  }

  /** List active tariffs (public, no auth required) */
  async listPublic() {
    return prisma.tariff.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      take: 3,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        oldPrice: true,
        period: true,
        features: true,
        isPopular: true,
      },
    });
  }
}

export const adminTariffService = new AdminTariffService();
