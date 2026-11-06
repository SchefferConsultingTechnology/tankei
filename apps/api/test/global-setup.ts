import { Client } from 'pg';
import { recreateDatabase } from '../src/database/recreate-database';
import { loadEnv } from '../src/load-env';

/**
 * Peso neutro na confirmação (ADR 0024): nos testes, contas são criadas na
 * hora e sem localização. Com os valores de produção, nenhuma confirmaria.
 * O teste da fase 2 (confidence.e2e-spec.ts) aplica os valores de produção só
 * na instância dele, sem mexer no banco compartilhado.
 */
const NEUTRAL_WEIGHT = [
  ['price.trusted_min_account_days', 0],
  ['price.trusted_min_accepted_reports', 0],
  ['price.away_weight_pct', 100],
] as const;

/**
 * Roda no processo principal do Jest, antes de cada arquivo de teste copiar
 * process.env. Recria o banco de testes (`<banco>_test`) com as migrations:
 * os testes nunca tocam o banco de desenvolvimento, e tabelas só de inserção
 * começam vazias a cada execução.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv();
  process.env.DATABASE_URL = await recreateDatabase(
    process.env.DATABASE_URL ?? '',
    'test',
  );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const [key, value] of NEUTRAL_WEIGHT) {
    await client.query(
      'INSERT INTO parameters (key, value, reason) VALUES ($1, $2, $3)',
      [key, JSON.stringify(value), 'Testes e2e: peso neutro'],
    );
  }
  await client.end();
}
