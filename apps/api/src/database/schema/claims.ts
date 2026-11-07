import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  claimDecisionEnum,
  claimOriginEnum,
  claimPositionEnum,
  verificationMethodEnum,
} from './enums';
import { stations } from './stations';
import { users } from './users';

/**
 * Pedido para gerenciar um posto no portal (ADR 0019). Não é só de inserção:
 * nome e telefone são apagados se a conta for excluída (ADR 0009).
 */
export const stationClaims = pgTable(
  'station_claims',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    contactName: text(),
    phone: text(),
    position: claimPositionEnum().notNull(),
    message: text(),
    /** De onde veio o pedido (ADR 0031). */
    origin: claimOriginEnum().notNull().default('portal'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('station_claims_user_idx').on(t.userId),
    index('station_claims_station_idx').on(t.stationId),
  ],
);

/**
 * Decisão do administrador sobre um pedido: uma por pedido, só de inserção
 * (registro de auditoria da verificação, ADR 0011).
 */
export const stationClaimDecisions = pgTable('station_claim_decisions', {
  id: uuid().primaryKey().defaultRandom(),
  claimId: uuid()
    .notNull()
    .unique('station_claim_decisions_claim_unique')
    .references(() => stationClaims.id),
  decision: claimDecisionEnum().notNull(),
  // Na aprovação: como o vínculo foi comprovado.
  verificationMethod: verificationMethodEnum(),
  // Na recusa: mostrado a quem pediu.
  reason: text(),
  decidedByUserId: uuid()
    .notNull()
    .references(() => users.id),
  decidedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Proprietário atual do posto que não reconhece o pedido (ADR 0011 e 0027).
 * Uma por pessoa e pedido; só inserção. A equipe Tankei vê antes de decidir.
 */
export const stationClaimDisputes = pgTable(
  'station_claim_disputes',
  {
    id: uuid().primaryKey().defaultRandom(),
    claimId: uuid()
      .notNull()
      .references(() => stationClaims.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    reason: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('station_claim_disputes_claim_user_unique').on(t.claimId, t.userId),
  ],
);
