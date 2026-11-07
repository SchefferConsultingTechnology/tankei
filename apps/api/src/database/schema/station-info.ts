import type { OpeningHours } from '@tankei/shared';
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
 * Horário de atendimento e serviços do posto (ADR 0033). Só inserção: cada
 * alteração é uma versão nova; vale a mais recente.
 */
export const stationInfoVersions = pgTable(
  'station_info_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    hours: jsonb().$type<OpeningHours>(),
    /** Nome no app nesta versão (ADR 0035); nulo usa o nome oficial. */
    displayName: text(),
    // text[]: o driver pg não converte arrays de enum.
    services: text().array().notNull().default([]),
    /** "posto" (portal) ou "equipe" (admin). */
    source: text().notNull(),
    userId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_info_versions_station_idx').on(t.stationId, t.createdAt),
  ],
);
