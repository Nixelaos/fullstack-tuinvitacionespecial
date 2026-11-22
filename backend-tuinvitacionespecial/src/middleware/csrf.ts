import type { } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.ts';
import { verifyMasterApiKey } from '../lib/auth.ts';
import { AppError } from '../lib/errors.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    skipCsrf?: boolean;
  }
}



//Paso 2: Constantes e interfaces de configuración 

/**
 * Filtra por método HTTP (MUTATING_HTTP_METHODS):
 * Solo revisa peticiones que alteran el estado en la base de datos: POST, PUT, PATCH, DELETE.
 * Las peticiones de solo lectura (GET, HEAD, OPTIONS) pasan de largo automáticamente.
 */
const MUTATING_HTTP_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SESSION_COOKIE_NAME = 'sid';


//Permite pasarle opciones al middleware (por ejemplo, para inyectar mocks o valores distintos en las pruebas unitarias).
export interface CsrfGuardOptions {
  allowedOrigin?: string;
  verifyApiKey?: (apiKeyHeader: string | string[] | undefined) => boolean;
}


//Paso 3: Funciones auxiliares de parseo de URLs

//Intenta parsear un texto como URL. Si el formato es inválido o no usa protocolo web (http: o https:), devuelve null de forma segura sin romper el servidor.
function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}


//Extrae solo la ruta de la petición (por ejemplo, de /api/admin/users?page=1 extrae solo /api/admin/users).
function getRequestPathname(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '';
  }
}

//Devuelve true si la ruta solicitada empieza por /api/admin.
function isAdminApiPath(url: string): boolean {
  const pathname = getRequestPathname(url);
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}


//Paso 4: Detección de la cookie de sesión (hasSessionCookie)

/**
 * Verifica si la petición incluye una cookie de sesión válida.
 * Busca la cookie por nombre ('sid') usando el plugin @fastify/cookie y también revisa el header 'Cookie' crudo por compatibilidad.
 * Esto es fundamental para distinguir peticiones de usuarios reales (que tienen cookie) de peticiones externas automatizadas.
 */

function hasSessionCookie(request: FastifyRequest): boolean {
  const parsedSid = request.cookies?.[SESSION_COOKIE_NAME];
  if (typeof parsedSid === 'string' && parsedSid.length > 0) {
    return true;
  }

  const rawCookieHeader = request.headers.cookie;
  if (typeof rawCookieHeader !== 'string' || rawCookieHeader.length === 0) {
    return false;
  }

  return rawCookieHeader.split(';').some((entry) => {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) return false;
    const name = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    return name === SESSION_COOKIE_NAME && value.length > 0;
  });
}

//Paso 5: Validación del origen (isAllowedMutationOrigin)

/**
 * Es el corazón de la defensa CSRF:
 * 
 * Verifica si el origen de la petición es el esperado.
 * Compara el header 'Origin' (o 'Referer' como respaldo) con el origen configurado.
 * Solo permite el paso si ambos coinciden exactamente (mismo protocolo, host y puerto).
 */

export function isAllowedMutationOrigin(
  origin: string | string[] | undefined,
  referer: string | string[] | undefined,
  allowedOrigin: string
): boolean {
  const parsedAllowed = parseHttpUrl(allowedOrigin);
  if (!parsedAllowed) {
    return false;
  }

  if (origin !== undefined) {
    if (typeof origin !== 'string') {
      return false;
    }
    const trimmedOrigin = origin.trim();
    const parsedOrigin = parseHttpUrl(trimmedOrigin);
    if (!parsedOrigin) {
      return false;
    }
    return trimmedOrigin === parsedOrigin.origin && parsedOrigin.origin === parsedAllowed.origin;
  }

  if (referer !== undefined) {
    if (typeof referer !== 'string') {
      return false;
    }
    const parsedReferer = parseHttpUrl(referer.trim());
    if (!parsedReferer) {
      return false;
    }
    return parsedReferer.origin === parsedAllowed.origin;
  }

  return false;
}

//Paso 6: Fábrica del middleware (createCsrfGuard)

/**
Crea la función hook que intercepta las peticiones:

Verifica el método: Si es GET o HEAD, no hace nada y continúa.
Revisa banderas: Si la ruta tiene skipCsrf: true, continúa.
Maneja peticiones de máquina/bot: Si es un script pegándole a /api/admin/ con una x-api-key válida y sin cookie de navegador, lo deja pasar (los scripts de consola no sufren ataques CSRF).
Verificación final: Si no se cumplió ninguna excepción anterior, exige que la petición venga de tu frontend legítimo. Si viene de una web externa o maliciosa, lanza un AppError 403 CSRF_FORBIDDEN.
 */

export function createCsrfGuard(options: CsrfGuardOptions = {}) {
  const allowedOrigin = options.allowedOrigin ?? env.FRONTEND_ORIGIN;
  const verifyApiKey = options.verifyApiKey ?? verifyMasterApiKey;

  return async function csrfGuardHook(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    if (!MUTATING_HTTP_METHODS.has(request.method.toUpperCase())) {
      return;
    }

    if (request.routeOptions?.config?.skipCsrf === true) {
      return;
    }

    // Excepción acotada: automatización /api/admin/* autenticada por x-api-key sin cookie de sesión
    if (
      isAdminApiPath(request.url) &&
      !hasSessionCookie(request) &&
      verifyApiKey(request.headers['x-api-key'])
    ) {
      return;
    }

    if (!isAllowedMutationOrigin(request.headers.origin, request.headers.referer, allowedOrigin)) {
      throw new AppError(403, 'CSRF_FORBIDDEN', 'Origen de la petición no autorizado');
    }
  };
}


//Paso 7: Exportación por defecto

//Es una instancia directa y lista para usar como hook global en Fastify: fastify.addHook('onRequest', csrfGuard);

export async function csrfGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const hook = createCsrfGuard();
  await hook(request, reply);
}
