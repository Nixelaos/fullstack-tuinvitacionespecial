import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { z } from 'zod';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MASTER_API_KEY = 'super-secret-master-key-for-tests';
process.env.FRONTEND_ORIGIN = 'https://app.tuinvitacionespecial.cl';

const {
  BODY_LIMIT_BATCH_BYTES,
  BODY_LIMIT_GLOBAL_BYTES,
  buildApp,
} = await import('./app.ts');

const ALLOWED_ORIGIN = 'https://app.tuinvitacionespecial.cl';

function createHealthyDeps(overrides: Record<string, unknown> = {}) {
  return {
    db: {
      execute: async () => [],
    },
    redis: {
      ping: async () => 'PONG',
    },
    rateLimitRedis: null,
    logger: false as const,
    ...overrides,
  };
}

test('exporta constantes de bodyLimit (64 KiB global y 512 KiB batch)', () => {
  assert.equal(BODY_LIMIT_GLOBAL_BYTES, 65_536);
  assert.equal(BODY_LIMIT_BATCH_BYTES, 524_288);
});

test('GET /health responde 200/503 con cabeceras Helmet y sin exponer secretos', async (t) => {
  const healthyApp = await buildApp(createHealthyDeps());
  t.after(() => healthyApp.close());

  const okRes = await healthyApp.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(okRes.statusCode, 200);
  assert.deepEqual(okRes.json(), {
    status: 'ok',
    postgres: 'connected',
    redis: 'connected',
  });
  assert.equal(okRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(okRes.headers['x-frame-options'], 'SAMEORIGIN');
  assert.ok(typeof okRes.headers['content-security-policy'] === 'string');

  const degradedApp = await buildApp(
    createHealthyDeps({
      db: {
        execute: async () => {
          throw new Error('PG down');
        },
      },
      redis: {
        ping: async () => 'NOPE',
      },
    })
  );
  t.after(() => degradedApp.close());

  const degradedRes = await degradedApp.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(degradedRes.statusCode, 503);
  assert.deepEqual(degradedRes.json(), {
    status: 'degraded',
    postgres: 'disconnected',
    redis: 'disconnected',
  });
});

test('CORS restringe el acceso exclusivamente a FRONTEND_ORIGIN con credentials=true', async (t) => {
  const app = await buildApp(createHealthyDeps());
  t.after(() => app.close());

  const allowedGet = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { origin: ALLOWED_ORIGIN },
  });
  assert.equal(allowedGet.statusCode, 200);
  assert.equal(allowedGet.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(allowedGet.headers['access-control-allow-credentials'], 'true');

  const allowedPreflight = await app.inject({
    method: 'OPTIONS',
    url: '/health',
    headers: {
      origin: ALLOWED_ORIGIN,
      'access-control-request-method': 'POST',
    },
  });
  assert.equal(allowedPreflight.statusCode, 204);
  assert.equal(allowedPreflight.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(allowedPreflight.headers['access-control-allow-credentials'], 'true');

  const blockedGet = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { origin: 'https://evil.example' },
  });
  assert.equal(blockedGet.headers['access-control-allow-origin'], undefined);
});

test('guard CSRF global bloquea mutaciones sin Origin autorizado y permite el origen oficial', async (t) => {
  const app = await buildApp(createHealthyDeps());
  t.after(() => app.close());

  app.post('/__test/echo', async (request) => ({ ok: true, body: request.body }));

  const noOriginRes = await app.inject({
    method: 'POST',
    url: '/__test/echo',
    payload: { hello: 'world' },
  });
  assert.equal(noOriginRes.statusCode, 403);
  assert.equal(noOriginRes.json().code, 'CSRF_FORBIDDEN');

  const evilOriginRes = await app.inject({
    method: 'POST',
    url: '/__test/echo',
    headers: { origin: 'https://evil.example' },
    payload: { hello: 'world' },
  });
  assert.equal(evilOriginRes.statusCode, 403);
  assert.equal(evilOriginRes.json().code, 'CSRF_FORBIDDEN');

  const allowedRes = await app.inject({
    method: 'POST',
    url: '/__test/echo',
    headers: { origin: ALLOWED_ORIGIN },
    payload: { hello: 'world' },
  });
  assert.equal(allowedRes.statusCode, 200);
  assert.deepEqual(allowedRes.json(), { ok: true, body: { hello: 'world' } });
});

test('bodyLimit global de 64 KiB rechaza payloads mayores con 413 PAYLOAD_TOO_LARGE', async (t) => {
  const app = await buildApp(createHealthyDeps());
  t.after(() => app.close());

  app.post('/__test/echo', async () => ({ ok: true }));

  const oversized = JSON.stringify({ data: 'x'.repeat(BODY_LIMIT_GLOBAL_BYTES + 1024) });
  const res = await app.inject({
    method: 'POST',
    url: '/__test/echo',
    headers: {
      origin: ALLOWED_ORIGIN,
      'content-type': 'application/json',
    },
    payload: oversized,
  });

  assert.equal(res.statusCode, 413);
  const body = res.json();
  assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(typeof body.message, 'string');
  assert.equal('details' in body, false);
});

test('sobre de error uniforme para 400 Zod, 400 JSON inválido, 500 SQL enmascarado y 404', async (t) => {
  const app = await buildApp(createHealthyDeps());
  t.after(() => app.close());

  app.post(
    '/__test/validated',
    {
      schema: {
        body: z.object({
          email: z.email(),
        }),
      },
    },
    async () => ({ ok: true })
  );

  app.post('/__test/echo', async () => ({ ok: true }));

  app.get('/__test/boom', async () => {
    throw new Error('SELECT * FROM admins WHERE password = secret_password');
  });

  const zodRes = await app.inject({
    method: 'POST',
    url: '/__test/validated',
    headers: { origin: ALLOWED_ORIGIN },
    payload: { email: 'no-es-correo' },
  });
  assert.equal(zodRes.statusCode, 400);
  const zodBody = zodRes.json();
  assert.equal(zodBody.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(zodBody.details));

  const badJsonRes = await app.inject({
    method: 'POST',
    url: '/__test/echo',
    headers: {
      origin: ALLOWED_ORIGIN,
      'content-type': 'application/json',
    },
    payload: '{bad-json',
  });
  assert.equal(badJsonRes.statusCode, 400);
  assert.equal(badJsonRes.json().code, 'INVALID_JSON');

  const boomRes = await app.inject({
    method: 'GET',
    url: '/__test/boom',
  });
  assert.equal(boomRes.statusCode, 500);
  const boomBody = boomRes.json();
  assert.deepEqual(boomBody, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor',
  });
  assert.equal(JSON.stringify(boomBody).includes('SELECT'), false);
  assert.equal(JSON.stringify(boomBody).includes('secret_password'), false);

  const notFoundRes = await app.inject({
    method: 'GET',
    url: '/ruta-inexistente',
  });
  assert.equal(notFoundRes.statusCode, 404);
  assert.deepEqual(notFoundRes.json(), {
    code: 'NOT_FOUND',
    message: 'Recurso no encontrado',
  });
});

test('rate-limit aplica 120 req/min por defecto, exime /health y devuelve 429 RATE_LIMIT_EXCEEDED al superar', async (t) => {
  const defaultApp = await buildApp(createHealthyDeps());
  t.after(() => defaultApp.close());

  defaultApp.get('/__test/ping', async () => ({ pong: true }));

  const pingDefault = await defaultApp.inject({ method: 'GET', url: '/__test/ping' });
  assert.equal(pingDefault.statusCode, 200);
  assert.equal(pingDefault.headers['x-ratelimit-limit'], '120');

  const healthDefault = await defaultApp.inject({ method: 'GET', url: '/health' });
  assert.equal(healthDefault.statusCode, 200);
  assert.equal(healthDefault.headers['x-ratelimit-limit'], undefined);

  const limitedApp = await buildApp(
    createHealthyDeps({
      rateLimitMax: 2,
    })
  );
  t.after(() => limitedApp.close());

  limitedApp.get('/__test/ping', async () => ({ pong: true }));

  const first = await limitedApp.inject({ method: 'GET', url: '/__test/ping' });
  const second = await limitedApp.inject({ method: 'GET', url: '/__test/ping' });
  const third = await limitedApp.inject({ method: 'GET', url: '/__test/ping' });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.headers['x-ratelimit-remaining'], '0');
  assert.ok(third.headers['retry-after'] !== undefined);
  assert.deepEqual(third.json().code, 'RATE_LIMIT_EXCEEDED');

  for (let i = 0; i < 3; i += 1) {
    const healthRes = await limitedApp.inject({ method: 'GET', url: '/health' });
    assert.equal(healthRes.statusCode, 200);
    assert.equal(healthRes.headers['x-ratelimit-limit'], undefined);
  }
});

test('el logger redacta cookie, x-api-key y authorization sin registrar secretos', async (t) => {
  const logChunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      logChunks.push(chunk.toString());
      callback();
    },
  });

  const app = await buildApp(
    createHealthyDeps({
      logger: {
        stream,
        serializers: {
          req(request: { method: string; url: string; headers: Record<string, unknown> }) {
            return {
              method: request.method,
              url: request.url,
              headers: request.headers,
            };
          },
        },
      },
    })
  );
  t.after(() => app.close());

  const res = await app.inject({
    method: 'GET',
    url: '/health',
    headers: {
      cookie: 'sid=secret-cookie-123',
      'x-api-key': 'secret-master-456',
      authorization: 'Bearer secret-jwt-789',
    },
  });
  assert.equal(res.statusCode, 200);

  const logsText = logChunks.join('');
  assert.ok(logsText.includes('[Redacted]'));
  assert.equal(logsText.includes('secret-cookie-123'), false);
  assert.equal(logsText.includes('secret-master-456'), false);
  assert.equal(logsText.includes('secret-jwt-789'), false);
});
