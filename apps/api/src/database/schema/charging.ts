import type { Charger } from '@tankei/shared';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stations } from './stations';
import { users } from './users';

/**
 * Pontos de recarga do posto (ADR 0041), cadastrados pelo posto ou pela
 * equipe. Só inserção: vale a versão mais recente; lista vazia = sem recarga.
 */
export const stationChargerVersions = pgTable(
  'station_charger_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    chargers: jsonb().$type<Charger[]>().notNull(),
    /** "posto" (portal) ou "equipe" (admin). */
    source: text().notNull(),
    userId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_charger_versions_station_idx').on(t.stationId, t.createdAt),
  ],
);

/** "Este posto tem recarga", dito por um consumidor. Só inserção. */
export const chargerSuggestions = pgTable(
  'charger_suggestions',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    /** "ac" ou "dc". */
    current: text().notNull(),
    connector: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('charger_suggestions_station_idx').on(
      t.stationId,
      t.current,
      t.createdAt,
    ),
  ],
);

/**
 * Sugestões descartadas pela moderação: as anteriores a este registro, do
 * mesmo posto e tipo, deixam de contar. Só inserção.
 */
export const chargerSuggestionDismissals = pgTable(
  'charger_suggestion_dismissals',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    current: text().notNull(),
    reason: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('charger_suggestion_dismissals_station_idx').on(
      t.stationId,
      t.current,
      t.createdAt,
    ),
  ],
);
