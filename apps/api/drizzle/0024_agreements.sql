CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_from" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_agreement_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"discounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"active" boolean NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_agreement_versions" ADD CONSTRAINT "station_agreement_versions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_agreement_versions" ADD CONSTRAINT "station_agreement_versions_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_agreement_versions" ADD CONSTRAINT "station_agreement_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_agreement_versions_station_idx" ON "station_agreement_versions" USING btree ("station_id","agreement_id","created_at");--> statement-breakpoint
CREATE INDEX "station_agreement_versions_agreement_idx" ON "station_agreement_versions" USING btree ("agreement_id");--> statement-breakpoint
-- Parte manual (ADR 0034): descontos só de inserção, como os preços.
CREATE TRIGGER station_agreement_versions_append_only
  BEFORE UPDATE OR DELETE ON station_agreement_versions
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_agreement_versions_no_truncate
  BEFORE TRUNCATE ON station_agreement_versions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
-- Nome único sem diferenciar maiúsculas e acentos (o serviço também confere).
CREATE UNIQUE INDEX agreements_name_normalized_unique ON agreements (
  translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
);--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('agreement.max_discount_pct', '30', 'Valor inicial (ADR 0034): desconto de convênio de até 30%.'),
  ('agreement.max_discount_per_liter', '1', 'Valor inicial (ADR 0034): desconto de convênio de até R$ 1,00 por litro.');
