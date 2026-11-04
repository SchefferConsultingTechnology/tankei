import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authProviderEnum, userRoleEnum } from './enums';
import { stations } from './stations';

/**
 * Conta de usuário (ADR 0007). Dados pessoais mínimos (ADR 0009): na exclusão
 * da conta, nome, e-mail e foto são apagados e a linha permanece, anônima, para
 * que informes e avaliações continuem no histórico.
 */
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text(),
  email: text(),
  // Endereço da foto no provedor de login; a imagem não é copiada.
  avatarUrl: text(),
  role: userRoleEnum().notNull().default('motorista'),
  deletedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Conta no Google ou na Apple vinculada ao usuário. */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    provider: authProviderEnum().notNull(),
    // Identificador da pessoa no provedor (claim "sub" do token).
    subject: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('user_identities_provider_subject_unique').on(t.provider, t.subject),
  ],
);

/**
 * Sessão aberta por login. Guarda só o hash do token de renovação. Cada
 * renovação revoga a sessão e cria outra na mesma família; reutilizar um token
 * já revogado revoga a família inteira (sinal de token vazado).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    familyId: uuid().notNull(),
    refreshTokenHash: text()
      .notNull()
      .unique('sessions_refresh_token_hash_unique'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    index('sessions_family_idx').on(t.familyId),
  ],
);

/** Vínculo do gestor com o posto, feito pelo administrador no piloto (ADR 0007). */
export const stationManagers = pgTable(
  'station_managers',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    createdByUserId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.stationId] })],
);
