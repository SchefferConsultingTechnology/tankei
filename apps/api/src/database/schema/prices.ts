import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fuelTypeEnum, priceReportStatusEnum, priceSourceEnum } from './enums';
import { stations } from './stations';

/**
 * Cada informe de preço recebido (ADR 0003). Só inserção: UPDATE e DELETE são
 * bloqueados por trigger. O preço exibido é derivado destes registros, e uma
 * confirmação é outro informe com o mesmo valor.
 *
 * O autor (usuário ou posto) entra quando existir a tabela de usuários.
 */
export const priceReports = pgTable(
  'price_reports',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    fuelType: fuelTypeEnum().notNull(),
    // R$ por litro (ou m³ no GNV), com 3 casas como nas bombas.
    price: numeric({ precision: 6, scale: 3, mode: 'number' }).notNull(),
    source: priceSourceEnum().notNull(),
    status: priceReportStatusEnum().notNull().default('valido'),
    reportedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('price_reports_station_fuel_reported_idx').on(
      t.stationId,
      t.fuelType,
      t.reportedAt.desc(),
    ),
    check('price_reports_price_positive', sql`${t.price} > 0`),
  ],
);
