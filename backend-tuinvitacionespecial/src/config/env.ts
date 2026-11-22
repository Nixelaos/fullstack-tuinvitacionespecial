import { z } from 'zod';
import { normalizedEmailSchema } from '../schemas/common.ts';

/*  preprocessOptionalString
*Convierte textos vacíos o con solo espacios ("", "   ") en undefined. Sirve para que si en tu .env dejas una variable opcional en blanco (como DEFAULT_ADMIN_EMAIL=), Zod la tome como "no configurada" en vez de fallar intentando validar un correo vacío.
*
*/
function preprocessOptionalString(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

/* parseStrictBooleanEnv
*  Traduce los textos 'true' y 'false' del .env a booleanos reales (true/false), acepta vacío como undefined y deja que Zod rechace cualquier otro valor ('yes', '1'). Evita un bug clásico de z.coerce.boolean() en JavaScript, donde el string 'false' se convierte en true por no ser vacío.
*/

function parseStrictBooleanEnv(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return undefined;
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}

// isValidHttpOrigin
//Verifica con new URL(value) que el origen configurado tenga formato URL válido y protocolo http: o https:.

function isValidHttpOrigin(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}


/*
*Esta constante envSchema define un esquema de validación y transformación con Zod para las variables de entorno (process.env) de tu backend.

Su función principal es asegurar que la aplicación arranque con todas las configuraciones necesarias, con los tipos de datos correctos (number, boolean, string) y con valores por defecto seguros. Si alguna variable obligatoria falta o no tiene el formato esperado, el arranque fallará inmediatamente con un error claro.
*/
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  REDIS_URL: z.string().min(1, 'REDIS_URL es requerida'),
  MASTER_API_KEY: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default('invitaciones@localhost'),
  FRONTEND_ORIGIN: z
    .preprocess(preprocessOptionalString, z.string().trim().default('http://localhost:4321'))
    .refine(isValidHttpOrigin, 'FRONTEND_ORIGIN debe ser un origen http:// o https:// válido')
    .transform((value) => new URL(value).origin),
  COOKIE_SECURE: z.preprocess(parseStrictBooleanEnv, z.boolean().optional()),
  TRUST_PROXY: z.preprocess(parseStrictBooleanEnv, z.boolean().default(false)),
  DEFAULT_ADMIN_EMAIL: z.preprocess(preprocessOptionalString, normalizedEmailSchema.optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Error en variables de entorno:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
