import { env } from './config/env.ts';
import { buildApp } from './app.ts';
import { pool } from './db/index.ts';
import { redis } from './lib/redis.ts';

const app = buildApp();

async function shutdown(signal: string) {
  app.log.info(`Recibida señal ${signal}, cerrando servidor...`);
  await app.close();
  await pool.end();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
