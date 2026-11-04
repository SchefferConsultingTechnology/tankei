import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import { loadEnv } from '../load-env';
import { countDemoUsers, seedDemo } from './demo-scenario';

/**
 * Acrescenta os preços e avaliações FICTÍCIOS de demonstração a um banco que
 * já tem os postos (por exemplo, o de testes no Supabase, ADR 0016).
 *
 * Uso:
 *   DEMO_DATABASE_URL='postgresql://...' pnpm --filter @tankei/api demo:seed
 *
 * O destino vem de DEMO_DATABASE_URL, nunca do .env: o banco de
 * desenvolvimento não recebe dados fictícios. Preços são só de inserção e não
 * podem ser apagados depois; por isso o script recusa rodar duas vezes no
 * mesmo banco.
 */
async function main() {
  loadEnv();
  const url = process.env.DEMO_DATABASE_URL;
  if (!url) {
    throw new Error('Informe o banco de destino em DEMO_DATABASE_URL.');
  }
  process.env.DATABASE_URL = url;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const existing = await countDemoUsers(app.get<Database>(DRIZZLE));
    if (existing > 0) {
      throw new Error(
        `O banco já tem ${existing} usuário(s) de demonstração; nada foi gravado.`,
      );
    }
    const scored = await seedDemo(app);
    console.log(`Demonstração gravada. IQP de ${scored} posto(s).`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
