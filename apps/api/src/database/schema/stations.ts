import { sql } from 'drizzle-orm';
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
import { municipalities } from './municipalities';

/**
 * Posto (estabelecimento). Identificado pelo CNPJ completo: uma mesma empresa
 * pode operar vários postos (ADR 0002).
 */
export const stations = pgTable(
  'stations',
  {
    id: uuid().primaryKey().defaultRandom(),
    cnpj: char({ length: 14 }).notNull().unique('stations_cnpj_unique'),
    // Não é única: a base da ANP repete autorizações entre CNPJs diferentes.
    anpAuthorization: text(),
    legalName: text().notNull(),
    tradeName: text(),
    brand: text().notNull(),
    address: text().notNull(),
    complement: text(),
    district: text(),
    postalCode: char({ length: 8 }),
    city: text().notNull(),
    state: char({ length: 2 }).notNull(),
    // Município oficial do IBGE, ligado pelo nome da ANP (ADR 0014).
    municipalityCode: char({ length: 7 }).references(() => municipalities.code),
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
    // A busca por proximidade calcula distâncias em metros com geography.
    index('stations_location_geography_idx').using(
      'gist',
      sql`(${t.location}::geography)`,
    ),
    index('stations_state_city_idx').on(t.state, t.city),
    index('stations_anp_authorization_idx').on(t.anpAuthorization),
    index('stations_municipality_idx').on(t.municipalityCode),
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
