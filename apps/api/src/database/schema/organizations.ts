import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgRoleEnum, orgScopeEnum } from './enums';
import { stations } from './stations';
import { users } from './users';

/** Rede de postos (ADR 0021): agrupa unidades e a equipe que cuida delas. */
export const organizations = pgTable('organizations', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdByUserId: uuid().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Unidade da rede. Cada posto pertence a no máximo uma rede. */
export const organizationStations = pgTable(
  'organization_stations',
  {
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    stationId: uuid()
      .notNull()
      .unique('organization_stations_station_unique')
      .references(() => stations.id),
    addedByUserId: uuid().references(() => users.id),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.stationId] })],
);

/** Pessoa da equipe da rede, com papel e escopo. */
export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: orgRoleEnum().notNull(),
    scope: orgScopeEnum().notNull().default('todas'),
    createdByUserId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    index('organization_members_user_idx').on(t.userId),
  ],
);

/** Unidades escolhidas de um membro com escopo "selecionadas". */
export const organizationMemberStations = pgTable(
  'organization_member_stations',
  {
    organizationId: uuid().notNull(),
    userId: uuid().notNull(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId, t.stationId] })],
);

/**
 * Convite para a equipe, por e-mail. Vira membro quando a pessoa entra com
 * uma conta daquele e-mail e aceita. Um convite decidido não muda mais.
 */
export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    email: text().notNull(),
    role: orgRoleEnum().notNull(),
    scope: orgScopeEnum().notNull(),
    stationIds: jsonb().$type<string[]>().notNull().default([]),
    invitedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedByUserId: uuid().references(() => users.id),
    declinedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('organization_invitations_email_idx').on(t.email),
    index('organization_invitations_org_idx').on(t.organizationId),
  ],
);

/**
 * Registro de auditoria da rede (ADR 0011 e 0021): equipe e unidades. Só
 * inserção.
 */
export const organizationEvents = pgTable(
  'organization_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid().references(() => users.id),
    action: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('organization_events_org_idx').on(t.organizationId, t.createdAt),
  ],
);
