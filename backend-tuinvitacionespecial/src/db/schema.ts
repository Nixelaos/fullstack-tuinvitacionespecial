import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
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
  nombre: varchar('nombre', { length: 100 }).notNull(),
  emailGoogle: varchar('email_google', { length: 255 }).notNull().unique(),
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
    nombresPareja: varchar('nombres_pareja', { length: 150 }).notNull(),
    slugPlantilla: varchar('slug_plantilla', { length: 100 }).notNull(),
    fechaEvento: timestamp('fecha_evento', { withTimezone: true }),
    rsvpDeadline: timestamp('rsvp_deadline', { withTimezone: true }).notNull(),
    maxAccesos: integer('max_accesos').notNull().default(2),
    plantillaMensaje: text('plantilla_mensaje'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_novios_admin_id').on(table.adminId),
    check('chk_novios_max_accesos', sql`${table.maxAccesos} >= 1`),
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
    emailGoogle: varchar('email_google', { length: 255 }).notNull(),
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
    tokenEnlace: varchar('token_enlace', { length: 120 }).notNull().unique(),
    familiaNombre: varchar('familia_nombre', { length: 150 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    telefono: varchar('telefono', { length: 30 }),
    numAdultos: integer('num_adultos').notNull(),
    numNinos: integer('num_ninos').notNull().default(0),
    mensajePersonalizado: text('mensaje_personalizado'),
    invitacionEnviadaAt: timestamp('invitacion_enviada_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_familias_invitadas_novios_id').on(table.noviosId),
    check('chk_familias_num_adultos', sql`${table.numAdultos} >= 1`),
    check('chk_familias_num_ninos', sql`${table.numNinos} >= 0`),
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
    cantAsistentes: integer('cant_asistentes').notNull(),
    alergias: text('alergias'),
    cancionFavorita: varchar('cancion_favorita', { length: 200 }),
    mensajeNovios: text('mensaje_novios'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('chk_respuestas_cant_asistentes', sql`${table.cantAsistentes} >= 0`)]
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
