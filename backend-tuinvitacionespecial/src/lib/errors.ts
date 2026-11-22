import type { FastifyError } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';

export type AppErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500;

export interface ErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  statusCode: number;
  body: ErrorEnvelope;
}

export class AppError extends Error {
  readonly statusCode: AppErrorStatusCode;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: AppErrorStatusCode,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

interface ValidationDetailItem {
  path: string;
  message: string;
}

interface AuthErrorLike extends Error {
  statusCode: 401 | 403 | 500;
  code?: string;
}

interface FastifyValidationItemLike {
  instancePath?: unknown;
  message?: unknown;
  params?: {
    issue?: {
      path?: unknown;
    };
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  if (!(error instanceof Error) || error.name !== 'AuthError') {
    return false;
  }
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 401 || statusCode === 403 || statusCode === 500;
}

function isFastifyErrorLike(error: unknown): error is Partial<FastifyError> {
  return error instanceof Error && ('code' in error || 'statusCode' in error || 'validation' in error);
}

function formatZodIssues(error: ZodError): ValidationDetailItem[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

function formatFastifyValidationItems(items: unknown[]): ValidationDetailItem[] {
  return items.map((rawItem) => {
    if (!isObjectRecord(rawItem)) {
      return { path: '', message: 'Valor inválido' };
    }
    const item = rawItem as FastifyValidationItemLike;
    const issuePath = item.params?.issue?.path;
    let path = '';
    if (Array.isArray(issuePath)) {
      path = issuePath.map((segment) => String(segment)).join('.');
    } else if (typeof item.instancePath === 'string') {
      path = item.instancePath.replace(/^\//, '').replaceAll('/', '.');
    }

    const message = typeof item.message === 'string' && item.message.length > 0
      ? item.message
      : 'Valor inválido';

    return { path, message };
  });
}

export function createNotFoundEnvelope(): ErrorEnvelope {
  return {
    code: 'NOT_FOUND',
    message: 'Recurso no encontrado',
  };
}

export function toErrorEnvelope(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof Error && isResponseSerializationError(error)) {
    return {
      statusCode: 500,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error interno del servidor',
      },
    };
  }

  if (isObjectRecord(error) && hasZodFastifySchemaValidationErrors(error)) {
    return {
      statusCode: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: formatFastifyValidationItems(error.validation),
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: formatZodIssues(error),
      },
    };
  }

  if (isAuthErrorLike(error)) {
    const customCode = typeof error.code === 'string' && error.code.length > 0
      ? error.code
      : undefined;

    if (error.statusCode === 500) {
      return {
        statusCode: 500,
        body: {
          code: customCode ?? 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        },
      };
    }

    return {
      statusCode: error.statusCode,
      body: {
        code: customCode ?? (error.statusCode === 401 ? 'INVALID_GOOGLE_TOKEN' : 'ACCOUNT_NOT_AUTHORIZED'),
        message: error.message,
      },
    };
  }

  if (isFastifyErrorLike(error)) {
    const code = typeof error.code === 'string' ? error.code : undefined;
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : undefined;

    if (code === 'FST_ERR_VALIDATION') {
      const validationItems = Array.isArray(error.validation) ? error.validation : [];
      return {
        statusCode: 400,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: formatFastifyValidationItems(validationItems),
        },
      };
    }

    if (code === 'FST_ERR_CTP_BODY_TOO_LARGE' || statusCode === 413) {
      return {
        statusCode: 413,
        body: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'El cuerpo de la petición excede el tamaño máximo permitido',
        },
      };
    }

    if (
      code === 'FST_ERR_CTP_INVALID_JSON_BODY' ||
      code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
    ) {
      return {
        statusCode: 400,
        body: {
          code: 'INVALID_JSON',
          message: 'El cuerpo JSON de la petición es inválido',
        },
      };
    }

    if (statusCode === 429 || code === 'FST_ERR_RATE_LIMIT') {
      return {
        statusCode: 429,
        body: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Demasiadas peticiones; intenta nuevamente más tarde',
        },
      };
    }
  }

  return {
    statusCode: 500,
    body: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor',
    },
  };
}
