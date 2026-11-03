import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Client } from 'pg';
import { loadEnv } from '../src/load-env';

/**
 * Roda no processo principal do Jest, antes de cada arquivo de teste copiar
 * process.env. Recria o banco de testes (`<banco>_test`) e aplica as
 * migrations: os testes nunca tocam o banco de desenvolvimento, e tabelas só
 * de inserção começam vazias a cada execução.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv();
  const devUrl = new URL(process.env.DATABASE_URL ?? '');
  const testDatabase = `${devUrl.pathname.slice(1)}_test`;

  const adminUrl = new URL(devUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${testDatabase}"`);
  await admin.end();

  const testUrl = new URL(devUrl);
  testUrl.pathname = `/${testDatabase}`;
  process.env.DATABASE_URL = testUrl.toString();

  const client = new Client({ connectionString: testUrl.toString() });
  await client.connect();
  await migrate(drizzle(client), {
    migrationsFolder: join(__dirname, '..', 'drizzle'),
  });
  await client.end();
}
