CREATE TABLE "station_feature_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"active" boolean NOT NULL,
	"note" text,
	"source" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_visits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"station_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"source" text NOT NULL,
	"driving_mode" boolean DEFAULT false NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"detail_opened_at" timestamp with time zone,
	"detail_ms" integer,
	"actions" text[] DEFAULT '{}' NOT NULL,
	"close_reason" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "visit_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "visit_id" uuid;--> statement-breakpoint
ALTER TABLE "station_feature_changes" ADD CONSTRAINT "station_feature_changes_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_feature_changes" ADD CONSTRAINT "station_feature_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_visits" ADD CONSTRAINT "station_visits_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_feature_changes_station_idx" ON "station_feature_changes" USING btree ("station_id","feature","created_at");--> statement-breakpoint
CREATE INDEX "station_visits_station_opened_idx" ON "station_visits" USING btree ("station_id","opened_at");--> statement-breakpoint
CREATE INDEX "station_visits_opened_idx" ON "station_visits" USING btree ("opened_at");--> statement-breakpoint
-- Parte manual (spec 0003, ADR 0039): só inserção, como o histórico de preços.
CREATE TRIGGER station_visits_append_only
  BEFORE UPDATE OR DELETE ON station_visits
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_visits_no_truncate
  BEFORE TRUNCATE ON station_visits
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_feature_changes_append_only
  BEFORE UPDATE OR DELETE ON station_feature_changes
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_feature_changes_no_truncate
  BEFORE TRUNCATE ON station_feature_changes
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('analytics.flush_seconds', '60', 'Valor inicial (spec 0003): o app envia as visitas a cada minuto.'),
  ('analytics.max_queue_days', '7', 'Valor inicial (spec 0003): visita não enviada vale por 7 dias.'),
  ('analytics.max_detail_seconds', '600', 'Valor inicial (spec 0003): até 10 minutos por visita à ficha.'),
  ('analytics.min_bucket', '5', 'Valor inicial (spec 0003): contagens abaixo de 5 aparecem como "menos de 5".');
