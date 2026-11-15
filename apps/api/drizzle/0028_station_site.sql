CREATE TABLE "station_site_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"source" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_site_slugs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "station_site_slugs" ADD CONSTRAINT "station_site_slugs_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_site_slugs" ADD CONSTRAINT "station_site_slugs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_site_slugs_station_idx" ON "station_site_slugs" USING btree ("station_id","created_at");--> statement-breakpoint
-- Parte manual (spec 0004, ADR 0042): só inserção. Um slug usado nunca muda
-- de dono, e o endereço antigo continua redirecionando.
CREATE TRIGGER station_site_slugs_append_only
  BEFORE UPDATE OR DELETE ON station_site_slugs
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_site_slugs_no_truncate
  BEFORE TRUNCATE ON station_site_slugs
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('site.cache_seconds', '120', 'Valor inicial (spec 0004): a página do posto pode ser reutilizada por 2 minutos.');
