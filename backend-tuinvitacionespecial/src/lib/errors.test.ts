import assert from 'node:assert/strict';
import test from 'node:test';
import { validatorCompiler } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, createNotFoundEnvelope, toErrorEnvelope } from './errors.ts';

test('AppError serializa exactamente { code, message } o { code, message, details } para todos los estados HTTP', () => {
  const statuses = [400, 401, 403, 404, 409, 413, 422, 429, 500] as const;

  for (const statusCode of statuses) {
    const withoutDetails = new AppError(statusCode, `ERR_${statusCode}`, `Mensaje ${statusCode}`);
    const responseWithoutDetails = toErrorEnvelope(withoutDetails);

    assert.equal(responseWithoutDetails.statusCode, statusCode);
    assert.deepEqual(responseWithoutDetails.body, {
      code: `ERR_${statusCode}`,
      message: `Mensaje ${statusCode}`,
    });
    assert.equal('details' in responseWithoutDetails.body, false);

    const withDetails = new AppError(statusCode, `ERR_${statusCode}_D`, 'Con detalle', {
      field: 'email',
    });
    const responseWithDetails = toErrorEnvelope(withDetails);
    assert.equal(responseWithDetails.statusCode, statusCode);
    assert.deepEqual(responseWithDetails.body, {
      code: `ERR_${statusCode}_D`,
      message: 'Con detalle',
      details: { field: 'email' },
    });
  }
});

test('toErrorEnvelope convierte ZodError y FST_ERR_VALIDATION en 400 VALIDATION_ERROR con detalles saneados', () => {
  let caughtZod: unknown;
  try {
    z.object({ email: z.email(), age: z.number().int().min(1) }).parse({
      email: 'no-valido',
      age: 0,
    });
  } catch (error) {
    caughtZod = error;
  }

  const zodResponse = toErrorEnvelope(caughtZod);
  assert.equal(zodResponse.statusCode, 400);
  assert.equal(zodResponse.body.code, 'VALIDATION_ERROR');
  assert.equal(typeof zodResponse.body.message, 'string');
  assert.ok(Array.isArray(zodResponse.body.details));
  assert.ok((zodResponse.body.details as Array<unknown>).length >= 2);

  const validate = validatorCompiler({
    schema: z.object({ idToken: z.string().min(10) }),
    method: 'POST',
    url: '/api/auth/google',
    httpPart: 'body',
  });
  const validationResult = validate({ idToken: 'abc' });
  assert.ok(
    typeof validationResult === 'object' &&
      validationResult !== null &&
      'error' in validationResult &&
      Array.isArray(validationResult.error)
  );

  const fastifyValidationError = Object.assign(new Error('Validation error'), {
    code: 'FST_ERR_VALIDATION',
    statusCode: 400,
    validation: [
      {
        instancePath: '/idToken',
        message: 'Too small',
      },
    ],
  });

  const fastifyZodError = Object.assign(new Error('Zod Fastify validation'), {
    code: 'FST_ERR_VALIDATION',
    statusCode: 400,
    validation: validationResult.error,
  });

  for (const candidate of [fastifyValidationError, fastifyZodError]) {
    const response = toErrorEnvelope(candidate);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.deepEqual(response.body.details, [
      {
        path: 'idToken',
        message: (response.body.details as Array<{ message: string }>)[0].message,
      },
    ]);
  }
});

test('toErrorEnvelope mapea errores Fastify 413, JSON inválido (400) y rate limit (429)', () => {
  const payloadTooLarge = Object.assign(new Error('Request body is too large'), {
    code: 'FST_ERR_CTP_BODY_TOO_LARGE',
    statusCode: 413,
  });
  const response413 = toErrorEnvelope(payloadTooLarge);
  assert.equal(response413.statusCode, 413);
  assert.equal(response413.body.code, 'PAYLOAD_TOO_LARGE');
  assert.equal('details' in response413.body, false);

  const invalidJson = Object.assign(new Error("Unexpected token 'x'"), {
    code: 'FST_ERR_CTP_INVALID_JSON_BODY',
    statusCode: 400,
  });
  const response400 = toErrorEnvelope(invalidJson);
  assert.equal(response400.statusCode, 400);
  assert.equal(response400.body.code, 'INVALID_JSON');

  const rateLimited = Object.assign(new Error('Rate limit exceeded'), {
    statusCode: 429,
  });
  const response429 = toErrorEnvelope(rateLimited);
  assert.equal(response429.statusCode, 429);
  assert.equal(response429.body.code, 'RATE_LIMIT_EXCEEDED');
});

test('toErrorEnvelope mapea errores AuthError 401/403/500 sin filtrar secretos de configuración', () => {
  const auth401 = Object.assign(new Error('Token de Google expirado'), {
    name: 'AuthError',
    statusCode: 401,
  });
  assert.deepEqual(toErrorEnvelope(auth401), {
    statusCode: 401,
    body: {
      code: 'INVALID_GOOGLE_TOKEN',
      message: 'Token de Google expirado',
    },
  });

  const auth403Custom = Object.assign(new Error('Cuenta sin permisos'), {
    name: 'AuthError',
    statusCode: 403,
    code: 'CUSTOM_AUTH_DENIED',
  });
  assert.deepEqual(toErrorEnvelope(auth403Custom), {
    statusCode: 403,
    body: {
      code: 'CUSTOM_AUTH_DENIED',
      message: 'Cuenta sin permisos',
    },
  });

  const auth500 = Object.assign(new Error('GOOGLE_CLIENT_ID no configurado en .env'), {
    name: 'AuthError',
    statusCode: 500,
    code: 'GOOGLE_CONFIG_ERROR',
  });
  const response500 = toErrorEnvelope(auth500);
  assert.equal(response500.statusCode, 500);
  assert.equal(response500.body.code, 'GOOGLE_CONFIG_ERROR');
  assert.equal(response500.body.message, 'Error interno del servidor');
  assert.equal(response500.body.message.includes('GOOGLE_CLIENT_ID'), false);
});

test('toErrorEnvelope oculta detalles de errores SQL/internos bajo 500 y createNotFoundEnvelope entrega 404 uniforme', () => {
  const sqlLeak = new Error('SELECT * FROM novios WHERE id = secret-uuid failed: relation missing');
  const fromError = toErrorEnvelope(sqlLeak);
  assert.deepEqual(fromError, {
    statusCode: 500,
    body: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor',
    },
  });
  assert.equal('details' in fromError.body, false);

  const fromPrimitive = toErrorEnvelope('boom-string');
  assert.deepEqual(fromPrimitive, {
    statusCode: 500,
    body: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor',
    },
  });

  assert.deepEqual(toErrorEnvelope(null), fromPrimitive);
  assert.deepEqual(toErrorEnvelope(42), fromPrimitive);

  assert.deepEqual(createNotFoundEnvelope(), {
    code: 'NOT_FOUND',
    message: 'Recurso no encontrado',
  });
});
