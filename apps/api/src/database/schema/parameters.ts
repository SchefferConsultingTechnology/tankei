import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Parâmetros das regras de negócio (ADR 0006). Só inserção: cada alteração é
 * um registro novo, e o valor vigente é o mais recente de cada chave.
 * As chaves e os tipos estão em PARAMETER_DEFINITIONS (@tankei/shared).
 */
export const parameters = pgTable(
  'parameters',
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    value: jsonb().notNull(),
    reason: text().notNull(),
    // Nulo para valores definidos pelo sistema (migration).
    changedByUserId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('parameters_key_created_idx').on(t.key, t.createdAt.desc())],
);
