import pino from 'pino';
import { getEnv } from '../config/env.js';

let cachedLogger: pino.Logger | undefined;

/** Singleton Pino logger configured from env */
export function getLogger(): pino.Logger {
  if (cachedLogger) return cachedLogger;

  const env = getEnv();

  cachedLogger = pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  });

  return cachedLogger;
}
