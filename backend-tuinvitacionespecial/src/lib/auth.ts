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
// Un token JWT tiene 3 partes separadas por puntos: HEADER.PAYLOAD.SIGNATURE. Esta constante valida la primera parte (Header) del token de Google:
const jwtHeaderSchema = z.object({
  alg: z.literal('RS256'),
  kid: z.string().min(1), //Key ID
});

// Valida los claims del payload del ID Token emitido por Google.
// Valida la segunda parte (Payload / Claims) del token JWT, donde vienen los datos del usuario que inició sesión con Google:
const googleClaimsSchema = z.object({
  iss: z.string().min(1),                       //(Issuer / Emisor)
  aud: z.string().min(1),                       //Audience
  sub: z.string().min(1),                       //Subject
  email: normalizedEmailSchema,                 //Valida que sea un email valido y además lo tarnsforma.
  email_verified: z.literal(true),              //Confirma con google si el usuario es dueño real
  exp: z.number().finite(),                     //Expiration Time, fecha de vencimiento del token
  name: z.string().trim().min(1).optional(),    //Nombre visible del usuario.
});

// Valida la respuesta JSON del endpoint JWKS de Google con sus claves públicas RSA.
// Para verificar la firma del token, tu servidor descarga las llaves públicas de Google.
const jwksResponseSchema = z.object({
  keys: z.array(
    z.object({
      kid: z.string().min(1),
      kty: z.literal('RSA'),        //Key Type.
      n: z.string().min(1),         //Modulus
      e: z.string().min(1),         //Exponent: Son ambos números codificados en base64
      alg: z.string().optional(),   //Metadatos junto a 'use'
      use: z.string().optional(),
    })
  ),
});

interface JwksCache {
  keysByKid: Map<string, KeyObject>;
  expiresAt: number;
}


//Esta variable puede guardar o bien un objeto JwksCAche o bien 'null'

let jwksCache: JwksCache | null = null;

/**
 * Compara la cabecera x-api-key contra MASTER_API_KEY en tiempo constante.
 * Compara digests SHA-256 para evitar fugas de longitud y RangeError en timingSafeEqual.
 */
export function verifyMasterApiKey(
  apiKeyHeader: string | string[] | undefined
): boolean {
  const expected = env.MASTER_API_KEY;
  if (!expected || typeof apiKeyHeader !== 'string' || apiKeyHeader.length === 0) {
    return false;
  }

  //1° 'createHash': Crea un objeto calculador de hash configurado en SHA-256. 2° update: Mete los datos en la máquina e uft8 (comparado con hacerlo paso a paso si fueran 10gb). 3° digest(), cierra la máquina y saca resultado final y lo entrega
  const providedHash = createHash('sha256').update(apiKeyHeader, 'utf8').digest();
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest();

  return timingSafeEqual(providedHash, expectedHash);
}

/**
 * Extrae el token Bearer del header Authorization (RFC 6750). 
 * Cuando un usuario inicia sesión con Google en tu frontend, el navegador envía el token dentro de una cabecera HTTP estándar llamada Authorization, que por norma (RFC 6750) lleva la palabra "Bearer "
 */
export function extractBearerToken(
  authorizationHeader: string | string[] | undefined
): string | null {
  if (typeof authorizationHeader !== 'string') return null;

  //Extrae la palabra 'bearer' del header token
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}


/**
 * Calcula cuántos milisegundos podemos guardar en memoria caché las llaves públicas de Google antes de tener que volver a descargarlas. Cuando las descargamos de google, dentro de estás google envía un max-age=2600 (ejemplo) y así sabemos cuánto es el máximo.
 */
function parseCacheControlMaxAgeMs(cacheControl: string | null): number {
  if (!cacheControl) return DEFAULT_JWKS_TTL_MS;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return DEFAULT_JWKS_TTL_MS;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : DEFAULT_JWKS_TTL_MS;
}

/**¿Por qué devuelve : unknown (y tiene as unknown)?
Por defecto en TypeScript, JSON.parse() devuelve el tipo any (que desactiva las revisiones de seguridad de TypeScript).
 * 
Esta función en auth.ts traduce una parte de un token JWT desde su formato codificado (Base64URL) hasta un objeto de JavaScript legible.
 */

function decodeBase64UrlJson(segment: string): unknown {
  const decoded = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(decoded) as unknown;
}

/** Promise: Te prometo que cuando termine de descargar te entragaré lo que está dentro de <>.
 * 
 * Es la encargada de obtener las llaves públicas de Google (para poder comprobar si un token de inicio de sesión fue firmado realmente por Google) y guardarlas en memoria caché para que tu servidor sea rápido.
 * 
 * Devuelve el Map: Podría ser key-1 y IDs largos como '7170565d93f7510f0d8fe7...'
 */
async function fetchGooglePublicKeys(forceRefresh = false): Promise<Map<string, KeyObject>> {
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
}

/**
 * Busca una llave pública específica de Google por su ID (kid), manejando de forma inteligente el caso en que Google haya cambiado (rotado) sus llaves.
 */

async function getGoogleKeyByKid(kid: string): Promise<KeyObject | null> {
  const cachedKeys = await fetchGooglePublicKeys(false);
  const existing = cachedKeys.get(kid);
  if (existing) return existing;

  // Reintenta una vez forzando recarga ante posible rotación de llaves de Google
  const refreshedKeys = await fetchGooglePublicKeys(true);
  return refreshedKeys.get(kid) ?? null;
}

/**
 * Limpia la caché en memoria de llaves públicas de Google (útil para pruebas).
 */
export function clearGoogleJwksCache(): void {
  jwksCache = null;
}

/**
 * Es el "director de orquesta": junta todas las funciones y constantes anteriores para verificar un token de Google de punta a punta y devolverte los datos del usuario si todo es legítimo. Sigue un checklist de seguridad de 8 pasos en orden:
 * 
 * Paso 1: Verificar que tu servidor esté configurado (
 * Paso 2: Partir el token en sus 3 pedazos (
 * Paso 3: Decodificar header y payload (
 * Paso 4: Validar la cabecera y buscar la llave pública de Google (
 * Paso 5: Verificar la firma criptográfica (
 * Paso 6: Validar el formato de los datos del usuario con Zod (
 * Paso 7: Validar Emisor (iss), Audiencia (aud) y Expiración (exaud).
 * Paso 8: Devolver el usuario limpio (
 * 
 * 
 * Si superó los 7 filtros anteriores, el token es 100% auténtico y vigente. Devuelve un objeto GoogleAuthUser con el ID de Google (sub), el email normalizado y el name (o null si no venía).
 * 
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleAuthUser> {
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
}
