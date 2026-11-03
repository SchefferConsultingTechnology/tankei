CREATE TABLE "price_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"state" char(2) NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"average_price" numeric(6, 3) NOT NULL,
	"min_price" numeric(6, 3) NOT NULL,
	"max_price" numeric(6, 3) NOT NULL,
	"stations_surveyed" integer NOT NULL,
	"source_url" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_references_week_state_fuel_unique" UNIQUE("week_start","state","fuel_type")
);
--> statement-breakpoint
CREATE TABLE "parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"reason" text NOT NULL,
	"changed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "price_references_state_fuel_week_idx" ON "price_references" USING btree ("state","fuel_type","week_start" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "parameters_key_created_idx" ON "parameters" USING btree ("key","created_at" DESC NULLS LAST);