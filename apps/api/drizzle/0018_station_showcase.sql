CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_user_id" uuid,
	"image_key" text,
	"image_uploaded_at" timestamp with time zone,
	"image_uploaded_by_user_id" uuid,
	"image_removed_at" timestamp with time zone,
	"image_removed_by_user_id" uuid,
	"image_removed_reason" text
);
--> statement-breakpoint
CREATE TABLE "station_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"caption" text,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_user_id" uuid,
	"removed_reason" text
);
--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_image_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("image_uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_image_removed_by_user_id_users_id_fk" FOREIGN KEY ("image_removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_photos" ADD CONSTRAINT "station_photos_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_photos" ADD CONSTRAINT "station_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_photos" ADD CONSTRAINT "station_photos_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotions_station_idx" ON "promotions" USING btree ("station_id","ends_at");--> statement-breakpoint
CREATE INDEX "station_photos_station_idx" ON "station_photos" USING btree ("station_id","created_at");--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Parte manual (ADR 0026): limites de fotos e de tamanho de imagem.
INSERT INTO parameters (key, value, reason) VALUES
  ('media.max_station_photos', '10', 'Valor inicial (ADR 0026): até 10 fotos publicadas por posto.'),
  ('media.max_upload_mb', '5', 'Valor inicial (ADR 0026): imagens de até 5 MB.');
