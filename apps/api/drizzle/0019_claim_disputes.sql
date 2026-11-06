CREATE TABLE "station_claim_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_claim_disputes_claim_user_unique" UNIQUE("claim_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "station_claim_disputes" ADD CONSTRAINT "station_claim_disputes_claim_id_station_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."station_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_claim_disputes" ADD CONSTRAINT "station_claim_disputes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Parte manual (ADR 0027): registro de auditoria, só inserção.
CREATE TRIGGER station_claim_disputes_append_only
  BEFORE UPDATE OR DELETE ON station_claim_disputes
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER station_claim_disputes_no_truncate
  BEFORE TRUNCATE ON station_claim_disputes
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
