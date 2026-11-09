import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stations } from './stations';
import { users } from './users';

/**
 * Visitas dos motoristas ao posto no app (spec 0003, ADR 0039). Anônimas: sem
 * conta e sem coordenadas, só um identificador aleatório da instalação. Só
 * inserção; o id vem do aparelho, e o reenvio é ignorado.
 */
export const stationVisits = pgTable(
  'station_visits',
  {
    id: uuid().primaryKey(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    visitorId: uuid().notNull(),
    // text: o driver pg não converte arrays de enum, e os valores são
    // validados pelos schemas do @tankei/shared na entrada.
    source: text().notNull(),
    drivingMode: boolean().notNull().default(false),
    openedAt: timestamp({ withTimezone: true }).notNull(),
    detailOpenedAt: timestamp({ withTimezone: true }),
    detailMs: integer(),
    actions: text().array().notNull().default([]),
    closeReason: text().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_visits_station_opened_idx').on(t.stationId, t.openedAt),
    index('station_visits_opened_idx').on(t.openedAt),
  ],
);

/**
 * Recursos do plano por posto (ex.: visitas no portal). Só inserção: cada
 * mudança é uma linha nova; vale a mais recente de cada posto e recurso.
 */
export const stationFeatureChanges = pgTable(
  'station_feature_changes',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    feature: text().notNull(),
    active: boolean().notNull(),
    note: text(),
    /** "equipe" (admin) ou, no futuro, "assinatura". */
    source: text().notNull(),
    userId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_feature_changes_station_idx').on(
      t.stationId,
      t.feature,
      t.createdAt,
    ),
  ],
);
