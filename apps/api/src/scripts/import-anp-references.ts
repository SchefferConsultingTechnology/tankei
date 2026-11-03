import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../load-env';
import { PriceReferenceImportService } from '../prices/anp-reference/price-reference-import.service';

/**
 * Importa os resumos semanais de preços da ANP (referência do ADR 0006).
 * Uso: pnpm --filter @tankei/api import:anp-referencias [SEMANAS]
 * Padrão: até 8 semanas, parando na primeira que já estiver no banco.
 */
async function main() {
  loadEnv();
  const maxWeeks = process.argv[2] ? Number(process.argv[2]) : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app
      .get(PriceReferenceImportService)
      .importar(maxWeeks);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
