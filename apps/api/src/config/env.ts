import { z } from 'zod';

const envSchema = z.object({
  // ─── Server ───────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ─── CORS ─────────────────────────────────────────
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ─── JWT ──────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // ─── Video ────────────────────────────────────────
  VIDEO_PROVIDER: z.enum(['local', 'kinescope']).default('local'),
  VIDEO_STORAGE_PATH: z.string().default('./storage/videos'),
  VIDEO_SIGNING_SECRET: z.string().min(32, 'VIDEO_SIGNING_SECRET must be at least 32 characters'),
  VIDEO_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),

  // ─── DRM ──────────────────────────────────────────
  DRM_ENABLED: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  DRM_MODE: z.enum(['clearkey', 'widevine']).default('clearkey'),
  DRM_LICENSE_SERVER_URL: z.string().url().optional(),

  // ─── YooKassa ─────────────────────────────────────
  YOOKASSA_SHOP_ID: z.string().default(''),
  YOOKASSA_SECRET_KEY: z.string().default(''),
  YOOKASSA_WEBHOOK_SECRET: z.string().default(''),
  SUBSCRIPTION_PRICE: z.coerce.number().positive().default(2990),
  PAYMENT_RETURN_URL: z.string().default('http://localhost:3000/payment/result'),

  // ─── SMTP (optional) ──────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: z
    .string()
    .transform((v) => v !== 'false' && v !== '0')
    .default('true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@psyhocourse.ru'),

  // ─── Public URL (used for m3u8 URL rewriting) ─────
  // Same value as NEXT_PUBLIC_API_URL in the web app.
  // Example: https://example.com/api
  PUBLIC_API_URL: z.string().default(''),

  // ─── FFmpeg / Shaka ───────────────────────────────
  SHAKA_PACKAGER_PATH: z.string().default('packager'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parse and validate environment variables. Throws on first invalid run. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
