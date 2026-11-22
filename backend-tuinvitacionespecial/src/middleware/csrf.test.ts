import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyReply, FastifyRequest } from 'fastify';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MASTER_API_KEY = 'super-secret-master-key-for-tests';
process.env.FRONTEND_ORIGIN = 'https://app.tuinvitacionespecial.cl';

const { AppError } = await import('../lib/errors.ts');
const { createCsrfGuard, csrfGuard, isAllowedMutationOrigin } = await import('./csrf.ts');

const ALLOWED_ORIGIN = 'https://app.tuinvitacionespecial.cl';

interface MockRequestInput {
  method: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  skipCsrf?: boolean;
}

function createMockRequest(input: MockRequestInput): FastifyRequest {
  return {
    method: input.method,
    url: input.url ?? '/api/auth/logout',
    headers: input.headers ?? {},
    cookies: input.cookies,
    routeOptions: {
      config: input.skipCsrf !== undefined ? { skipCsrf: input.skipCsrf } : {},
    },
  } as unknown as FastifyRequest;
}

const dummyReply = {} as FastifyReply;

test('isAllowedMutationOrigin valida Origin estricto con prioridad sobre Referer y rechaza nulos o inválidos', () => {
  assert.equal(isAllowedMutationOrigin(ALLOWED_ORIGIN, undefined, ALLOWED_ORIGIN), true);

  // Origin distinto debe fallar incluso si Referer coincide
  assert.equal(
    isAllowedMutationOrigin(
      'https://evil.example',
      `${ALLOWED_ORIGIN}/panel`,
      ALLOWED_ORIGIN
    ),
    false
  );

  // Origin: 'null', mal formado o con ruta extra debe fallar aunque Referer coincida
  assert.equal(isAllowedMutationOrigin('null', `${ALLOWED_ORIGIN}/panel`, ALLOWED_ORIGIN), false);
  assert.equal(
    isAllowedMutationOrigin('not-a-url', `${ALLOWED_ORIGIN}/panel`, ALLOWED_ORIGIN),
    false
  );
  assert.equal(
    isAllowedMutationOrigin(`${ALLOWED_ORIGIN}/evil`, `${ALLOWED_ORIGIN}/panel`, ALLOWED_ORIGIN),
    false
  );

  // Sin Origin, Referer válido del mismo origen pasa; otro origen o inválido falla
  assert.equal(
    isAllowedMutationOrigin(undefined, `${ALLOWED_ORIGIN}/panel?tab=1`, ALLOWED_ORIGIN),
    true
  );
  assert.equal(
    isAllowedMutationOrigin(undefined, 'https://evil.example/panel', ALLOWED_ORIGIN),
    false
  );
  assert.equal(isAllowedMutationOrigin(undefined, 'not-a-url', ALLOWED_ORIGIN), false);

  // Sin Origin ni Referer falla (fail-closed)
  assert.equal(isAllowedMutationOrigin(undefined, undefined, ALLOWED_ORIGIN), false);

  // Arreglo de headers o allowedOrigin inválido fallan (fail-closed)
  assert.equal(
    isAllowedMutationOrigin([ALLOWED_ORIGIN], undefined, ALLOWED_ORIGIN),
    false
  );
  assert.equal(isAllowedMutationOrigin(ALLOWED_ORIGIN, undefined, 'invalid-origin'), false);
});

test('csrfGuard permite métodos seguros (GET, HEAD, OPTIONS) sin Origin ni Referer', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    await csrfGuard(createMockRequest({ method }), dummyReply);
  }
});

test('csrfGuard exige Origin/Referer coincidente en métodos mutadores (POST, PATCH, PUT, DELETE)', async () => {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    await csrfGuard(
      createMockRequest({
        method,
        headers: { origin: ALLOWED_ORIGIN },
      }),
      dummyReply
    );

    await csrfGuard(
      createMockRequest({
        method,
        headers: { referer: `${ALLOWED_ORIGIN}/panel` },
      }),
      dummyReply
    );

    await assert.rejects(
      () => csrfGuard(createMockRequest({ method }), dummyReply),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 403 && error.code === 'CSRF_FORBIDDEN'
    );

    await assert.rejects(
      () =>
        csrfGuard(
          createMockRequest({
            method,
            headers: { origin: 'https://atacante.cl' },
          }),
          dummyReply
        ),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 403 && error.code === 'CSRF_FORBIDDEN'
    );
  }
});

test('csrfGuard respeta skipCsrf=true en la configuración de la ruta', async () => {
  await csrfGuard(
    createMockRequest({
      method: 'POST',
      url: '/api/public/invitations/token/rsvp',
      skipCsrf: true,
    }),
    dummyReply
  );
});

test('csrfGuard exime /api/admin/* solo sin cookie sid y con x-api-key válida (sin bypass por traversal ni rutas falsas)', async () => {
  const guard = createCsrfGuard();

  // Caso permitido: /api/admin/* sin cookie sid + x-api-key válida
  await guard(
    createMockRequest({
      method: 'POST',
      url: '/api/admin/weddings',
      headers: {
        'x-api-key': 'super-secret-master-key-for-tests',
      },
    }),
    dummyReply
  );

  // Con cookie sid parseada + x-api-key sin Origin -> debe exigir Origin (403 CSRF_FORBIDDEN)
  await assert.rejects(
    () =>
      guard(
        createMockRequest({
          method: 'POST',
          url: '/api/admin/weddings',
          cookies: { sid: 'session-token-123' },
          headers: {
            'x-api-key': 'super-secret-master-key-for-tests',
          },
        }),
        dummyReply
      ),
    (error: unknown) =>
      error instanceof AppError && error.statusCode === 403 && error.code === 'CSRF_FORBIDDEN'
  );

  // Con cookie sid solo en cabecera cruda (sin parseo previo) + x-api-key sin Origin -> 403
  await assert.rejects(
    () =>
      guard(
        createMockRequest({
          method: 'PATCH',
          url: '/api/admin/weddings/123',
          headers: {
            cookie: 'other=1; sid=raw-session-token',
            'x-api-key': 'super-secret-master-key-for-tests',
          },
        }),
        dummyReply
      ),
    (error: unknown) =>
      error instanceof AppError && error.statusCode === 403 && error.code === 'CSRF_FORBIDDEN'
  );

  // Sin cookie sid pero con x-api-key inválida -> 403 CSRF_FORBIDDEN
  await assert.rejects(
    () =>
      guard(
        createMockRequest({
          method: 'POST',
          url: '/api/admin/weddings',
          headers: {
            'x-api-key': 'wrong-key',
          },
        }),
        dummyReply
      ),
    (error: unknown) =>
      error instanceof AppError && error.statusCode === 403 && error.code === 'CSRF_FORBIDDEN'
  );

  // Rutas no-admin o path traversal aunque lleven x-api-key válida -> 403 CSRF_FORBIDDEN
  for (const url of [
    '/api/auth/logout',
    '/api/admin-fake/weddings',
    '/api/admin/../auth/logout',
  ]) {
    await assert.rejects(
      () =>
        guard(
          createMockRequest({
            method: 'POST',
            url,
            headers: {
              'x-api-key': 'super-secret-master-key-for-tests',
            },
          }),
          dummyReply
        ),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 403 && error.code === 'CSRF_FORBIDDEN'
    );
  }
});
