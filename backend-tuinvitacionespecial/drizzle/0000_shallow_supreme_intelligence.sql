CREATE TYPE "public"."tipo_menu_enum" AS ENUM('Estándar', 'Vegetariano', 'Vegano', 'Celíaco', 'Menú Infantil');--> statement-breakpoint
CREATE TABLE "accesos_autorizados" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"novios_id" uuid NOT NULL,
	"autorizado_por_admin_id" uuid,
	"email_google" varchar(255) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_accesos_novios_email" UNIQUE("novios_id","email_google")
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"email_google" varchar(255) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_google_unique" UNIQUE("email_google")
);
--> statement-breakpoint
CREATE TABLE "familias_invitadas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"novios_id" uuid NOT NULL,
	"token_enlace" varchar(120) NOT NULL,
	"familia_nombre" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telefono" varchar(30),
	"num_adultos" integer NOT NULL,
	"num_ninos" integer DEFAULT 0 NOT NULL,
	"mensaje_personalizado" text,
	"invitacion_enviada_at" timestamp with time zone,
	CONSTRAINT "familias_invitadas_token_enlace_unique" UNIQUE("token_enlace"),
	CONSTRAINT "chk_familias_num_adultos" CHECK ("familias_invitadas"."num_adultos" >= 1),
	CONSTRAINT "chk_familias_num_ninos" CHECK ("familias_invitadas"."num_ninos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "novios" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"admin_id" uuid NOT NULL,
	"nombres_pareja" varchar(150) NOT NULL,
	"slug_plantilla" varchar(100) NOT NULL,
	"fecha_evento" timestamp with time zone,
	"rsvp_deadline" timestamp with time zone NOT NULL,
	"max_accesos" integer DEFAULT 2 NOT NULL,
	"plantilla_mensaje" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_novios_max_accesos" CHECK ("novios"."max_accesos" >= 1)
);
--> statement-breakpoint
CREATE TABLE "respuestas_rsvp" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"familia_id" uuid NOT NULL,
	"asistencia_confirmada" boolean NOT NULL,
	"cant_asistentes" integer NOT NULL,
	"alergias" text,
	"cancion_favorita" varchar(200),
	"mensaje_novios" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "respuestas_rsvp_familia_id_unique" UNIQUE("familia_id"),
	CONSTRAINT "chk_respuestas_cant_asistentes" CHECK ("respuestas_rsvp"."cant_asistentes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rsvp_menus" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"respuesta_id" uuid NOT NULL,
	"tipo_menu" "tipo_menu_enum" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accesos_autorizados" ADD CONSTRAINT "accesos_autorizados_novios_id_novios_id_fk" FOREIGN KEY ("novios_id") REFERENCES "public"."novios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accesos_autorizados" ADD CONSTRAINT "accesos_autorizados_autorizado_por_admin_id_admins_id_fk" FOREIGN KEY ("autorizado_por_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "familias_invitadas" ADD CONSTRAINT "familias_invitadas_novios_id_novios_id_fk" FOREIGN KEY ("novios_id") REFERENCES "public"."novios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novios" ADD CONSTRAINT "novios_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ADD CONSTRAINT "respuestas_rsvp_familia_id_familias_invitadas_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias_invitadas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_menus" ADD CONSTRAINT "rsvp_menus_respuesta_id_respuestas_rsvp_id_fk" FOREIGN KEY ("respuesta_id") REFERENCES "public"."respuestas_rsvp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accesos_autorizados_novios_id" ON "accesos_autorizados" USING btree ("novios_id");--> statement-breakpoint
CREATE INDEX "idx_accesos_autorizados_email_google" ON "accesos_autorizados" USING btree ("email_google");--> statement-breakpoint
CREATE INDEX "idx_accesos_autorizados_admin_id" ON "accesos_autorizados" USING btree ("autorizado_por_admin_id");--> statement-breakpoint
CREATE INDEX "idx_familias_invitadas_novios_id" ON "familias_invitadas" USING btree ("novios_id");--> statement-breakpoint
CREATE INDEX "idx_novios_admin_id" ON "novios" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_rsvp_menus_respuesta_id" ON "rsvp_menus" USING btree ("respuesta_id");