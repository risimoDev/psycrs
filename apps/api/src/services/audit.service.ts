import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import type { Prisma } from '@prisma/client';

export class AuditService {
  private readonly logger = getLogger().child({ service: 'audit' });

  async log(params: {
    adminId: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: Prisma.InputJsonValue;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ?? undefined,
      },
    });

    this.logger.info(params, 'Audit log created');
  }
}

export const auditService = new AuditService();
