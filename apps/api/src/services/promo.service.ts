import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';
import { auditService } from './audit.service.js';
import { getLogger } from '../lib/logger.js';

interface PromoListQuery {
  page: number;
  limit: number;
}

interface CreatePromoInput {
  code: string;
  type: 'fixed' | 'percent' | 'trial';
  value: number;
  maxUses?: number;
  expiresAt?: string;
  isActive?: boolean;
}

interface UpdatePromoInput {
  value?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface PromoValidationResult {
  valid: true;
  promoCodeId: string;
  type: 'fixed' | 'percent' | 'trial';
  value: number;
  discountAmount: number; // in kopecks
  finalAmount: number; // in kopecks
  trialDays?: number;
}

export class PromoService {
  private readonly logger = getLogger().child({ service: 'promo' });

  /** Validate a promo code and calculate discount for a given price (in kopecks) */
  async validate(code: string, priceInKopecks: number): Promise<PromoValidationResult> {
    const promo = await prisma.promoCode.findUnique({ where: { code } });

    if (!promo || !promo.isActive) {
      throw new ValidationError('Промокод не найден или неактивен');
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new ValidationError('Срок действия промокода истёк');
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new ValidationError('Промокод больше недоступен');
    }

    let discountAmount = 0;
    let finalAmount = priceInKopecks;
    let trialDays: number | undefined;

    switch (promo.type) {
      case 'fixed':
        discountAmount = Math.min(promo.value, priceInKopecks);
        finalAmount = priceInKopecks - discountAmount;
        break;

      case 'percent':
        discountAmount = Math.round(priceInKopecks * promo.value / 100);
        discountAmount = Math.min(discountAmount, priceInKopecks);
        finalAmount = priceInKopecks - discountAmount;
        break;

      case 'trial':
        // Trial: charge 1 RUB (100 kopecks), full amount later
        discountAmount = priceInKopecks - 100;
        finalAmount = 100; // 1 RUB
        trialDays = promo.value; // trial duration in days
        break;
    }

    // Minimum 0
    finalAmount = Math.max(0, finalAmount);

    return {
      valid: true,
      promoCodeId: promo.id,
      type: promo.type,
      value: promo.value,
      discountAmount,
      finalAmount,
      trialDays,
    };
  }

  /** Increment usage count after successful payment */
  async incrementUsage(promoCodeId: string): Promise<void> {
    await prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { usedCount: { increment: 1 } },
    });
  }

  // ── Admin CRUD ──────────────────────────────────────

  async list(query: PromoListQuery) {
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.promoCode.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.promoCode.count(),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async create(input: CreatePromoInput, adminId: string) {
    const existing = await prisma.promoCode.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictError('Промокод с таким кодом уже существует');
    }

    if (input.type === 'percent' && (input.value < 1 || input.value > 100)) {
      throw new ValidationError('Процент скидки должен быть от 1 до 100');
    }

    if (input.type === 'fixed' && input.value <= 0) {
      throw new ValidationError('Скидка должна быть больше 0');
    }

    if (input.type === 'trial' && input.value <= 0) {
      throw new ValidationError('Количество дней тестового доступа должно быть больше 0');
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: input.code.toUpperCase(),
        type: input.type,
        value: input.value,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        isActive: input.isActive ?? true,
      },
    });

    await auditService.log({
      adminId,
      action: 'create',
      entity: 'promo_code',
      entityId: promo.id,
      details: { code: promo.code, type: promo.type, value: promo.value },
    });

    this.logger.info({ promoId: promo.id, code: promo.code }, 'Promo code created');
    return promo;
  }

  async update(id: string, input: UpdatePromoInput, adminId: string) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('PromoCode');

    const data: Record<string, unknown> = {};
    if (input.value !== undefined) data.value = input.value;
    if (input.maxUses !== undefined) data.maxUses = input.maxUses;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const promo = await prisma.promoCode.update({ where: { id }, data });

    await auditService.log({
      adminId,
      action: 'update',
      entity: 'promo_code',
      entityId: promo.id,
      details: JSON.parse(JSON.stringify(input)),
    });

    this.logger.info({ promoId: id }, 'Promo code updated');
    return promo;
  }

  async delete(id: string, adminId: string) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('PromoCode');

    await prisma.promoCode.delete({ where: { id } });

    await auditService.log({
      adminId,
      action: 'delete',
      entity: 'promo_code',
      entityId: id,
      details: { code: existing.code },
    });

    this.logger.info({ promoId: id }, 'Promo code deleted');
  }
}

export const promoService = new PromoService();
