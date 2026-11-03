CREATE TYPE "public"."iqp_confidence" AS ENUM('baixa', 'media', 'alta');--> statement-breakpoint
CREATE TABLE "iqp_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"methodology_version" text NOT NULL,
	"score" numeric(5, 2),
	"confidence" "iqp_confidence",
	"reviewers" integer NOT NULL,
	"effective_reviews" numeric(8, 3) NOT NULL,
	"dimensions" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iqp_scores" ADD CONSTRAINT "iqp_scores_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iqp_scores_station_computed_idx" ON "iqp_scores" USING btree ("station_id","computed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_station_user_created_idx" ON "reviews" USING btree ("station_id","user_id","created_at" DESC NULLS LAST);