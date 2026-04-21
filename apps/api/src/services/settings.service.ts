import { prisma } from '../lib/prisma.js';
import { getLogger } from '../lib/logger.js';
import { auditService } from './audit.service.js';

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'PsyhoCourse',
  site_description: 'Глубокое погружение в психологию',
  subscription_price: '2990',
  currency: 'RUB',
  course_title: 'Курс по психологии',
  course_description: 'Структурированный онлайн-курс с видеоуроками от практикующего психолога',
  support_email: 'support@psyhocourse.ru',
  telegram_link: '',
  meta_title: 'PsyhoCourse — Онлайн-курс по психологии',
  meta_description: 'Структурированный видеокурс по психологии с поддержкой автора',
  sequential_view: 'true',
};

export class SettingsService {
  private readonly logger = getLogger().child({ service: 'settings' });

  async getAll(): Promise<Record<string, string>> {
    const rows = await prisma.setting.findMany();
    const result = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async get(key: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
  }

  async getPublic(): Promise<Record<string, string>> {
    const all = await this.getAll();
    // Return only public-safe settings
    const publicKeys = [
      'site_name', 'site_description', 'subscription_price', 'currency',
      'course_title', 'course_description', 'support_email', 'telegram_link',
      'meta_title', 'meta_description', 'sequential_view',
    ];
    const result: Record<string, string> = {};
    for (const key of publicKeys) {
      if (all[key] !== undefined) result[key] = all[key];
    }
    return result;
  }

  async updateMany(updates: Record<string, string>, adminId: string): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(updates)) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    await auditService.log({
      adminId,
      action: 'update',
      entity: 'settings',
      entityId: undefined,
      details: { keys: Object.keys(updates) },
    });

    this.logger.info({ adminId, keys: Object.keys(updates) }, 'Settings updated');
    return this.getAll();
  }
}

export const settingsService = new SettingsService();
