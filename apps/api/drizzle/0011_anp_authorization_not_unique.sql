ALTER TABLE "stations" DROP CONSTRAINT "stations_anp_authorization_unique";--> statement-breakpoint
CREATE INDEX "stations_anp_authorization_idx" ON "stations" USING btree ("anp_authorization");