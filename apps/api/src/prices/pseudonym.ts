import { createHash } from 'node:crypto';

/**
 * Apelido estável do consumidor em um posto (ADR 0020): o mesmo consumidor
 * tem apelidos diferentes em postos diferentes, sem dados pessoais.
 */
export function pseudonym(userId: string | null, stationId: string): string {
  if (!userId) return 'anônimo';
  return createHash('sha256')
    .update(`${stationId}:${userId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
}
