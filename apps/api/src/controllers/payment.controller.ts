import type { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/payment.service.js';
import { ValidationError } from '../lib/errors.js';

export class PaymentController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const result = await paymentService.startSubscription(request.userId);
    return reply.send(result);
  }

  async webhook(request: FastifyRequest, reply: FastifyReply) {
    const signature =
      (request.headers['x-webhook-signature'] as string) ??
      (request.headers['content-hmac'] as string) ??
      '';

    if (!signature) {
      throw new ValidationError('Missing webhook signature');
    }

    // Body is a raw Buffer thanks to scoped content type parser
    const rawBody = request.body as Buffer;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new ValidationError('Missing request body');
    }

    await paymentService.handleWebhook(rawBody, signature);

    // YooKassa expects 200 OK
    return reply.status(200).send({ status: 'ok' });
  }
}

export const paymentController = new PaymentController();
