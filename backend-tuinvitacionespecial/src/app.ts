import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db/index.ts';
import { redis } from './lib/redis.ts';

export function buildApp() {
  const app = Fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal('ok'),
            postgres: z.enum(['connected', 'disconnected']),
            redis: z.enum(['connected', 'disconnected']),
          }),
          503: z.object({
            status: z.literal('degraded'),
            postgres: z.enum(['connected', 'disconnected']),
            redis: z.enum(['connected', 'disconnected']),
          }),
        },
      },
    },
    async (_request, reply) => {
      let postgresStatus: 'connected' | 'disconnected' = 'disconnected';
      let redisStatus: 'connected' | 'disconnected' = 'disconnected';

      try {
        await db.execute(sql`SELECT 1`);
        postgresStatus = 'connected';
      } catch (error) {
        app.log.error(error, 'PostgreSQL healthcheck failed');
      }

      try {
        const pong = await redis.ping();
        if (pong === 'PONG') {
          redisStatus = 'connected';
        }
      } catch (error) {
        app.log.error(error, 'Redis healthcheck failed');
      }

      const healthy = postgresStatus === 'connected' && redisStatus === 'connected';
      return reply
        .status(healthy ? 200 : 503)
        .send({
          status: healthy ? 'ok' : 'degraded',
          postgres: postgresStatus,
          redis: redisStatus,
        });
    }
  );

  return app;
}
