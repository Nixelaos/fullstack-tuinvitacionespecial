ALTER TABLE "familias_invitadas" DROP CONSTRAINT "chk_familias_num_adultos";--> statement-breakpoint
ALTER TABLE "familias_invitadas" DROP CONSTRAINT "chk_familias_num_ninos";--> statement-breakpoint
ALTER TABLE "novios" DROP CONSTRAINT "chk_novios_max_accesos";--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" DROP CONSTRAINT "chk_respuestas_cant_asistentes";--> statement-breakpoint
ALTER TABLE "accesos_autorizados" ALTER COLUMN "email_google" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "nombre" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "email_google" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "token_enlace" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "familia_nombre" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "email" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "telefono" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "num_adultos" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "num_ninos" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "familias_invitadas" ALTER COLUMN "mensaje_personalizado" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "novios" ALTER COLUMN "nombres_pareja" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "novios" ALTER COLUMN "slug_plantilla" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "novios" ALTER COLUMN "max_accesos" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "novios" ALTER COLUMN "max_accesos" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "novios" ALTER COLUMN "plantilla_mensaje" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ALTER COLUMN "cant_asistentes" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ALTER COLUMN "alergias" SET DATA TYPE varchar(300);--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ALTER COLUMN "cancion_favorita" SET DATA TYPE varchar(120);--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ALTER COLUMN "mensaje_novios" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "novios" ADD COLUMN "max_familias" smallint DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "familias_invitadas" ADD CONSTRAINT "chk_familias_total_pases" CHECK ("familias_invitadas"."num_adultos" + "familias_invitadas"."num_ninos" <= 30);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ADD CONSTRAINT "chk_familias_num_adultos" CHECK ("familias_invitadas"."num_adultos" >= 1 AND "familias_invitadas"."num_adultos" <= 20);--> statement-breakpoint
ALTER TABLE "familias_invitadas" ADD CONSTRAINT "chk_familias_num_ninos" CHECK ("familias_invitadas"."num_ninos" >= 0 AND "familias_invitadas"."num_ninos" <= 15);--> statement-breakpoint
ALTER TABLE "novios" ADD CONSTRAINT "chk_novios_max_familias" CHECK ("novios"."max_familias" >= 1 AND "novios"."max_familias" <= 1000);--> statement-breakpoint
ALTER TABLE "novios" ADD CONSTRAINT "chk_novios_max_accesos" CHECK ("novios"."max_accesos" >= 1 AND "novios"."max_accesos" <= 10);--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ADD CONSTRAINT "chk_respuestas_asistencia_consistente" CHECK (("respuestas_rsvp"."asistencia_confirmada" = false AND "respuestas_rsvp"."cant_asistentes" = 0) OR ("respuestas_rsvp"."asistencia_confirmada" = true AND "respuestas_rsvp"."cant_asistentes" >= 1));--> statement-breakpoint
ALTER TABLE "respuestas_rsvp" ADD CONSTRAINT "chk_respuestas_cant_asistentes" CHECK ("respuestas_rsvp"."cant_asistentes" >= 0 AND "respuestas_rsvp"."cant_asistentes" <= 30);