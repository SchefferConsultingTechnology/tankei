CREATE TYPE "public"."moderation_decision" AS ENUM('mantido', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."moderation_kind" AS ENUM('contestacao', 'rajada');--> statement-breakpoint
CREATE TABLE "price_moderation_case_reports" (
	"case_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	CONSTRAINT "price_moderation_case_reports_case_id_report_id_pk" PRIMARY KEY("case_id","report_id")
);
--> statement-breakpoint
CREATE TABLE "price_moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "moderation_kind" NOT NULL,
	"station_id" uuid NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"opened_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"decision" "moderation_decision" NOT NULL,
	"reason" text NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_moderation_decisions_case_unique" UNIQUE("case_id")
);
--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "at_station" boolean;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "reporter_trusted" boolean;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "confirmation_weight" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "price_moderation_case_reports" ADD CONSTRAINT "price_moderation_case_reports_case_id_price_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."price_moderation_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_moderation_case_reports" ADD CONSTRAINT "price_moderation_case_reports_report_id_price_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."price_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_moderation_cases" ADD CONSTRAINT "price_moderation_cases_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_moderation_cases" ADD CONSTRAINT "price_moderation_cases_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_moderation_decisions" ADD CONSTRAINT "price_moderation_decisions_case_id_price_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."price_moderation_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_moderation_decisions" ADD CONSTRAINT "price_moderation_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_moderation_case_reports_report_idx" ON "price_moderation_case_reports" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "price_moderation_cases_station_idx" ON "price_moderation_cases" USING btree ("station_id");--> statement-breakpoint
-- Parte manual (ADR 0024): casos, informes dos casos e decisões são registro
-- de auditoria. Só inserção.
CREATE TRIGGER price_moderation_cases_append_only
  BEFORE UPDATE OR DELETE ON price_moderation_cases
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER price_moderation_cases_no_truncate
  BEFORE TRUNCATE ON price_moderation_cases
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER price_moderation_case_reports_append_only
  BEFORE UPDATE OR DELETE ON price_moderation_case_reports
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER price_moderation_case_reports_no_truncate
  BEFORE TRUNCATE ON price_moderation_case_reports
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER price_moderation_decisions_append_only
  BEFORE UPDATE OR DELETE ON price_moderation_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER price_moderation_decisions_no_truncate
  BEFORE TRUNCATE ON price_moderation_decisions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('price.divergence_response_hours', '24', 'Valor inicial (ADR 0024): o posto tem um dia para reconfirmar ou contestar.'),
  ('price.trusted_min_account_days', '3', 'Valor inicial (ADR 0024): conta com 3 dias confirma o informe de outra pessoa.'),
  ('price.trusted_min_accepted_reports', '1', 'Valor inicial (ADR 0024): um informe aceito antes de confirmar o de outra pessoa.'),
  ('price.near_station_m', '300', 'Valor inicial (ADR 0024): até 300 m do posto conta como "estava no posto".'),
  ('price.away_weight_pct', '50', 'Valor inicial (ADR 0024): informe à distância vale metade na confirmação.'),
  ('price.burst_window_minutes', '60', 'Valor inicial (ADR 0024): rajada em até uma hora.'),
  ('price.burst_min_reports', '3', 'Valor inicial (ADR 0024): 3 informes iguais e destoantes formam uma rajada.');
