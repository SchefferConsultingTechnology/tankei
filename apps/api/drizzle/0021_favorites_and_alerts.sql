CREATE TABLE "favorite_stations" (
	"user_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_stations_user_id_station_id_pk" PRIMARY KEY("user_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"max_price" numeric(6, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone,
	"last_notified_price" numeric(6, 3)
);
--> statement-breakpoint
ALTER TABLE "favorite_stations" ADD CONSTRAINT "favorite_stations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_stations" ADD CONSTRAINT "favorite_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_alerts_station_fuel_idx" ON "price_alerts" USING btree ("station_id","fuel_type");--> statement-breakpoint
CREATE INDEX "price_alerts_user_idx" ON "price_alerts" USING btree ("user_id");--> statement-breakpoint
-- Parte manual (ADR 0029): limites de favoritos e alertas e o selo de contribuição.
INSERT INTO parameters (key, value, reason) VALUES
  ('alert.max_per_user', '20', 'Valor inicial (ADR 0029): até 20 alertas de preço por conta.'),
  ('alert.min_interval_hours', '24', 'Valor inicial (ADR 0029): no máximo um e-mail por alerta por dia.'),
  ('favorite.max_per_user', '50', 'Valor inicial (ADR 0029): até 50 postos favoritos por conta.'),
  ('contributor.reliable_min_reports', '20', 'Valor inicial (ADR 0029): 20 informes aceitos para "Informante confiável".');
