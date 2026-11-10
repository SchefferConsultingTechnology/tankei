ALTER TYPE "public"."fuel_type" ADD VALUE 'recarga_ac';--> statement-breakpoint
ALTER TYPE "public"."fuel_type" ADD VALUE 'recarga_dc';--> statement-breakpoint
CREATE TABLE "charger_suggestion_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"current" text NOT NULL,
	"reason" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charger_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"current" text NOT NULL,
	"connector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_charger_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"chargers" jsonb NOT NULL,
	"source" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charger_suggestion_dismissals" ADD CONSTRAINT "charger_suggestion_dismissals_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_suggestion_dismissals" ADD CONSTRAINT "charger_suggestion_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_suggestions" ADD CONSTRAINT "charger_suggestions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charger_suggestions" ADD CONSTRAINT "charger_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_charger_versions" ADD CONSTRAINT "station_charger_versions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_charger_versions" ADD CONSTRAINT "station_charger_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charger_suggestion_dismissals_station_idx" ON "charger_suggestion_dismissals" USING btree ("station_id","current","created_at");--> statement-breakpoint
CREATE INDEX "charger_suggestions_station_idx" ON "charger_suggestions" USING btree ("station_id","current","created_at");--> statement-breakpoint
CREATE INDEX "station_charger_versions_station_idx" ON "station_charger_versions" USING btree ("station_id","created_at");--> statement-breakpoint
-- Parte manual (ADR 0041): só inserção, como o histórico de preços.
CREATE TRIGGER station_charger_versions_append_only
  BEFORE UPDATE OR DELETE ON station_charger_versions
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_charger_versions_no_truncate
  BEFORE TRUNCATE ON station_charger_versions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER charger_suggestions_append_only
  BEFORE UPDATE OR DELETE ON charger_suggestions
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER charger_suggestions_no_truncate
  BEFORE TRUNCATE ON charger_suggestions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER charger_suggestion_dismissals_append_only
  BEFORE UPDATE OR DELETE ON charger_suggestion_dismissals
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER charger_suggestion_dismissals_no_truncate
  BEFORE TRUNCATE ON charger_suggestion_dismissals
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('price.ev_min_kwh', '0.5', 'Valor inicial (ADR 0041): abaixo de R$ 0,50/kWh é erro de digitação.'),
  ('price.ev_max_kwh', '6', 'Valor inicial (ADR 0041): acima de R$ 6,00/kWh é erro de digitação.'),
  ('charger.min_confirmations', '2', 'Valor inicial (ADR 0041): 2 consumidores confirmam a recarga sugerida.');
