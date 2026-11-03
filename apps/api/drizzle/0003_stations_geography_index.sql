DROP INDEX "stations_location_idx";--> statement-breakpoint
CREATE INDEX "stations_location_geography_idx" ON "stations" USING gist (("location"::geography));