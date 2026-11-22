/**
 * El archivo schema.ts define toda la base de datos PostgreSQL en Drizzle ORM para una plataforma de invitaciones de boda. Usa uuidv7() en todas las llaves primarias (UUIDs ordenables por tiempo) y aplica restricciones (check, unique, index) directamente en la base de datos
 * 
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const tipoMenuEnum = pgEnum('tipo_menu_enum', [
  'Estándar',
  'Vegetariano',
  'Vegano',
  'Celíaco',
  'Menú Infantil',
]);

export const admins = pgTable('admins', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  emailGoogle: varchar('email_google', { length: 160 }).notNull().unique(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const novios = pgTable(
  'novios',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'restrict', onUpdate: 'no action' }),
    nombresPareja: varchar('nombres_pareja', { length: 100 }).notNull(),
    slugPlantilla: varchar('slug_plantilla', { length: 50 }).notNull(),
    fechaEvento: timestamp('fecha_evento', { withTimezone: true }),
    rsvpDeadline: timestamp('rsvp_deadline', { withTimezone: true }).notNull(),
    maxAccesos: smallint('max_accesos').notNull().default(3),
    maxFamilias: smallint('max_familias').notNull().default(1000),
    plantillaMensaje: varchar('plantilla_mensaje', { length: 1000 }),
    timezone: varchar('timezone', { length: 64 }).notNull().default('America/Santiago'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_novios_admin_id').on(table.adminId),
    check('chk_novios_max_accesos', sql`${table.maxAccesos} >= 1 AND ${table.maxAccesos} <= 10`),
    check('chk_novios_max_familias', sql`${table.maxFamilias} >= 1 AND ${table.maxFamilias} <= 1000`),
  ]
);

export const accesosAutorizados = pgTable(
  'accesos_autorizados',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    noviosId: uuid('novios_id')
      .notNull()
      .references(() => novios.id, { onDelete: 'cascade', onUpdate: 'no action' }),
    autorizadoPorAdminId: uuid('autorizado_por_admin_id').references(() => admins.id, {
      onDelete: 'set null',
      onUpdate: 'no action',
    }),
    emailGoogle: varchar('email_google', { length: 160 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_accesos_novios_email').on(table.noviosId, table.emailGoogle),
    index('idx_accesos_autorizados_novios_id').on(table.noviosId),
    index('idx_accesos_autorizados_email_google').on(table.emailGoogle),
    index('idx_accesos_autorizados_admin_id').on(table.autorizadoPorAdminId),
  ]
);

export const familiasInvitadas = pgTable(
  'familias_invitadas',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    noviosId: uuid('novios_id')
      .notNull()
      .references(() => novios.id, { onDelete: 'cascade', onUpdate: 'no action' }),
    tokenEnlace: varchar('token_enlace', { length: 80 }).notNull().unique(),
    familiaNombre: varchar('familia_nombre', { length: 100 }).notNull(),
    email: varchar('email', { length: 160 }),
    telefono: varchar('telefono', { length: 20 }),
    numAdultos: smallint('num_adultos').notNull(),
    numNinos: smallint('num_ninos').notNull().default(0),
    mensajePersonalizado: varchar('mensaje_personalizado', { length: 300 }),
    invitacionEnviadaAt: timestamp('invitacion_enviada_at', { withTimezone: true }),
    whatsappEnviadoAt: timestamp('whatsapp_enviado_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_familias_invitadas_novios_id').on(table.noviosId),
    check('chk_familias_num_adultos', sql`${table.numAdultos} >= 1 AND ${table.numAdultos} <= 20`),
    check('chk_familias_num_ninos', sql`${table.numNinos} >= 0 AND ${table.numNinos} <= 15`),
    check('chk_familias_total_pases', sql`${table.numAdultos} + ${table.numNinos} <= 30`),
  ]
);

export const respuestasRsvp = pgTable(
  'respuestas_rsvp',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    familiaId: uuid('familia_id')
      .notNull()
      .unique()
      .references(() => familiasInvitadas.id, { onDelete: 'cascade', onUpdate: 'no action' }),
    asistenciaConfirmada: boolean('asistencia_confirmada').notNull(),
    cantAsistentes: smallint('cant_asistentes').notNull(),
    alergias: varchar('alergias', { length: 300 }),
    cancionFavorita: varchar('cancion_favorita', { length: 120 }),
    mensajeNovios: varchar('mensaje_novios', { length: 500 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'chk_respuestas_cant_asistentes',
      sql`${table.cantAsistentes} >= 0 AND ${table.cantAsistentes} <= 30`
    ),
    check(
      'chk_respuestas_asistencia_consistente',
      sql`(${table.asistenciaConfirmada} = false AND ${table.cantAsistentes} = 0) OR (${table.asistenciaConfirmada} = true AND ${table.cantAsistentes} >= 1)`
    ),
  ]
);

export const rsvpMenus = pgTable(
  'rsvp_menus',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    respuestaId: uuid('respuesta_id')
      .notNull()
      .references(() => respuestasRsvp.id, { onDelete: 'cascade', onUpdate: 'no action' }),
    tipoMenu: tipoMenuEnum('tipo_menu').notNull(),
  },
  (table) => [index('idx_rsvp_menus_respuesta_id').on(table.respuestaId)]
);
