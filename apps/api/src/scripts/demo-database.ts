import { NestFactory } from '@nestjs/core';
import type { FuelType } from '@tankei/shared';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import { recreateDatabase } from '../database/recreate-database';
import * as schema from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { loadEnv } from '../load-env';

/**
 * Recria o banco de demonstração (`<banco>_demo`): copia postos, combustíveis
 * e referências da ANP do banco de desenvolvimento e acrescenta preços e
 * avaliações FICTÍCIOS, para ver o app funcionando. Nunca grava no banco de
 * desenvolvimento.
 *
 * Uso: pnpm --filter @tankei/api demo:db
 * Depois, suba a API apontando para o banco indicado na saída.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type PriceSpec = {
  fuel: FuelType;
  price: number;
  ageHours: number;
  /** Quem informou: o gestor (posto) ou motoristas (índices de DRIVERS). */
  by: 'posto' | number[];
  promotion?: { label: string; endsInHours: number };
};

type ReviewSpec = Record<string, number | boolean | null>;

/** Cenários por CNPJ dos postos de Curitibanos (ADR 0002). */
const DEMO: Record<string, { prices: PriceSpec[]; reviews: ReviewSpec[] }> = {
  // Centro Automotivo (Stang): preços do posto e IQP com confiança média.
  '52149400000167': {
    prices: [
      { fuel: 'gasolina_comum', price: 6.19, ageHours: 2, by: 'posto' },
      { fuel: 'gasolina_aditivada', price: 6.39, ageHours: 2, by: 'posto' },
      { fuel: 'etanol', price: 4.29, ageHours: 2, by: 'posto' },
      { fuel: 'diesel_s10', price: 7.09, ageHours: 2, by: 'posto' },
    ],
    reviews: [
      {
        atendimento: 5,
        limpeza: 5,
        banheiro: 4,
        calibrador: 5,
        seguranca: 5,
        preco_conforme: true,
      },
      {
        atendimento: 4,
        limpeza: 5,
        banheiro: 4,
        conveniencia: 4,
        preco_conforme: true,
      },
      { atendimento: 5, limpeza: 4, formas_pagamento: 5, seguranca: 4 },
      { atendimento: 5, banheiro: 5, calibrador: 4, preco_conforme: true },
      { atendimento: 4, limpeza: 4, seguranca: 5 },
      { atendimento: 5, limpeza: 5, preco_conforme: true },
    ],
  },
  // Tomasoni: preço confirmado por motoristas e informe isolado.
  '75488700000176': {
    prices: [
      { fuel: 'gasolina_comum', price: 6.24, ageHours: 3, by: [0, 1] },
      { fuel: 'etanol', price: 4.35, ageHours: 1, by: [2] },
    ],
    reviews: [
      {
        atendimento: 3,
        limpeza: 2,
        banheiro: null,
        seguranca: 3,
        preco_conforme: true,
      },
      { atendimento: 4, limpeza: 3, banheiro: null, preco_conforme: false },
      { atendimento: 3, limpeza: 3, calibrador: 2 },
    ],
  },
  // Zuzu: informe recente de motorista e preço do posto desatualizado.
  '52935359000154': {
    prices: [
      { fuel: 'gasolina_comum', price: 6.34, ageHours: 0.5, by: [3] },
      { fuel: 'diesel_s10', price: 6.99, ageHours: 9 * 24, by: 'posto' },
    ],
    reviews: [{ atendimento: 5 }, { atendimento: 4, limpeza: 4 }],
  },
  // R.A.O.T. (Raízen): promoção vigente e gasolina premium.
  '60947714000133': {
    prices: [
      {
        fuel: 'gasolina_comum',
        price: 5.99,
        ageHours: 20,
        by: 'posto',
        promotion: { label: 'Semana do motorista', endsInHours: 48 },
      },
      { fuel: 'gasolina_premium', price: 6.89, ageHours: 20, by: 'posto' },
    ],
    reviews: [],
  },
  // Auto Posto Cidade: preços do posto de ontem.
  '03268180000185': {
    prices: [
      { fuel: 'gasolina_comum', price: 6.39, ageHours: 26, by: 'posto' },
      { fuel: 'etanol', price: 4.49, ageHours: 26, by: 'posto' },
    ],
    reviews: [],
  },
  // Real Paraíso: confirmado por motoristas.
  '85306728000107': {
    prices: [
      { fuel: 'gasolina_comum', price: 6.27, ageHours: 6, by: [1, 4] },
      { fuel: 'diesel_s10', price: 7.15, ageHours: 10, by: 'posto' },
    ],
    reviews: [],
  },
  // Frei (Ipiranga): informe de motorista de dois dias atrás.
  '26205769000130': {
    prices: [{ fuel: 'gasolina_comum', price: 6.45, ageHours: 48, by: [0] }],
    reviews: [],
  },
};

async function main() {
  loadEnv();
  const devUrl = process.env.DATABASE_URL ?? '';
  const demoUrl = await recreateDatabase(devUrl, 'demo');

  const dev = new Client({ connectionString: devUrl });
  await dev.connect();
  const devDb = drizzle({ client: dev, schema, casing: 'snake_case' });
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
    const now = Date.now();

    // Em lotes: o banco de desenvolvimento pode ter os postos do Brasil inteiro.
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

    const drivers = await db
      .insert(schema.users)
      .values(
        ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'].map((name) => ({
          name: `${name} (demonstração)`,
        })),
      )
      .returning({ id: schema.users.id });
    const [manager] = await db
      .insert(schema.users)
      .values({ name: 'Gestor (demonstração)' })
      .returning({ id: schema.users.id });

    const byCnpj = new Map(devStations.map((s) => [s.cnpj, s.id]));
    for (const [cnpj, scenario] of Object.entries(DEMO)) {
      const stationId = byCnpj.get(cnpj);
      if (!stationId) {
        console.warn(`Posto ${cnpj} não está no banco de desenvolvimento.`);
        continue;
      }

      for (const spec of scenario.prices) {
        const reportedAt = new Date(now - spec.ageHours * HOUR);
        const reporters =
          spec.by === 'posto'
            ? [manager.id]
            : spec.by.map((i) => drivers[i].id);
        await db.insert(schema.priceReports).values(
          reporters.map((reporterUserId, i) => ({
            stationId,
            fuelType: spec.fuel,
            price: spec.price,
            source:
              spec.by === 'posto' ? ('posto' as const) : ('usuario' as const),
            status: 'valido' as const,
            reporterUserId,
            // Confirmações chegam com uma hora de intervalo.
            reportedAt: new Date(reportedAt.getTime() - i * HOUR),
            promotionLabel: spec.promotion?.label,
            promotionStartsAt: spec.promotion && reportedAt,
            promotionEndsAt:
              spec.promotion &&
              new Date(now + spec.promotion.endsInHours * HOUR),
          })),
        );
      }

      if (scenario.reviews.length > 0) {
        await db.insert(schema.reviews).values(
          scenario.reviews.map((answers, i) => ({
            stationId,
            userId: drivers[i].id,
            answers,
            createdAt: new Date(now - (i + 1) * 3 * DAY),
          })),
        );
      }
    }

    const scored = await app.get(IqpService).recompute();
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
