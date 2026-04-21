import { getEnv } from './config/env.js';
import { getLogger } from './lib/logger.js';
import { buildApp } from './app.js';

async function main() {
  const env = getEnv();
  const logger = getLogger();

  const app = await buildApp();

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(`API server running on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  const logger = getLogger();
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
