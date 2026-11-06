import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  fuelTypeEnum,
  moderationDecisionEnum,
  moderationKindEnum,
} from './enums';
import { priceReports } from './prices';
import { stations } from './stations';
import { users } from './users';

/**
 * Caso de moderação (ADR 0020 e 0024): contestação do posto ou rajada
 * detectada pelo sistema. Só inserção. Enquanto não há decisão, os informes
 * do caso não contam no preço exibido.
 */
export const priceModerationCases = pgTable(
  'price_moderation_cases',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: moderationKindEnum().notNull(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    fuelType: fuelTypeEnum().notNull(),
    // Quem do posto contestou; nulo quando o sistema abriu (rajada).
    openedByUserId: uuid().references(() => users.id),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('price_moderation_cases_station_idx').on(t.stationId)],
);

/** Informes de cada caso. Só inserção. */
export const priceModerationCaseReports = pgTable(
  'price_moderation_case_reports',
  {
    caseId: uuid()
      .notNull()
      .references(() => priceModerationCases.id),
    reportId: uuid()
      .notNull()
      .references(() => priceReports.id),
  },
  (t) => [
    primaryKey({ columns: [t.caseId, t.reportId] }),
    index('price_moderation_case_reports_report_idx').on(t.reportId),
  ],
);

/** Decisão da equipe Tankei: uma por caso. Só inserção. */
export const priceModerationDecisions = pgTable('price_moderation_decisions', {
  id: uuid().primaryKey().defaultRandom(),
  caseId: uuid()
    .notNull()
    .unique('price_moderation_decisions_case_unique')
    .references(() => priceModerationCases.id),
  decision: moderationDecisionEnum().notNull(),
  reason: text().notNull(),
  decidedByUserId: uuid()
    .notNull()
    .references(() => users.id),
  decidedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
