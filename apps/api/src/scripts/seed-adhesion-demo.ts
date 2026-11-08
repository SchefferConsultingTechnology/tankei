import { NestFactory } from '@nestjs/core';
import { CLAIM_POSITIONS, type ClaimOrigin } from '@tankei/shared';
import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  organizationMembers,
  organizations,
  organizationStations,
  priceReports,
  stationClaimDecisions,
  stationClaims,
  stationFuels,
  stations,
  users,
} from '../database/schema';
import { loadEnv } from '../load-env';

/**
 * Adesões FICTÍCIAS para visualizar o dashboard do admin (ADR 0036 e 0037):
 * redes, responsáveis, pedidos de acesso (aprovados, recusados e em análise)
 * e preços informados pelo portal, espalhados pelos últimos 12 meses.
 *
 * Uso (só em banco de teste):
 *   DEMO_DATABASE_URL='postgresql://...' pnpm --filter @tankei/api demo:adhesion
 *
 * Tudo fica identificado: redes com "(fictício)" no nome e contas com e-mail
 * @ficticio.tankei.test. Recusa rodar duas vezes no mesmo banco.
 */

const EMAIL_DOMAIN = '@ficticio.tankei.test';
const DAY = 86_400_000;

/** Cidades de SC com mais peso (região do piloto primeiro). */
const CITIES = [
  'CURITIBANOS',
  'LAGES',
  'CAMPOS NOVOS',
  'VIDEIRA',
  'CACADOR',
  'FRAIBURGO',
  'SAO JOAQUIM',
  'BLUMENAU',
  'JOINVILLE',
  'FLORIANOPOLIS',
  'CHAPECO',
];

const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Karina',
  'Lucas',
  'Marina',
  'Nelson',
  'Olívia',
  'Paulo',
  'Rafaela',
  'Sérgio',
  'Tatiane',
  'Vítor',
];
const LAST_NAMES = [
  'Andrade',
  'Bortolini',
  'Costa',
  'Dalpiaz',
  'Esposito',
  'Farias',
  'Gaio',
  'Hoffmann',
  'Igarashi',
  'Junkes',
  'Klein',
  'Lunardi',
  'Moretto',
  'Nunes',
  'Oliveira',
  'Pereira',
  'Rech',
  'Schmitt',
  'Tonial',
  'Vieira',
];

/** Gerador determinístico (mesma carga em qualquer banco). */
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
      .where(like(users.email, `%${EMAIL_DOMAIN}`));
    if (existing.n > 0) {
      throw new Error(
        `O banco já tem ${existing.n} conta(s) fictícia(s) de adesão; nada foi gravado.`,
      );
    }
    const summary = await seed(db);
    console.log(summary);
  } finally {
    await app.close();
  }
}

async function seed(db: Database): Promise<string> {
  const rand = random(20261107);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(rand() * list.length)];
  const now = Date.now();

  // Postos ativos sem rede nas cidades da lista.
  const candidates = await db
    .select({ id: stations.id, city: stations.city })
    .from(stations)
    .leftJoin(
      organizationStations,
      eq(organizationStations.stationId, stations.id),
    )
    .where(
      and(
        eq(stations.active, true),
        eq(stations.state, 'SC'),
        inArray(stations.city, CITIES),
        isNull(organizationStations.stationId),
      ),
    )
    .orderBy(stations.cnpj);
  if (candidates.length < 20) {
    throw new Error('Poucos postos sem rede em SC para a carga fictícia.');
  }

  // Embaralha de forma determinística, com a região do piloto na frente.
  const weighted = candidates
    .map((c) => ({ ...c, w: rand() * (1 + CITIES.indexOf(c.city) / 3) }))
    .sort((a, b) => a.w - b.w);
  const ADHERED = Math.min(46, weighted.length - 12);
  const adhered = weighted.slice(0, ADHERED);
  const others = weighted.slice(ADHERED, ADHERED + 12);

  let personCount = 0;
  async function person(at: Date) {
    personCount += 1;
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} (fictício)`;
    const [row] = await db
      .insert(users)
      .values({
        name,
        email: `responsavel-${personCount}${EMAIL_DOMAIN}`,
        role: 'motorista',
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: users.id });
    return { id: row.id, name };
  }

  const team = await person(new Date(now - 400 * DAY));
  const origin = (): ClaimOrigin => {
    const r = rand();
    return r < 0.6 ? 'portal' : r < 0.9 ? 'app_dono' : 'app_convite';
  };

  async function claim(
    stationId: string,
    owner: { id: string; name: string },
    createdAt: Date,
    decision: { kind: 'aprovado' | 'recusado'; at: Date } | null,
  ) {
    const [c] = await db
      .insert(stationClaims)
      .values({
        stationId,
        userId: owner.id,
        contactName: owner.name,
        phone: `499${String(90000000 + personCount).slice(0, 8)}`,
        position: pick(CLAIM_POSITIONS),
        origin: origin(),
        createdAt,
      })
      .returning({ id: stationClaims.id });
    if (decision) {
      await db.insert(stationClaimDecisions).values({
        claimId: c.id,
        decision: decision.kind,
        verificationMethod: decision.kind === 'aprovado' ? 'telefone' : null,
        reason:
          decision.kind === 'recusado'
            ? 'Não foi possível confirmar o vínculo (fictício).'
            : null,
        decidedByUserId: team.id,
        decidedAt: decision.at,
      });
    }
  }

  // Adesões: mais recentes pesam mais (crescimento). Algumas redes têm 2 ou 3 postos.
  let networks = 0;
  let pricesInserted = 0;
  for (let i = 0; i < adhered.length;) {
    const size = rand() < 0.15 ? (rand() < 0.5 ? 2 : 3) : 1;
    const group = adhered.slice(i, i + size);
    i += size;
    const daysAgo = Math.floor(365 * (1 - Math.sqrt(rand())));
    const at = new Date(
      now - daysAgo * DAY - Math.floor(rand() * 10) * 3_600_000,
    );
    const owner = await person(new Date(at.getTime() - 3 * DAY));
    networks += 1;
    const [org] = await db
      .insert(organizations)
      .values({
        name: `Rede ${owner.name.split(' ')[1]} ${networks} (fictício)`,
        createdByUserId: owner.id,
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: organizations.id });
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: owner.id,
      role: 'proprietario',
      scope: 'todas',
      createdAt: at,
    });
    for (const [index, station] of group.entries()) {
      const addedAt = new Date(at.getTime() + index * 2 * DAY);
      if (addedAt.getTime() > now) continue;
      // Tempo do pedido à aprovação: de 2 a 72 horas.
      await claim(
        station.id,
        owner,
        new Date(addedAt.getTime() - (2 + Math.floor(rand() * 70)) * 3_600_000),
        { kind: 'aprovado', at: addedAt },
      );
      await db.insert(organizationStations).values({
        organizationId: org.id,
        stationId: station.id,
        addedByUserId: team.id,
        addedAt,
      });
      // Cerca de 60% dos postos aderidos informam preço pelo portal.
      if (rand() < 0.6) {
        await db
          .insert(stationFuels)
          .values({ stationId: station.id, fuelType: 'gasolina_comum' })
          .onConflictDoNothing();
        const reportedAt = new Date(
          now -
            Math.floor(rand() * 6) * DAY -
            Math.floor(rand() * 8) * 3_600_000,
        );
        await db.insert(priceReports).values({
          stationId: station.id,
          fuelType: 'gasolina_comum',
          price: Math.round((6.09 + rand() * 0.4) * 100) / 100,
          source: 'posto',
          reporterUserId: owner.id,
          reportedAt,
        });
        pricesInserted += 1;
      }
    }
  }

  // Pedidos recusados e em análise, em outros postos.
  for (const [index, station] of others.entries()) {
    const owner = await person(new Date(now - 120 * DAY));
    const createdAt = new Date(now - Math.floor(rand() * 150) * DAY);
    const pending = index < 6;
    await claim(
      station.id,
      owner,
      pending ? new Date(now - Math.floor(rand() * 5 + 1) * DAY) : createdAt,
      pending
        ? null
        : { kind: 'recusado', at: new Date(createdAt.getTime() + 2 * DAY) },
    );
  }

  return `Carga fictícia gravada: ${adhered.length} postos aderidos em ${networks} redes, ${others.length} pedidos (6 em análise, ${others.length - 6} recusados), ${pricesInserted} preços pelo portal.`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
