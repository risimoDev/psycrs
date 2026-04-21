import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { progressService } from '../services/progress.service.js';
import { ValidationError } from '../lib/errors.js';

const upsertSchema = z.object({
  lessonId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  lastPosition: z.number().min(0),
});

export class ProgressController {
  async upsert(request: FastifyRequest, reply: FastifyReply) {
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
    }

    const result = await progressService.upsert(
      request.userId,
      parsed.data.lessonId,
      parsed.data.progress,
      parsed.data.lastPosition,
    );

    return reply.send(result);
  }

  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const items = await progressService.getAllForUser(request.userId);
    return reply.send(items);
  }

  async continueWatching(request: FastifyRequest, reply: FastifyReply) {
    const item = await progressService.getContinueWatching(request.userId);
    return reply.send(item);
  }

  async courseCompletion(request: FastifyRequest, reply: FastifyReply) {
    const result = await progressService.getCourseCompletion(request.userId);
    return reply.send(result);
  }
}

export const progressController = new ProgressController();
