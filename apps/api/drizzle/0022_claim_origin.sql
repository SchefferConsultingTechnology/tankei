CREATE TYPE "public"."claim_origin" AS ENUM('portal', 'app_dono', 'app_convite');--> statement-breakpoint
ALTER TABLE "station_claims" ADD COLUMN "origin" "claim_origin" DEFAULT 'portal' NOT NULL;