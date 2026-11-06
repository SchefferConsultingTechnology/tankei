import { sql, type SQL } from 'drizzle-orm';

/** Minúsculas e sem acento, no SQL (sem depender da extensão unaccent). */
export function normalized(value: SQL | string): SQL {
  return sql`translate(lower(${value}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
}
