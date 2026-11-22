import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379';

const { parseEnv } = await import('./env.ts');

const BASE_ENV = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
};

test('parseEnv aplica defaults seguros para FRONTEND_ORIGIN, COOKIE_SECURE, TRUST_PROXY y DEFAULT_ADMIN_EMAIL', () => {
  const parsed = parseEnv(BASE_ENV);

  assert.equal(parsed.FRONTEND_ORIGIN, 'http://localhost:4321');
  assert.equal(parsed.COOKIE_SECURE, undefined);
  assert.equal(parsed.TRUST_PROXY, false);
  assert.equal(parsed.DEFAULT_ADMIN_EMAIL, undefined);
});

test('parseEnv interpreta booleanos estrictos ("false" no se vuelve true) y cadenas vacías', () => {
  const withStrings = parseEnv({
    ...BASE_ENV,
    COOKIE_SECURE: 'false',
    TRUST_PROXY: 'true',
    DEFAULT_ADMIN_EMAIL: '   ',
    FRONTEND_ORIGIN: '',
  });

  assert.equal(withStrings.COOKIE_SECURE, false);
  assert.equal(withStrings.TRUST_PROXY, true);
  assert.equal(withStrings.DEFAULT_ADMIN_EMAIL, undefined);
  assert.equal(withStrings.FRONTEND_ORIGIN, 'http://localhost:4321');

  const withEmptyBooleans = parseEnv({
    ...BASE_ENV,
    COOKIE_SECURE: '',
    TRUST_PROXY: '  ',
  });

  assert.equal(withEmptyBooleans.COOKIE_SECURE, undefined);
  assert.equal(withEmptyBooleans.TRUST_PROXY, false);

  assert.throws(() => parseEnv({ ...BASE_ENV, COOKIE_SECURE: 'yes' }));
  assert.throws(() => parseEnv({ ...BASE_ENV, TRUST_PROXY: '1' }));
});

test('parseEnv normaliza FRONTEND_ORIGIN (sin slash final) y DEFAULT_ADMIN_EMAIL', () => {
  const parsed = parseEnv({
    ...BASE_ENV,
    FRONTEND_ORIGIN: '  https://tuinvitacionespecial.cl/  ',
    DEFAULT_ADMIN_EMAIL: '  Admin.Boda@Gmail.COM  ',
  });

  assert.equal(parsed.FRONTEND_ORIGIN, 'https://tuinvitacionespecial.cl');
  assert.equal(parsed.DEFAULT_ADMIN_EMAIL, 'admin.boda@gmail.com');

  assert.throws(() => parseEnv({ ...BASE_ENV, FRONTEND_ORIGIN: 'not-a-url' }));
  assert.throws(() => parseEnv({ ...BASE_ENV, FRONTEND_ORIGIN: 'ftp://tuinvitacionespecial.cl' }));
  assert.throws(() => parseEnv({ ...BASE_ENV, DEFAULT_ADMIN_EMAIL: 'correo-invalido' }));
});
