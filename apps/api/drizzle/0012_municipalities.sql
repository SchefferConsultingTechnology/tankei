CREATE TABLE "municipalities" (
	"code" char(7) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" char(2) NOT NULL,
	"normalized_name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "municipality_code" char(7);--> statement-breakpoint
CREATE INDEX "municipalities_state_normalized_idx" ON "municipalities" USING btree ("state","normalized_name");--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_municipality_code_municipalities_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stations_municipality_idx" ON "stations" USING btree ("municipality_code");