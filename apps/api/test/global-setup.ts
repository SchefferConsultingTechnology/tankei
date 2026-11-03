import { recreateDatabase } from '../src/database/recreate-database';
import { loadEnv } from '../src/load-env';

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
}
