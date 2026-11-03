ALTER TABLE "price_reports" ADD COLUMN "reporter_user_id" uuid;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "reference_id" uuid;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "reference_deviation_pct" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "promotion_label" text;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "promotion_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "promotion_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_reference_id_price_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."price_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_reports_reporter_reported_idx" ON "price_reports" USING btree ("reporter_user_id","reported_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_promotion_complete" CHECK (("price_reports"."promotion_label" is null and "price_reports"."promotion_starts_at" is null and "price_reports"."promotion_ends_at" is null)
        or ("price_reports"."promotion_label" is not null and "price_reports"."source" = 'posto' and "price_reports"."promotion_ends_at" > "price_reports"."promotion_starts_at"));