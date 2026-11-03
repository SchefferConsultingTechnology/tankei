import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * Apaga e recria o banco `<banco de DATABASE_URL>_<sufixo>` com todas as
 * migrations e devolve a URL dele. Usado pelos testes e2e e pela demonstração.
 */
export async function recreateDatabase(
  baseUrl: string,
  suffix: string,
): Promise<string> {
  const base = new URL(baseUrl);
  const name = `${base.pathname.slice(1)}_${suffix}`;

  const adminUrl = new URL(base);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const url = new URL(base);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await migrate(drizzle(client), {
    migrationsFolder: join(__dirname, '..', '..', 'drizzle'),
  });
  await client.end();
  return url.toString();
}
