CREATE TYPE "public"."claim_decision" AS ENUM('aprovado', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."claim_position" AS ENUM('dono', 'socio', 'gerente', 'outro');--> statement-breakpoint
CREATE TYPE "public"."manager_role" AS ENUM('responsavel', 'convidado');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('presencial', 'telefone', 'documentos', 'ecnpj', 'carta');--> statement-breakpoint
CREATE TABLE "station_claim_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"decision" "claim_decision" NOT NULL,
	"verification_method" "verification_method",
	"reason" text,
	"decided_by_user_id" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_claim_decisions_claim_unique" UNIQUE("claim_id")
);
--> statement-breakpoint
CREATE TABLE "station_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_name" text,
	"phone" text,
	"position" "claim_position" NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "station_managers" ADD COLUMN "role" "manager_role" DEFAULT 'responsavel' NOT NULL;--> statement-breakpoint
ALTER TABLE "station_managers" ADD COLUMN "verification_method" "verification_method";--> statement-breakpoint
ALTER TABLE "station_managers" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "station_claim_decisions" ADD CONSTRAINT "station_claim_decisions_claim_id_station_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."station_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_claim_decisions" ADD CONSTRAINT "station_claim_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_claims" ADD CONSTRAINT "station_claims_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_claims" ADD CONSTRAINT "station_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_claims_user_idx" ON "station_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "station_claims_station_idx" ON "station_claims" USING btree ("station_id");--> statement-breakpoint
-- Parte manual (ADR 0019).
-- Vínculos do piloto: feitos pelo administrador após contato pessoal (ADR 0007).
UPDATE "station_managers" SET "verification_method" = 'presencial', "verified_at" = "created_at" WHERE "role" = 'responsavel';--> statement-breakpoint
-- Decisões são o registro de auditoria da verificação: só inserção.
CREATE TRIGGER station_claim_decisions_append_only
  BEFORE UPDATE OR DELETE ON station_claim_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_claim_decisions_no_truncate
  BEFORE TRUNCATE ON station_claim_decisions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('claim.max_pending_per_user', '3', 'Valor inicial: até 3 pedidos em análise por conta.');
