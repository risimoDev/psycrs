import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { promoService } from '../services/promo.service.js';
import { ValidationError } from '../lib/errors.js';

const validatePromoSchema = z.object({
  code: z.string().min(1),
  tariffId: z.string().uuid().optional(),
  price: z.number().int().min(1), // price in kopecks
});

export class PromoController {
  /** Public — validate promo code and return discount info */
  async validate(request: FastifyRequest, reply: FastifyReply) {
    const parsed = validatePromoSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const result = await promoService.validate(parsed.data.code, parsed.data.price);
    return reply.send(result);
  }
}

export const promoController = new PromoController();
