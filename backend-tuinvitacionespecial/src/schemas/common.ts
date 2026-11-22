import { z } from 'zod';

/**
 * Límites canónicos de atributos y rangos compartidos entre PostgreSQL (schema.ts)
 * y la validación HTTP con Zod (principio de defensa ante abusos y amplificación).
 */
export const DB_LIMITS = {
  ADMIN_NOMBRE_MAX: 80,
  EMAIL_MAX: 160,
  NOVIOS_NOMBRES_PAREJA_MAX: 100,
  NOVIOS_SLUG_PLANTILLA_MAX: 50,
  NOVIOS_MAX_ACCESOS_MIN: 1,
  NOVIOS_MAX_ACCESOS_DEFAULT: 3,
  NOVIOS_MAX_ACCESOS_MAX: 10,
  NOVIOS_MAX_FAMILIAS_MIN: 1,
  NOVIOS_MAX_FAMILIAS_MAX: 1000,
  NOVIOS_PLANTILLA_MENSAJE_MAX: 1000,
  NOVIOS_TIMEZONE_MAX: 64,
  FAMILIA_TOKEN_ENLACE_MAX: 80,
  FAMILIA_NOMBRE_MAX: 100,
  FAMILIA_TELEFONO_MAX: 20,
  FAMILIA_NUM_ADULTOS_MIN: 1,
  FAMILIA_NUM_ADULTOS_MAX: 20,
  FAMILIA_NUM_NINOS_MIN: 0,
  FAMILIA_NUM_NINOS_MAX: 15,
  FAMILIA_TOTAL_PASES_MAX: 30,
  FAMILIA_MENSAJE_PERSONALIZADO_MAX: 300,
  RSVP_CANT_ASISTENTES_MIN: 0,
  RSVP_CANT_ASISTENTES_MAX: 30,
  RSVP_ALERGIAS_MAX: 300,
  RSVP_CANCION_FAVORITA_MAX: 120,
  RSVP_MENSAJE_NOVIOS_MAX: 500,
} as const;

/**
 * Normaliza correos electrónicos con .trim().toLowerCase() antes de validar formato,
 * garantizando consistencia en búsquedas y restricciones UNIQUE (SDD Capa 2).
 */
export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Formato de correo electrónico inválido').max(DB_LIMITS.EMAIL_MAX));

export const uuidSchema = z.uuid('Identificador UUID inválido');

export const tipoMenuSchema = z.enum([
  'Estándar',
  'Vegetariano',
  'Vegano',
  'Celíaco',
  'Menú Infantil',
]);

function isValidIanaTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .min(1, 'La zona horaria IANA es obligatoria')
  .max(
    DB_LIMITS.NOVIOS_TIMEZONE_MAX,
    `La zona horaria no puede superar ${DB_LIMITS.NOVIOS_TIMEZONE_MAX} caracteres`
  )
  .refine(isValidIanaTimezone, 'Zona horaria IANA inválida');
