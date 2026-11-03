import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fuelTypeEnum, priceReportStatusEnum, priceSourceEnum } from './enums';
import { priceReferences } from './price-references';
import { stations } from './stations';
import { users } from './users';

/**
 * Cada informe de preço recebido (ADR 0003), inclusive os rejeitados. Só
 * inserção: UPDATE e DELETE são bloqueados por trigger. O preço exibido é
 * derivado destes registros, e uma confirmação é outro informe com o mesmo valor.
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
    // Quem informou: o motorista, ou o gestor quando a origem é o posto.
    reporterUserId: uuid().references(() => users.id),
    // Referência da ANP usada na validação e a distância dela, para explicar a
    // decisão mesmo depois de os parâmetros mudarem (ADR 0006).
    referenceId: uuid().references(() => priceReferences.id),
    referenceDeviationPct: numeric({
      precision: 6,
      scale: 2,
      mode: 'number',
    }),
    promotionLabel: text(),
    promotionStartsAt: timestamp({ withTimezone: true }),
    promotionEndsAt: timestamp({ withTimezone: true }),
    reportedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('price_reports_station_fuel_reported_idx').on(
      t.stationId,
      t.fuelType,
      t.reportedAt.desc(),
    ),
    index('price_reports_reporter_reported_idx').on(
      t.reporterUserId,
      t.reportedAt.desc(),
    ),
    check('price_reports_price_positive', sql`${t.price} > 0`),
    // Promoção: os três campos juntos, só do posto, com fim depois do início.
    check(
      'price_reports_promotion_complete',
      sql`(${t.promotionLabel} is null and ${t.promotionStartsAt} is null and ${t.promotionEndsAt} is null)
        or (${t.promotionLabel} is not null and ${t.source} = 'posto' and ${t.promotionEndsAt} > ${t.promotionStartsAt})`,
    ),
  ],
);
