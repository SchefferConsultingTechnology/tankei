import type { AgreementDiscount } from '@tankei/shared';
import {
  boolean,
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
 * Cadastro único de convênios (ADR 0034). O portal cria; o admin renomeia,
 * descreve e desativa. Não se exclui um convênio que algum posto já usou.
 */
export const agreements = pgTable('agreements', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  description: text(),
  active: boolean().notNull().default(true),
  /** "portal" ou "admin". */
  createdFrom: text().notNull(),
  createdByUserId: uuid().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Descontos do posto num convênio (ADR 0034). Só inserção: cada alteração é
 * uma versão; vale a mais recente de cada (posto, convênio). Encerrar grava
 * uma versão com active = false.
 */
export const stationAgreementVersions = pgTable(
  'station_agreement_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    agreementId: uuid()
      .notNull()
      .references(() => agreements.id),
    discounts: jsonb().$type<AgreementDiscount[]>().notNull().default([]),
    note: text(),
    active: boolean().notNull(),
    userId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_agreement_versions_station_idx').on(
      t.stationId,
      t.agreementId,
      t.createdAt,
    ),
    index('station_agreement_versions_agreement_idx').on(t.agreementId),
  ],
);
