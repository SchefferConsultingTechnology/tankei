import { NestFactory } from '@nestjs/core';
import type { FuelType } from '@tankei/shared';
import { and, eq, like, sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import { priceReports, reviews, stations, users } from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { loadEnv } from '../load-env';

/**
 * Informes de preço e avaliações FICTÍCIOS de motoristas, para visualizar o
 * dashboard de engajamento do admin (ADR 0036 e 0038): várias cidades de SC
 * e alguns outros estados, espalhados pelos últimos 12 meses.
 *
 * Uso (só em banco de teste):
 *   DEMO_DATABASE_URL='postgresql://...' pnpm --filter @tankei/api demo:engagement
 *
 * Contas fictícias com e-mail motorista-N@ficticio.tankei.test. Recusa rodar
 * duas vezes no mesmo banco. Recalcula o IQP no fim.
 */

const EMAIL_PREFIX = 'motorista-';
const EMAIL_DOMAIN = '@ficticio.tankei.test';
const DAY = 86_400_000;

/** Intensidade por cidade: quantos postos recebem interação e quantas. */
const PLACES: { state: string; city: string; share: number; events: number }[] =
  [
    { state: 'SC', city: 'CURITIBANOS', share: 0.9, events: 40 },
    { state: 'SC', city: 'LAGES', share: 0.7, events: 18 },
    { state: 'SC', city: 'CAMPOS NOVOS', share: 0.6, events: 10 },
    { state: 'SC', city: 'VIDEIRA', share: 0.5, events: 8 },
    { state: 'SC', city: 'CACADOR', share: 0.4, events: 6 },
    { state: 'SC', city: 'FRAIBURGO', share: 0.5, events: 6 },
    { state: 'SC', city: 'FLORIANOPOLIS', share: 0.25, events: 6 },
    { state: 'SC', city: 'JOINVILLE', share: 0.15, events: 5 },
    { state: 'SC', city: 'BLUMENAU', share: 0.2, events: 5 },
    { state: 'SC', city: 'CHAPECO', share: 0.1, events: 4 },
    { state: 'PR', city: 'CURITIBA', share: 0.04, events: 4 },
    { state: 'PR', city: 'PONTA GROSSA', share: 0.08, events: 3 },
    { state: 'RS', city: 'PORTO ALEGRE', share: 0.03, events: 3 },
    { state: 'RS', city: 'CAXIAS DO SUL', share: 0.06, events: 3 },
    { state: 'SP', city: 'SAO PAULO', share: 0.005, events: 3 },
  ];

const BASE_PRICE: Partial<Record<FuelType, number>> = {
  gasolina_comum: 6.25,
  etanol: 4.35,
  diesel_s10: 6.15,
};

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

async function main() {
  loadEnv();
  const url = process.env.DEMO_DATABASE_URL;
  if (!url) throw new Error('Informe o banco de destino em DEMO_DATABASE_URL.');
  process.env.DATABASE_URL = url;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const db = app.get<Database>(DRIZZLE);
    const [existing] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(like(users.email, `${EMAIL_PREFIX}%${EMAIL_DOMAIN}`));
    if (existing.n > 0) {
      throw new Error(
        `O banco já tem ${existing.n} motorista(s) fictício(s); nada foi gravado.`,
      );
    }
    const summary = await seed(db);
    const scored = await app.get(IqpService).recompute();
    console.log(`${summary} IQP recalculado para ${scored} posto(s).`);
  } finally {
    await app.close();
  }
}

async function seed(db: Database): Promise<string> {
  const rand = random(20261108);
  const now = Date.now();
  /** Mais recente pesa mais: o uso cresce ao longo do ano. */
  const when = () =>
    new Date(
      now -
        Math.floor(365 * (1 - Math.sqrt(rand())) * DAY) -
        Math.floor(rand() * 12) * 3_600_000,
    );

  // Motoristas fictícios.
  const drivers = await db
    .insert(users)
    .values(
      Array.from({ length: 80 }, (_, i) => ({
        name: `Motorista ${i + 1} (fictício)`,
        email: `${EMAIL_PREFIX}${i + 1}${EMAIL_DOMAIN}`,
        createdAt: new Date(now - 400 * DAY),
        updatedAt: new Date(now - 400 * DAY),
      })),
    )
    .returning({ id: users.id });
  const driver = () => drivers[Math.floor(rand() * drivers.length)].id;

  let prices = 0;
  let reviewCount = 0;
  for (const place of PLACES) {
    const list = await db
      .select({ id: stations.id })
      .from(stations)
      .where(
        and(
          eq(stations.active, true),
          eq(stations.state, place.state),
          eq(stations.city, place.city),
        ),
      )
      .orderBy(stations.cnpj);
    if (list.length === 0) continue;
    const chosen = list.filter(() => rand() < place.share);
    for (const station of chosen) {
      // Preço base do posto (alguns centavos acima ou abaixo da média).
      const offset = (rand() - 0.5) * 0.4;
      const rows: (typeof priceReports.$inferInsert)[] = [];
      const events = Math.max(1, Math.round(place.events * (0.5 + rand())));
      for (let e = 0; e < events; e++) {
        const fuel = (
          ['gasolina_comum', 'gasolina_comum', 'etanol', 'diesel_s10'] as const
        )[Math.floor(rand() * 4)];
        rows.push({
          stationId: station.id,
          fuelType: fuel,
          price:
            Math.round(
              ((BASE_PRICE[fuel] ?? 6) + offset + (rand() - 0.5) * 0.1) * 100,
            ) / 100,
          source: 'usuario',
          status: 'valido',
          reporterUserId: driver(),
          reportedAt: when(),
        });
      }
      await db.insert(priceReports).values(rows);
      prices += rows.length;

      // Cerca de um terço dos postos com interação também recebe avaliações.
      if (rand() < 0.35) {
        const count = 1 + Math.floor(rand() * 4);
        const authors = new Set<string>();
        for (let r = 0; r < count; r++) authors.add(driver());
        await db.insert(reviews).values(
          [...authors].map((userId) => ({
            stationId: station.id,
            userId,
            answers: {
              atendimento: 3 + Math.floor(rand() * 3),
              limpeza: 2 + Math.floor(rand() * 4),
              seguranca: 3 + Math.floor(rand() * 3),
              preco_conforme: rand() < 0.85,
            },
            createdAt: when(),
          })),
        );
        reviewCount += authors.size;
      }
    }
  }

  return `Carga fictícia de engajamento: ${drivers.length} motoristas, ${prices} informes de preço e ${reviewCount} avaliações em ${PLACES.length} cidades.`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
