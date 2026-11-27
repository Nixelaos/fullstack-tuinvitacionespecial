import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from './config/env.ts';
import { db as defaultDb } from './db/index.ts';
import type { verifyGoogleIdToken as defaultVerifyGoogleIdToken } from './lib/auth.ts';
import { AppError, createNotFoundEnvelope, toErrorEnvelope } from './lib/errors.ts';
import { redis as defaultRedis } from './lib/redis.ts';
import { createCsrfGuard } from './middleware/csrf.ts';

export const BODY_LIMIT_GLOBAL_BYTES = 65_536;
export const BODY_LIMIT_BATCH_BYTES = 524_288;
export const RATE_LIMIT_DEFAULT_MAX = 120;
export const RATE_LIMIT_DEFAULT_WINDOW = '1 minute';
export const LOGGER_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers.authorization',
] as const;

//Interfaz que 
// Fase 1: Contratos mínimos para inyectar dependencias (producción o mocks de test)
export interface HealthDb {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}

export interface HealthRedis {
  ping: () => Promise<string>;
}

export interface AppDependencies {
  db?: HealthDb;
  redis?: HealthRedis;
  rateLimitRedis?: typeof defaultRedis | null;
  rateLimitMax?: number;
  rateLimitTimeWindow?: number | string;
  frontendOrigin?: string;
  trustProxy?: boolean;
  verifyGoogleIdToken?: typeof defaultVerifyGoogleIdToken;
  logger?: FastifyServerOptions['logger'];
}

function resolveLoggerOptions(
  logger?: FastifyServerOptions['logger']
): FastifyServerOptions['logger'] {
  if (logger === false) {
    return false;
  }

  if (logger === undefined || logger === true) {
    return {
      redact: [...LOGGER_REDACT_PATHS],
    };
  }

  if (typeof logger === 'object' && logger !== null) {
    const existingRedact = (logger as { redact?: unknown }).redact;
    if (Array.isArray(existingRedact)) {
      return {
        ...logger,
        redact: Array.from(new Set([...existingRedact, ...LOGGER_REDACT_PATHS])),
      };
    }
    if (
      typeof existingRedact === 'object' &&
      existingRedact !== null &&
      Array.isArray((existingRedact as { paths?: unknown }).paths)
    ) {
      const redactObj = existingRedact as { paths: string[] };
      return {
        ...logger,
        redact: {
          ...existingRedact,
          paths: Array.from(new Set([...redactObj.paths, ...LOGGER_REDACT_PATHS])),
        },
      } as FastifyServerOptions['logger'];
    }
    return {
      ...logger,
      redact: [...LOGGER_REDACT_PATHS],
    };
  }

  return logger;
}

export async function buildApp(deps: AppDependencies = {}) {
  // Fase 2: Seleccionar las dependencias inyectadas o usar las conexiones reales por defecto
  const activeDb = deps.db ?? defaultDb;
  const activeRedis = deps.redis ?? defaultRedis;
  const activeRateLimitRedis =
    deps.rateLimitRedis === undefined ? defaultRedis : deps.rateLimitRedis;
  const frontendOrigin = deps.frontendOrigin ?? env.FRONTEND_ORIGIN;
  const trustProxy = deps.trustProxy ?? env.TRUST_PROXY;

  const app = Fastify({
    logger: resolveLoggerOptions(deps.logger),
    bodyLimit: BODY_LIMIT_GLOBAL_BYTES,
    trustProxy,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cors, {
    origin: function validateCorsOrigin(origin, callback) {
      callback(null, origin === frontendOrigin);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: deps.rateLimitMax ?? RATE_LIMIT_DEFAULT_MAX,
    timeWindow: deps.rateLimitTimeWindow ?? RATE_LIMIT_DEFAULT_WINDOW,
    ...(activeRateLimitRedis ? { redis: activeRateLimitRedis } : {}),
    errorResponseBuilder: function buildRateLimitError() {
      return new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Demasiadas peticiones; intenta nuevamente más tarde'
      );
    },
  });

  app.addHook('onRequest', createCsrfGuard({ allowedOrigin: frontendOrigin }));

  app.setErrorHandler(function handleAppError(error, request, reply) {
    const { statusCode, body } = toErrorEnvelope(error);
    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled application error');
    }
    return reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler(function handleNotFound(_request, reply) {
    return reply.status(404).send(createNotFoundEnvelope());
  });

  app.get(
    '/health',
    {
      config: {
        rateLimit: false,
      },
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

      // Fase 3: Ejecutar las comprobaciones reales contra PostgreSQL y Redis al recibir GET /health
      try {
        await activeDb.execute(sql`SELECT 1`);
        postgresStatus = 'connected';
      } catch (error) {
        app.log.error(error, 'PostgreSQL healthcheck failed');
      }

      try {
        const pong = await activeRedis.ping();
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
