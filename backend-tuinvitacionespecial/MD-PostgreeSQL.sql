CREATE TYPE "tipo_menu_enum" AS ENUM (
	'Estándar',
	'Vegetariano',
	'Vegano',
	'Celíaco',
	'Menú Infantil'
);

CREATE TABLE IF NOT EXISTS "admins" (
	"id" UUID NOT NULL DEFAULT uuidv7(),
	"nombre" VARCHAR(100) NOT NULL,
	"email_google" VARCHAR(255) NOT NULL UNIQUE,
	"activo" BOOLEAN NOT NULL DEFAULT true,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY("id")
);

CREATE TABLE IF NOT EXISTS "novios" (
	"id" UUID NOT NULL DEFAULT uuidv7(),
	"admin_id" UUID NOT NULL,
	"nombres_pareja" VARCHAR(150) NOT NULL,
	"slug_plantilla" VARCHAR(100) NOT NULL,
	"fecha_evento" TIMESTAMPTZ,
	"rsvp_deadline" TIMESTAMPTZ NOT NULL,
	"max_accesos" INTEGER NOT NULL DEFAULT 2,
  -- [NUEVO] Plantilla compartida en la nube para WhatsApp granular y Email masivo
  "plantilla_mensaje" TEXT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY("id"),
	CONSTRAINT "chk_novios_max_accesos" CHECK ("max_accesos" >= 1)
);

CREATE TABLE IF NOT EXISTS "accesos_autorizados" (
	"id" UUID NOT NULL DEFAULT uuidv7(),
	"novios_id" UUID NOT NULL,
	-- [NUEVO] Columna de auditoría (NULLABLE para permitir scripts con MASTER_API_KEY)
	"autorizado_por_admin_id" UUID NULL,
	-- [ACTUALIZADO] Permite que un mismo correo Google administre múltiples bodas sin repetirse en la misma
	"email_google" VARCHAR(255) NOT NULL,
	"activo" BOOLEAN NOT NULL DEFAULT true,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY("id"),
	CONSTRAINT "uq_accesos_novios_email" UNIQUE ("novios_id", "email_google")
);

CREATE TABLE IF NOT EXISTS "familias_invitadas" (
	"id" UUID NOT NULL DEFAULT uuidv7(),
	"novios_id" UUID NOT NULL,
	"token_enlace" VARCHAR(120) NOT NULL UNIQUE,
	"familia_nombre" VARCHAR(150) NOT NULL,
	"email" VARCHAR(255) NOT NULL,
	"telefono" VARCHAR(30),
	"num_adultos" INTEGER NOT NULL,
	"num_ninos" INTEGER NOT NULL DEFAULT 0,
	"mensaje_personalizado" TEXT,
  -- [NUEVO] Trazabilidad de envío para evitar reenvíos accidentales en envíos masivos
	"invitacion_enviada_at" TIMESTAMPTZ NULL,
	PRIMARY KEY("id"),
	CONSTRAINT "chk_familias_num_adultos" CHECK ("num_adultos" >= 1),
	CONSTRAINT "chk_familias_num_ninos" CHECK ("num_ninos" >= 0)
);

CREATE TABLE IF NOT EXISTS "respuestas_rsvp" (
	"id" UUID NOT NULL DEFAULT uuidv7(),
	"familia_id" UUID NOT NULL UNIQUE,
	"asistencia_confirmada" BOOLEAN NOT NULL,
	"cant_asistentes" INTEGER NOT NULL,
	"alergias" TEXT,
	"cancion_favorita" VARCHAR(200),
	"mensaje_novios" TEXT,
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY("id"),
	CONSTRAINT "chk_respuestas_cant_asistentes" CHECK ("cant_asistentes" >= 0)
);

CREATE TABLE IF NOT EXISTS "rsvp_menus" (
	"id" UUID NOT NULL DEFAULT uuidv7(),
	"respuesta_id" UUID NOT NULL,
	"tipo_menu" tipo_menu_enum NOT NULL,
	PRIMARY KEY("id")
);

ALTER TABLE "novios"
ADD FOREIGN KEY("admin_id") REFERENCES "admins"("id")
ON UPDATE NO ACTION ON DELETE RESTRICT;

ALTER TABLE "accesos_autorizados"
ADD FOREIGN KEY("novios_id") REFERENCES "novios"("id")
ON UPDATE NO ACTION ON DELETE CASCADE;

-- [NUEVO] Relación de auditoría con admins (ON DELETE SET NULL protege el acceso de los novios si se borra un admin)
ALTER TABLE "accesos_autorizados"
ADD FOREIGN KEY("autorizado_por_admin_id") REFERENCES "admins"("id")
ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "familias_invitadas"
ADD FOREIGN KEY("novios_id") REFERENCES "novios"("id")
ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "respuestas_rsvp"
ADD FOREIGN KEY("familia_id") REFERENCES "familias_invitadas"("id")
ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "rsvp_menus"
ADD FOREIGN KEY("respuesta_id") REFERENCES "respuestas_rsvp"("id")
ON UPDATE NO ACTION ON DELETE CASCADE;

-- [NUEVO] Índices B-Tree para claves foráneas y búsqueda de cuentas por correo OAuth
CREATE INDEX IF NOT EXISTS "idx_novios_admin_id" ON "novios" ("admin_id");
CREATE INDEX IF NOT EXISTS "idx_accesos_autorizados_novios_id" ON "accesos_autorizados" ("novios_id");
CREATE INDEX IF NOT EXISTS "idx_accesos_autorizados_email_google" ON "accesos_autorizados" ("email_google");
CREATE INDEX IF NOT EXISTS "idx_accesos_autorizados_admin_id" ON "accesos_autorizados" ("autorizado_por_admin_id");
CREATE INDEX IF NOT EXISTS "idx_familias_invitadas_novios_id" ON "familias_invitadas" ("novios_id");
CREATE INDEX IF NOT EXISTS "idx_rsvp_menus_respuesta_id" ON "rsvp_menus" ("respuesta_id");
