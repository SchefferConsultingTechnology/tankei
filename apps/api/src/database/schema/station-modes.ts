import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { hideReasonEnum, stationModeEnum } from './enums';
import { stations } from './stations';
import { users } from './users';

/**
 * Mudanças do modo de exibição do posto (ADR 0028), decididas pela
 * administração a pedido do posto. Só inserção; o modo atual fica em
 * stations.display_mode.
 */
export const stationModeChanges = pgTable(
  'station_mode_changes',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    mode: stationModeEnum().notNull(),
    hideReason: hideReasonEnum(),
    requestedBy: text().notNull(),
    reason: text().notNull(),
    decidedByUserId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_mode_changes_station_idx').on(t.stationId, t.createdAt),
  ],
);
