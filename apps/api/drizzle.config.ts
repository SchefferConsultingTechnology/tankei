import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/load-env';

loadEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  // Ignora as tabelas internas do PostGIS (spatial_ref_sys).
  extensionsFilters: ['postgis'],
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
