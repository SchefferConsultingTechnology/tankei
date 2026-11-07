CREATE TABLE "station_info_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"hours" jsonb,
	"services" text[] DEFAULT '{}' NOT NULL,
	"source" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "station_info_versions" ADD CONSTRAINT "station_info_versions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_info_versions" ADD CONSTRAINT "station_info_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_info_versions_station_idx" ON "station_info_versions" USING btree ("station_id","created_at");--> statement-breakpoint
-- Parte manual (ADR 0033): só inserção, como preços e avaliações.
CREATE TRIGGER station_info_versions_append_only
  BEFORE UPDATE OR DELETE ON station_info_versions
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_info_versions_no_truncate
  BEFORE TRUNCATE ON station_info_versions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('app.map_card_close_seconds', '8', 'Valor inicial (ADR 0033): o cartão aberto pelo toque no mapa fecha sozinho em 8 segundos.');
