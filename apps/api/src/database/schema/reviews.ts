import type { IqpCriterion, IqpDimension } from '@tankei/shared';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { iqpConfidenceEnum } from './enums';
import { stations } from './stations';
import { users } from './users';

/**
 * Respostas de uma avaliação, por critério: nota de 1 a 5 (critérios de nota),
 * true/false (sim/não) ou null ("não disponível"). Critério ausente = não avaliado.
 */
export type ReviewAnswers = Partial<
  Record<IqpCriterion, number | boolean | null>
>;

/**
 * Avaliação de um posto (ADR 0004). Só inserção: uma avaliação nova substitui
 * a anterior da mesma pessoa no cálculo, e ambas ficam no histórico.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    answers: jsonb().$type<ReviewAnswers>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reviews_station_user_created_idx').on(
      t.stationId,
      t.userId,
      t.createdAt.desc(),
    ),
  ],
);

export type IqpDimensionResult = Record<
  IqpDimension,
  { score: number | null; weight: number }
>;

/**
 * Cada cálculo do IQP de um posto (ADR 0004), com a versão da metodologia e a
 * nota de cada dimensão. Só inserção: o vigente é o mais recente do posto.
 */
export const iqpScores = pgTable(
  'iqp_scores',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    methodologyVersion: text().notNull(),
    // Nulos com "Dados insuficientes".
    score: numeric({ precision: 5, scale: 2, mode: 'number' }),
    confidence: iqpConfidenceEnum(),
    reviewers: integer().notNull(),
    effectiveReviews: numeric({
      precision: 8,
      scale: 3,
      mode: 'number',
    }).notNull(),
    dimensions: jsonb().$type<IqpDimensionResult>().notNull(),
    computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('iqp_scores_station_computed_idx').on(
      t.stationId,
      t.computedAt.desc(),
    ),
  ],
);
