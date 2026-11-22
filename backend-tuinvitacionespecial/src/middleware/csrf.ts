import type {} from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.ts';
import { verifyMasterApiKey } from '../lib/auth.ts';
import { AppError } from '../lib/errors.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    skipCsrf?: boolean;
  }
}

const MUTATING_HTTP_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SESSION_COOKIE_NAME = 'sid';

export interface CsrfGuardOptions {
  allowedOrigin?: string;
  verifyApiKey?: (apiKeyHeader: string | string[] | undefined) => boolean;
}

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

function getRequestPathname(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '';
  }
}

function isAdminApiPath(url: string): boolean {
  const pathname = getRequestPathname(url);
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}

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

export async function csrfGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const hook = createCsrfGuard();
  await hook(request, reply);
}
