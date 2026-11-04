import { char, index, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Municípios brasileiros, da lista oficial do IBGE (ADR 0014). Dados de
 * referência: atualizados pela importação, sem histórico.
 */
export const municipalities = pgTable(
  'municipalities',
  {
    /** Código IBGE de 7 dígitos. */
    code: char({ length: 7 }).primaryKey(),
    /** Nome oficial, com acentos ("São José"). */
    name: text().notNull(),
    state: char({ length: 2 }).notNull(),
    /** Nome sem acentos nem pontuação, em maiúsculas, para casar com a ANP. */
    normalizedName: text().notNull(),
  },
  (t) => [
    index('municipalities_state_normalized_idx').on(t.state, t.normalizedName),
  ],
);
