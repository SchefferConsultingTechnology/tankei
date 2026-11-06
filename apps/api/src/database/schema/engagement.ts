import {
  index,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fuelTypeEnum } from './enums';
import { stations } from './stations';
import { users } from './users';

/** Postos favoritos da pessoa (ADR 0029). Apagados com a conta. */
export const favoriteStations = pgTable(
  'favorite_stations',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.stationId] })],
);

/**
 * Alerta de preço (ADR 0029): avisa por e-mail quando o preço exibido do
 * combustível no posto fica igual ou abaixo do valor. Apagado com a conta.
 */
export const priceAlerts = pgTable(
  'price_alerts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    fuelType: fuelTypeEnum().notNull(),
    maxPrice: numeric({ precision: 6, scale: 3, mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastNotifiedAt: timestamp({ withTimezone: true }),
    lastNotifiedPrice: numeric({ precision: 6, scale: 3, mode: 'number' }),
  },
  (t) => [
    index('price_alerts_station_fuel_idx').on(t.stationId, t.fuelType),
    index('price_alerts_user_idx').on(t.userId),
  ],
);
