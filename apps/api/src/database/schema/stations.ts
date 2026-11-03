import {
  boolean,
  char,
  geometry,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fuelTypeEnum, locationSourceEnum } from './enums';

/**
 * Posto (estabelecimento). Identificado pelo CNPJ completo: uma mesma empresa
 * pode operar vários postos (ADR 0002).
 */
export const stations = pgTable(
  'stations',
  {
    id: uuid().primaryKey().defaultRandom(),
    cnpj: char({ length: 14 }).notNull().unique('stations_cnpj_unique'),
    anpAuthorization: text().unique('stations_anp_authorization_unique'),
    legalName: text().notNull(),
    tradeName: text(),
    brand: text().notNull(),
    address: text().notNull(),
    complement: text(),
    district: text(),
    postalCode: char({ length: 8 }),
    city: text().notNull(),
    state: char({ length: 2 }).notNull(),
    // WGS 84. Nulo enquanto o posto não tiver coordenada (ADR 0005).
    location: geometry({ type: 'point', mode: 'xy', srid: 4326 }),
    locationSource: locationSourceEnum(),
    locationValidated: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('stations_location_idx').using('gist', t.location),
    index('stations_state_city_idx').on(t.state, t.city),
  ],
);

/** Combustíveis que o posto vende. */
export const stationFuels = pgTable(
  'station_fuels',
  {
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    fuelType: fuelTypeEnum().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.stationId, t.fuelType] })],
);
