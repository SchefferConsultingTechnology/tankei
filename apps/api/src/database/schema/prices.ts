import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
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
import { promotions } from './showcase';
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
    // Gravados na entrada (ADR 0024), para explicar a decisão mesmo depois de
    // os parâmetros mudarem. A posição em si nunca é guardada (ADR 0009).
    // Nulo: sem localização, ou informe anterior à regra.
    atStation: boolean(),
    // Conta já confiável ao informar (idade e informes aceitos). Nulo: anterior.
    reporterTrusted: boolean(),
    // Peso do informe na confirmação (0 a 1). Nulo: anterior à regra, vale 1.
    confirmationWeight: numeric({ precision: 3, scale: 2, mode: 'number' }),
    // Preço de uma promoção cadastrada (ADR 0026). O fim efetivo considera
    // promotions.ended_at (encerrada antes).
    promotionId: uuid().references((): AnyPgColumn => promotions.id),
    promotionLabel: text(),
    promotionStartsAt: timestamp({ withTimezone: true }),
    promotionEndsAt: timestamp({ withTimezone: true }),
    // Visita do app em que o informe foi feito (spec 0003). Sem chave
    // estrangeira: a visita pode chegar depois do informe.
    visitId: uuid(),
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
