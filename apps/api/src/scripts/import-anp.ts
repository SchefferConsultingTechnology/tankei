import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../load-env';
import { AnpImportService } from '../stations/anp/anp-import.service';

/**
 * Importa os postos de um município da API Revendedores da ANP.
 * Uso: pnpm --filter @tankei/api import:anp [UF] [MUNICIPIO]
 * Padrão: a cidade-piloto (ADR 0002).
 */
async function main() {
  loadEnv();
  const [uf = 'SC', municipio = 'CURITIBANOS'] = process.argv.slice(2);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app.get(AnpImportService).importar(uf, municipio);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
