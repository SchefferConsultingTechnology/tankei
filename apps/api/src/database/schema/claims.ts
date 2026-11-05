import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  claimDecisionEnum,
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
