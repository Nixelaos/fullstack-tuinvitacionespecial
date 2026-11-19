import { createHash, createPublicKey, createVerify, timingSafeEqual, type KeyObject } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.ts';
import { normalizedEmailSchema } from '../schemas/common.ts';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const DEFAULT_JWKS_TTL_MS = 5 * 60 * 1000;
const ALLOWED_GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

export interface GoogleAuthUser {
  sub: string;
  email: string;
  name: string | null;
}

export class AuthError extends Error {
  statusCode: 401 | 403 | 500;

  constructor(message: string, statusCode: 401 | 403 | 500 = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

// Valida el header del JWT de Google (algoritmo RS256 e ID de clave pública).
const jwtHeaderSchema = z.object({
  alg: z.literal('RS256'),
  kid: z.string().min(1),
});

// Valida los claims del payload del ID Token emitido por Google.
const googleClaimsSchema = z.object({
  iss: z.string().min(1),
  aud: z.string().min(1),
  sub: z.string().min(1),
  email: normalizedEmailSchema,
  email_verified: z.literal(true),
  exp: z.number().finite(),
  name: z.string().trim().min(1).optional(),
});

// Valida la respuesta JSON del endpoint JWKS de Google con sus claves públicas RSA.
const jwksResponseSchema = z.object({
  keys: z.array(
    z.object({
      kid: z.string().min(1),
      kty: z.literal('RSA'),
      n: z.string().min(1),
      e: z.string().min(1),
      alg: z.string().optional(),
      use: z.string().optional(),
    })
  ),
});

interface JwksCache {
  keysByKid: Map<string, KeyObject>;
  expiresAt: number;
}

let jwksCache: JwksCache | null = null;

/**
 * Compara la cabecera x-api-key contra MASTER_API_KEY en tiempo constante.
 * Compara digests SHA-256 para evitar fugas de longitud y RangeError en timingSafeEqual.
 */
export const verifyMasterApiKey = (
  apiKeyHeader: string | string[] | undefined
): boolean => {
  const expected = env.MASTER_API_KEY;
  if (!expected || typeof apiKeyHeader !== 'string' || apiKeyHeader.length === 0) {
    return false;
  }

  const providedHash = createHash('sha256').update(apiKeyHeader, 'utf8').digest();
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest();

  return timingSafeEqual(providedHash, expectedHash);
};

/**
 * Extrae el token Bearer del header Authorization (RFC 6750).
 */
export const extractBearerToken = (
  authorizationHeader: string | string[] | undefined
): string | null => {
  if (typeof authorizationHeader !== 'string') return null;

  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
};

const parseCacheControlMaxAgeMs = (cacheControl: string | null): number => {
  if (!cacheControl) return DEFAULT_JWKS_TTL_MS;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return DEFAULT_JWKS_TTL_MS;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : DEFAULT_JWKS_TTL_MS;
};

const decodeBase64UrlJson = (segment: string): unknown => {
  const decoded = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(decoded) as unknown;
};

const fetchGooglePublicKeys = async (forceRefresh = false): Promise<Map<string, KeyObject>> => {
  if (!forceRefresh && jwksCache && Date.now() < jwksCache.expiresAt) {
    return jwksCache.keysByKid;
  }

  const response = await fetch(GOOGLE_JWKS_URL, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new AuthError(
      `No se pudieron obtener las llaves públicas de Google (${response.status})`,
      500
    );
  }

  const rawJson = (await response.json()) as unknown;
  const parsed = jwksResponseSchema.safeParse(rawJson);

  if (!parsed.success) {
    throw new AuthError('Respuesta JWKS de Google con formato inválido', 500);
  }

  const keysByKid = new Map<string, KeyObject>();
  for (const jwk of parsed.data.keys) {
    const publicKey = createPublicKey({
      key: jwk,
      format: 'jwk',
    });
    keysByKid.set(jwk.kid, publicKey);
  }

  const ttlMs = parseCacheControlMaxAgeMs(response.headers.get('cache-control'));
  jwksCache = {
    keysByKid,
    expiresAt: Date.now() + ttlMs,
  };

  return keysByKid;
};

const getGoogleKeyByKid = async (kid: string): Promise<KeyObject | null> => {
  const cachedKeys = await fetchGooglePublicKeys(false);
  const existing = cachedKeys.get(kid);
  if (existing) return existing;

  // Reintenta una vez forzando recarga ante posible rotación de llaves de Google
  const refreshedKeys = await fetchGooglePublicKeys(true);
  return refreshedKeys.get(kid) ?? null;
};

/**
 * Limpia la caché en memoria de llaves públicas de Google (útil para pruebas).
 */
export const clearGoogleJwksCache = (): void => {
  jwksCache = null;
};

/**
 * Verifica criptográficamente un Google ID Token (RS256) con fetch + node:crypto nativos.
 * Valida firma, emisor, audiencia (GOOGLE_CLIENT_ID), expiración y correo verificado.
 */
export const verifyGoogleIdToken = async (
  idToken: string
): Promise<GoogleAuthUser> => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AuthError('GOOGLE_CLIENT_ID no está configurado en el servidor', 500);
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Token de Google mal formado', 401);
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let rawHeader: unknown;
  let rawPayload: unknown;
  try {
    rawHeader = decodeBase64UrlJson(headerSegment);
    rawPayload = decodeBase64UrlJson(payloadSegment);
  } catch {
    throw new AuthError('Token de Google ilegible', 401);
  }

  const headerResult = jwtHeaderSchema.safeParse(rawHeader);
  if (!headerResult.success) {
    throw new AuthError('Cabecera de token de Google no soportada', 401);
  }

  const publicKey = await getGoogleKeyByKid(headerResult.data.kid);
  if (!publicKey) {
    throw new AuthError('Llave de firma de Google no encontrada', 401);
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerSegment}.${payloadSegment}`);
  verifier.end();

  const signatureValid = verifier.verify(
    publicKey,
    Buffer.from(signatureSegment, 'base64url')
  );

  if (!signatureValid) {
    throw new AuthError('Firma del token de Google inválida', 401);
  }

  const claimsResult = googleClaimsSchema.safeParse(rawPayload);
  if (!claimsResult.success) {
    throw new AuthError(
      'Claims del token de Google inválidos o correo no verificado',
      401
    );
  }

  const claims = claimsResult.data;

  if (!ALLOWED_GOOGLE_ISSUERS.has(claims.iss)) {
    throw new AuthError('Emisor del token de Google inválido', 401);
  }

  if (claims.aud !== env.GOOGLE_CLIENT_ID) {
    throw new AuthError('Audiencia del token de Google no coincide', 401);
  }

  if (claims.exp * 1000 <= Date.now()) {
    throw new AuthError('El token de Google ha expirado', 401);
  }

  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name ?? null,
  };
};
