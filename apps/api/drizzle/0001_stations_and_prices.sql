CREATE TYPE "public"."fuel_type" AS ENUM('gasolina_comum', 'gasolina_aditivada', 'gasolina_premium', 'etanol', 'diesel_s10', 'diesel_s500', 'gnv');--> statement-breakpoint
CREATE TYPE "public"."location_source" AS ENUM('anp', 'geocodificacao', 'campo');--> statement-breakpoint
CREATE TYPE "public"."price_report_status" AS ENUM('valido', 'suspeito', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('usuario', 'posto', 'anp');--> statement-breakpoint
CREATE TABLE "station_fuels" (
	"station_id" uuid NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_fuels_station_id_fuel_type_pk" PRIMARY KEY("station_id","fuel_type")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" char(14) NOT NULL,
	"anp_authorization" text,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"brand" text NOT NULL,
	"address" text NOT NULL,
	"complement" text,
	"district" text,
	"postal_code" char(8),
	"city" text NOT NULL,
	"state" char(2) NOT NULL,
	"location" geometry(point, 4326),
	"location_source" "location_source",
	"location_validated" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stations_cnpj_unique" UNIQUE("cnpj"),
	CONSTRAINT "stations_anp_authorization_unique" UNIQUE("anp_authorization")
);
--> statement-breakpoint
CREATE TABLE "price_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"price" numeric(6, 3) NOT NULL,
	"source" "price_source" NOT NULL,
	"status" "price_report_status" DEFAULT 'valido' NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_reports_price_positive" CHECK ("price_reports"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "station_fuels" ADD CONSTRAINT "station_fuels_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stations_location_idx" ON "stations" USING gist ("location");--> statement-breakpoint
CREATE INDEX "stations_state_city_idx" ON "stations" USING btree ("state","city");--> statement-breakpoint
CREATE INDEX "price_reports_station_fuel_reported_idx" ON "price_reports" USING btree ("station_id","fuel_type","reported_at" DESC NULLS LAST);