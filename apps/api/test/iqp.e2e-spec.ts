import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { LoginResponse, NearbyStation, StationIqp } from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  iqpScores,
  reviews,
  stationManagers,
  stations,
} from './../src/database/schema';
import { IqpService } from './../src/iqp/iqp.service';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Região e cidade próprias: a média da cidade entra no cálculo e os arquivos
// de teste rodam em paralelo no mesmo banco.
const ORIGIN = { lat: -30, lng: -52 };
const CITY = 'CIDADE IQP E2E';

describe('Avaliações e IQP (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let stationA: string;
  let stationB: string;
  let people: LoginResponse[];
  let gestor: LoginResponse;

  const http = () => request(app.getHttpServer());

  async function login(name: string) {
    const res = await http()
      .post('/v1/auth/login')
      .send({
        provider: 'google',
        idToken: google.sign(`e2e-${randomUUID()}`),
        name,
      })
      .expect(200);
    return res.body as LoginResponse;
  }

  function review(who: LoginResponse, stationId: string, body: object) {
    return http()
      .post(`/v1/stations/${stationId}/reviews`)
      .set('Authorization', `Bearer ${who.accessToken}`)
      .send(body);
  }

  async function iqpOf(stationId: string) {
    const res = await http().get(`/v1/stations/${stationId}/iqp`).expect(200);
    return res.body as StationIqp;
  }

  async function createStation(cnpj: string) {
    const [created] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj}`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: CITY,
        state: 'SC',
        location: sql`ST_SetSRID(ST_MakePoint(${ORIGIN.lng}, ${ORIGIN.lat}), 4326)`,
      })
      .returning({ id: stations.id });
    return created.id;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IDENTITY_VERIFIERS)
      .useValue({ google: google.verifier, apple: null })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DRIZZLE);

    stationA = await createStation('44444444000104');
    stationB = await createStation('55555555000105');
    people = await Promise.all(
      ['Ana', 'Bia', 'Caio', 'Davi', 'Eva'].map(login),
    );
    gestor = await login('Gestor');
    await db
      .insert(stationManagers)
      .values({ userId: gestor.user.id, stationId: stationA });
  });

  afterAll(async () => {
    await app.close();
  });

  it('posto sem avaliações: "Dados insuficientes", com a metodologia vigente', async () => {
    expect(await iqpOf(stationA)).toMatchObject({
      score: null,
      confidence: null,
      reviewers: 0,
      methodologyVersion: '1.0.0',
      computedAt: null,
      dimensions: expect.arrayContaining([
        {
          dimension: 'atendimento_agilidade',
          label: 'Atendimento e agilidade',
          score: null,
          weight: 30,
        },
      ]) as unknown,
    });
  });

  it('exige login para avaliar', async () => {
    await http()
      .post(`/v1/stations/${stationA}/reviews`)
      .send({ ratings: { atendimento: 5 } })
      .expect(401);
  });

  it('exige ao menos um item avaliado', async () => {
    const res = await review(people[0], stationA, {
      ratings: { banheiro: null },
    }).expect(400);
    expect(res.body).toMatchObject({ message: 'Avalie ao menos um item.' });
  });

  it('gestor não avalia o próprio posto', async () => {
    const res = await review(gestor, stationA, {
      ratings: { atendimento: 5 },
    }).expect(403);
    expect(res.body).toMatchObject({
      message: 'Gestores não podem avaliar o próprio posto.',
    });
  });

  it('com menos de 3 pessoas, a nota não aparece', async () => {
    // Posto B, na mesma cidade, com notas baixas: forma a média da cidade.
    await review(people[3], stationB, { ratings: { atendimento: 1 } }).expect(
      201,
    );
    await review(people[4], stationB, { ratings: { atendimento: 1 } }).expect(
      201,
    );

    const res = await review(people[0], stationA, {
      ratings: { atendimento: 5, banheiro: null },
    }).expect(201);
    expect(res.body).toMatchObject({
      message: 'Avaliação registrada. Obrigado!',
    });
    await review(people[1], stationA, { ratings: { atendimento: 5 } }).expect(
      201,
    );

    const nearby = await http()
      .get(`/v1/stations/nearby?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`)
      .expect(200);
    const a = (nearby.body as NearbyStation[]).find((s) => s.id === stationA);
    expect(a?.iqp).toEqual({ score: null, confidence: null, reviewers: 2 });
  });

  it('com 3 pessoas, a nota aparece, puxada para a média da cidade', async () => {
    await review(people[2], stationA, { ratings: { atendimento: 5 } }).expect(
      201,
    );

    // Média da cidade em atendimento: (3 × 100 + 2 × 0) / 5 = 60.
    // Posto A: (5 × 60 + 3 × 100) / (5 + 3) = 75.
    const iqp = await iqpOf(stationA);
    expect(iqp).toMatchObject({
      score: 75,
      confidence: 'baixa',
      reviewers: 3,
    });
    expect(iqp.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimension: 'atendimento_agilidade',
          score: 75,
        }),
        expect.objectContaining({ dimension: 'seguranca', score: null }),
      ]),
    );
  });

  it('guarda "não disponível" diferente de "não avaliado"', async () => {
    const [saved] = await db
      .select({ answers: reviews.answers })
      .from(reviews)
      .where(eq(reviews.userId, people[0].user.id));
    expect(saved.answers).toEqual({ atendimento: 5, banheiro: null });
  });

  it('a mesma pessoa só avalia de novo depois do intervalo', async () => {
    const res = await review(people[0], stationA, {
      ratings: { atendimento: 1 },
    }).expect(429);
    expect(res.body).toMatchObject({
      message: expect.stringContaining(
        'Você já avaliou este posto. Poderá avaliar de novo a partir de',
      ) as unknown,
    });
  });

  it('guarda o histórico de cálculos e recalcula todos os postos avaliados', async () => {
    const history = () =>
      db.select().from(iqpScores).where(eq(iqpScores.stationId, stationA));
    // Um cálculo por avaliação do posto A.
    expect(await history()).toHaveLength(3);

    const recalculated = await app.get(IqpService).recompute();
    expect(recalculated).toBeGreaterThanOrEqual(2);
    expect(await history()).toHaveLength(4);
    expect((await iqpOf(stationA)).score).toBe(75);
  });
});
