import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../load-env';
import { MunicipalitiesService } from '../municipalities/municipalities.service';

/**
 * Importa a lista oficial de municípios do IBGE e liga a eles os postos já
 * cadastrados (ADR 0014). Rode antes de import:anp numa base nova.
 * Uso: pnpm --filter @tankei/api import:ibge
 */
async function main() {
  loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app.get(MunicipalitiesService).importFromIbge();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
