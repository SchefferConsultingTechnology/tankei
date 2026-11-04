import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import { recreateDatabase } from '../database/recreate-database';
import * as schema from '../database/schema';
import { loadEnv } from '../load-env';
import { seedDemo } from './demo-scenario';

/**
 * Recria o banco de demonstração (`<banco>_demo`): copia postos, combustíveis
 * e referências da ANP do banco de desenvolvimento e acrescenta preços e
 * avaliações FICTÍCIOS, para ver o app funcionando. Nunca grava no banco de
 * desenvolvimento. Os dados fictícios estão em demo-scenario.ts.
 *
 * Uso: pnpm --filter @tankei/api demo:db
 * Depois, suba a API apontando para o banco indicado na saída.
 */

async function main() {
  loadEnv();
  const devUrl = process.env.DATABASE_URL ?? '';
  const demoUrl = await recreateDatabase(devUrl, 'demo');

  const dev = new Client({ connectionString: devUrl });
  await dev.connect();
  const devDb = drizzle({ client: dev, schema, casing: 'snake_case' });
  const devMunicipalities = await devDb.select().from(schema.municipalities);
  const devStations = await devDb.select().from(schema.stations);
  const devFuels = await devDb.select().from(schema.stationFuels);
  const devReferences = await devDb.select().from(schema.priceReferences);
  await dev.end();

  // A partir daqui, tudo grava no banco de demonstração.
  process.env.DATABASE_URL = demoUrl;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const db = app.get<Database>(DRIZZLE);

    // Em lotes: o banco de desenvolvimento pode ter os postos do Brasil inteiro.
    // Municípios antes dos postos, que apontam para eles.
    for (const batch of chunks(devMunicipalities)) {
      await db.insert(schema.municipalities).values(batch);
    }
    for (const batch of chunks(devStations)) {
      await db.insert(schema.stations).values(
        batch.map(({ location, ...station }) => ({
          ...station,
          location: location
            ? sql`ST_SetSRID(ST_MakePoint(${location.x}, ${location.y}), 4326)`
            : null,
        })),
      );
    }
    for (const batch of chunks(devFuels)) {
      await db.insert(schema.stationFuels).values(batch);
    }
    for (const batch of chunks(devReferences)) {
      await db.insert(schema.priceReferences).values(batch);
    }

    const scored = await seedDemo(app);
    console.log(
      `Banco de demonstração pronto: ${devStations.length} postos, IQP de ${scored} posto(s).`,
    );
    console.log(
      `Suba a API com:\n  DATABASE_URL=${demoUrl} pnpm --filter @tankei/api dev`,
    );
  } finally {
    await app.close();
  }
}

function chunks<T>(items: T[], size = 1000): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
