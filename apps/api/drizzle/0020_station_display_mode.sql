CREATE TYPE "public"."hide_reason" AS ENUM('fechado', 'ordem_judicial', 'dado_incorreto', 'seguranca');--> statement-breakpoint
CREATE TYPE "public"."station_mode" AS ENUM('normal', 'nao_participa', 'preco_oficial', 'precos_ocultos', 'oculto');--> statement-breakpoint
CREATE TABLE "station_mode_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"mode" "station_mode" NOT NULL,
	"hide_reason" "hide_reason",
	"requested_by" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "display_mode" "station_mode" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "station_mode_changes" ADD CONSTRAINT "station_mode_changes_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_mode_changes" ADD CONSTRAINT "station_mode_changes_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_mode_changes_station_idx" ON "station_mode_changes" USING btree ("station_id","created_at");--> statement-breakpoint
-- Parte manual (ADR 0028): registro das decisões, só inserção.
CREATE TRIGGER station_mode_changes_append_only
  BEFORE UPDATE OR DELETE ON station_mode_changes
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_mode_changes_no_truncate
  BEFORE TRUNCATE ON station_mode_changes
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
