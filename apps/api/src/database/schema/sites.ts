import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { stations } from './stations';
import { users } from './users';

/**
 * Endereços (slugs) da página do posto (spec 0004, ADR 0042). Só inserção: um
 * slug, uma vez usado, pertence ao posto para sempre e o endereço antigo
 * redireciona para o atual.
 */
export const stationSiteSlugs = pgTable(
  'station_site_slugs',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    slug: text().notNull().unique(),
    /** "auto" (nome no app e cidade), "posto" (portal) ou "equipe" (admin). */
    source: text().notNull(),
    userId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('station_site_slugs_station_idx').on(t.stationId, t.createdAt)],
);
