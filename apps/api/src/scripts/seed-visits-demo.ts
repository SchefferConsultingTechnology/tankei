import { NestFactory } from '@nestjs/core';
import type {
  VisitAction,
  VisitCloseReason,
  VisitSource,
} from '@tankei/shared';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  organizationStations,
  priceReports,
  reviews,
  stationFeatureChanges,
  stations,
  stationVisits,
  users,
} from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { loadEnv } from '../load-env';

/**
 * Visitas FICTÍCIAS de motoristas aos postos (spec 0003 e ADR 0036), para
 * visualizar a tela Visitas do portal: últimos 120 dias, cidades da região do
 * piloto, com picos de manhã e no fim da tarde. Parte das visitas vira
 * informe de preço ou avaliação (pelos motoristas fictícios). Libera o
 * recurso "visitas" para os postos que estão numa rede do portal.
 *
 * Uso (só em banco de teste):
 *   DEMO_DATABASE_URL='postgresql://...' pnpm --filter @tankei/api demo:visits
 *
 * Recusa rodar duas vezes no mesmo banco. Recalcula o IQP no fim.
 */

const NOTE = 'Carga fictícia (spec 0003)';
const DAY = 86_400_000;
const PERIOD_DAYS = 120;

/** Visitas por posto no período, por cidade. */
const CITIES: Record<string, number> = {
  CURITIBANOS: 320,
  LAGES: 160,
  'CAMPOS NOVOS': 110,
  VIDEIRA: 90,
  FRAIBURGO: 70,
  CACADOR: 70,
};

/** Peso de cada hora do dia (picos às 7–8 h e às 17–19 h). */
const HOUR_WEIGHTS = [
  1, 0.5, 0.3, 0.3, 0.5, 1.5, 4, 7, 7, 5, 4, 5, 6, 5, 4, 4, 5, 7, 8, 7, 5, 3, 2,
  1.5,
];
/** Domingo a sábado: sexta e sábado mais movimentados. */
const WEEKDAY_WEIGHTS = [0.7, 1, 0.95, 1, 1.05, 1.3, 1.25];

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
      .from(stationFeatureChanges)
      .where(eq(stationFeatureChanges.note, NOTE));
    if (existing.n > 0) {
      throw new Error(
        'O banco já tem a carga fictícia de visitas; nada foi gravado.',
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
  const rand = random(20261109);
  const now = Date.now();
  const weighted = <T>(items: readonly T[], weights: readonly number[]) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  // Motoristas fictícios (os da carga de engajamento, ou novos).
  let drivers = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, 'motorista-%@ficticio.tankei.test'))
  ).map((u) => u.id);
  if (drivers.length === 0) {
    drivers = (
      await db
        .insert(users)
        .values(
          Array.from({ length: 40 }, (_, i) => ({
            name: `Motorista ${i + 1} (fictício)`,
            email: `motorista-${i + 1}@ficticio.tankei.test`,
            createdAt: new Date(now - 400 * DAY),
            updatedAt: new Date(now - 400 * DAY),
          })),
        )
        .returning({ id: users.id })
    ).map((u) => u.id);
  }

  const list = await db
    .select({
      id: stations.id,
      city: stations.city,
      managed: organizationStations.stationId,
    })
    .from(stations)
    .leftJoin(
      organizationStations,
      eq(organizationStations.stationId, stations.id),
    )
    .where(
      and(
        eq(stations.active, true),
        eq(stations.state, 'SC'),
        inArray(stations.city, Object.keys(CITIES)),
      ),
    )
    .orderBy(stations.cnpj);

  // Dias: ~25% mais movimento no fim do período (o app cresce).
  const days = Array.from({ length: PERIOD_DAYS }, (_, i) => i);
  const dayWeights = days.map((d) => 1 + (PERIOD_DAYS - d) / PERIOD_DAYS / 4);

  let visitCount = 0;
  let prices = 0;
  let reviewCount = 0;
  for (const station of list) {
    // Postos de rede (clientes) aparecem mais; os demais, menos.
    const base = CITIES[station.city] * (station.managed ? 1 : 0.35);
    const total = Math.round(base * (0.6 + rand() * 0.8));
    const visitors = Array.from(
      { length: Math.max(5, Math.round(total * 0.55)) },
      () => randomUUID(),
    );
    const rows: (typeof stationVisits.$inferInsert)[] = [];
    const contributions: {
      visitId: string;
      at: Date;
      kind: 'preco' | 'avaliacao';
    }[] = [];

    while (rows.length < total) {
      const daysAgo = weighted(days, dayWeights);
      const day = new Date(now - daysAgo * DAY);
      if (rand() > WEEKDAY_WEIGHTS[day.getUTCDay()] / 1.3) continue;
      const hour = weighted(
        HOUR_WEIGHTS.map((_, h) => h),
        HOUR_WEIGHTS,
      );
      // Hora de Brasília (UTC−3).
      const openedAt = new Date(
        Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          hour + 3,
          Math.floor(rand() * 60),
        ),
      );
      if (openedAt.getTime() > now) continue;

      const source: VisitSource = weighted(
        ['mapa', 'lista', 'favoritos', 'link'] as const,
        [0.6, 0.3, 0.07, 0.03],
      );
      const detail = source !== 'mapa' || rand() < 0.4;
      const detailMs = detail
        ? Math.min(
            600_000,
            Math.round(Math.exp(Math.log(30_000) + (rand() - 0.5) * 2.4)),
          )
        : null;
      const actions: VisitAction[] = detail && rand() < 0.15 ? ['route'] : [];
      const closeReason: VisitCloseReason = detail
        ? 'saiu_da_ficha'
        : weighted(
            ['tempo', 'toque_fora', 'outro_posto'] as const,
            [0.6, 0.25, 0.15],
          );
      const id = randomUUID();
      rows.push({
        id,
        stationId: station.id,
        visitorId: visitors[Math.floor(rand() * visitors.length)],
        source,
        drivingMode: source === 'mapa' && rand() < 0.25,
        openedAt,
        detailOpenedAt: detail ? new Date(openedAt.getTime() + 4000) : null,
        detailMs,
        actions,
        closeReason,
        receivedAt: new Date(openedAt.getTime() + 60_000),
      });

      const r = rand();
      const at = new Date(openedAt.getTime() + 20_000);
      if (detail && r < 0.09)
        contributions.push({ visitId: id, at, kind: 'preco' });
      else if (detail && r < 0.12)
        contributions.push({ visitId: id, at, kind: 'avaliacao' });
    }

    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(stationVisits).values(rows.slice(i, i + 500));
    }
    visitCount += rows.length;

    const priceRows = contributions
      .filter((c) => c.kind === 'preco')
      .map((c) => ({
        stationId: station.id,
        fuelType: 'gasolina_comum' as const,
        price: Math.round((6.15 + rand() * 0.25) * 100) / 100,
        source: 'usuario' as const,
        status: 'valido' as const,
        reporterUserId: drivers[Math.floor(rand() * drivers.length)],
        visitId: c.visitId,
        reportedAt: c.at,
      }));
    if (priceRows.length > 0) await db.insert(priceReports).values(priceRows);
    prices += priceRows.length;

    // Uma avaliação por motorista e posto (o intervalo mínimo vale no app).
    const used = new Set<string>();
    const reviewRows = contributions
      .filter((c) => c.kind === 'avaliacao')
      .flatMap((c) => {
        const userId = drivers[Math.floor(rand() * drivers.length)];
        if (used.has(userId)) return [];
        used.add(userId);
        return [
          {
            stationId: station.id,
            userId,
            visitId: c.visitId,
            answers: {
              atendimento: 3 + Math.floor(rand() * 3),
              limpeza: 3 + Math.floor(rand() * 3),
              preco_conforme: rand() < 0.85,
            },
            createdAt: c.at,
          },
        ];
      });
    if (reviewRows.length > 0) await db.insert(reviews).values(reviewRows);
    reviewCount += reviewRows.length;
  }

  // Libera a tela Visitas para os postos de rede da região.
  const managed = [...new Set(list.filter((s) => s.managed).map((s) => s.id))];
  if (managed.length > 0) {
    await db.insert(stationFeatureChanges).values(
      managed.map((stationId) => ({
        stationId,
        feature: 'visitas',
        active: true,
        note: NOTE,
        source: 'equipe',
      })),
    );
  }

  return `Carga fictícia de visitas: ${visitCount} visitas em ${list.length} postos, ${prices} informes e ${reviewCount} avaliações ligados a visitas; recurso liberado para ${managed.length} posto(s) de rede.`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
