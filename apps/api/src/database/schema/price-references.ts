import {
  char,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { fuelTypeEnum } from './enums';

/**
 * Preço médio semanal por UF e combustível, do resumo do levantamento de
 * preços da ANP (ADR 0006). Só inserção: guarda o histórico das referências.
 */
export const priceReferences = pgTable(
  'price_references',
  {
    id: uuid().primaryKey().defaultRandom(),
    weekStart: date({ mode: 'string' }).notNull(),
    weekEnd: date({ mode: 'string' }).notNull(),
    state: char({ length: 2 }).notNull(),
    fuelType: fuelTypeEnum().notNull(),
    averagePrice: numeric({ precision: 6, scale: 3, mode: 'number' }).notNull(),
    minPrice: numeric({ precision: 6, scale: 3, mode: 'number' }).notNull(),
    maxPrice: numeric({ precision: 6, scale: 3, mode: 'number' }).notNull(),
    stationsSurveyed: integer().notNull(),
    sourceUrl: text().notNull(),
    importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('price_references_week_state_fuel_unique').on(
      t.weekStart,
      t.state,
      t.fuelType,
    ),
    index('price_references_state_fuel_week_idx').on(
      t.state,
      t.fuelType,
      t.weekStart.desc(),
    ),
  ],
);
