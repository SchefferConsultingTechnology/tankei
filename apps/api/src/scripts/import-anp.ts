import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../load-env';
import type { AnpFiltro } from '../stations/anp/anp-revendedores.client';
import { AnpImportService } from '../stations/anp/anp-import.service';

/**
 * Importa postos da API Revendedores da ANP (ADR 0013).
 * Uso: pnpm --filter @tankei/api import:anp [BR | UF [MUNICIPIO]]
 *   import:anp BR             todo o Brasil
 *   import:anp SC             um estado
 *   import:anp SC LAGES       um município
 * Sem argumentos: a cidade-piloto (ADR 0002).
 */
async function main() {
  loadEnv();
  const [first = 'SC', second] = process.argv.slice(2);
  const filtro: AnpFiltro =
    first.toUpperCase() === 'BR'
      ? {}
      : {
          uf: first.toUpperCase(),
          municipio:
            process.argv.length > 2 ? second?.toUpperCase() : 'CURITIBANOS',
        };

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app.get(AnpImportService).importar(filtro);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
