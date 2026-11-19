import { z } from 'zod';

/**
 * Normaliza correos electrónicos con .trim().toLowerCase() antes de validar formato,
 * garantizando consistencia en búsquedas y restricciones UNIQUE (SDD Capa 2).
 */
export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Formato de correo electrónico inválido').max(255));

export const uuidSchema = z.uuid('Identificador UUID inválido');

export const tipoMenuSchema = z.enum([
  'Estándar',
  'Vegetariano',
  'Vegano',
  'Celíaco',
  'Menú Infantil',
]);
