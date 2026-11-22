ALTER TABLE "familias_invitadas" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "novios" ALTER COLUMN "max_accesos" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "familias_invitadas" ADD COLUMN "whatsapp_enviado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "novios" ADD COLUMN "timezone" varchar(64) DEFAULT 'America/Santiago' NOT NULL;