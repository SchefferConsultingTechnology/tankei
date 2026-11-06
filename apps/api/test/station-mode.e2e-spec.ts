import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminStation,
  LoginResponse,
  NearbyStation,
  OfficialDivergence,
  Station,
} from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  priceReports,
  stationFuels,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (AL), CNPJs (5900…) e coordenadas próprios.
const ORIGIN = { lat: -9.66, lng: -35.73 };
const HOUR = 3_600_000;

describe('Modo de exibição do posto (ADR 0028) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let consumer: LoginResponse;
  const station = { a: '', b: '', c: '', d: '' };

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });

  async function login(name: string, subject = `e2e-${randomUUID()}`) {
    const res = await http()
      .post('/v1/auth/login')
      .send({ provider: 'google', idToken: google.sign(subject), name })
      .expect(200);
    return { body: res.body as LoginResponse, subject };
  }

  async function createStation(cnpj: string, lngOffset: number) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj} LTDA`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'MACEIO',
        state: 'AL',
        location: sql`ST_SetSRID(ST_MakePoint(${ORIGIN.lng + lngOffset}, ${ORIGIN.lat}), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'gasolina_comum' });
    return row.id;
  }

  const setMode = (stationId: string, body: Record<string, unknown>) =>
    http()
      .patch(`/v1/admin/stations/${stationId}/mode`)
      .set(auth(admin))
      .send({
        requestedBy: 'Proprietário, por telefone',
        reason: 'Pedido do posto.',
        ...body,
      });

  const report = (who: LoginResponse, stationId: string, price: number) =>
    http()
      .post(`/v1/stations/${stationId}/prices`)
      .set(auth(who))
      .send({ fuelType: 'gasolina_comum', price, confirmed: true });

  async function nearby() {
    const res = await http()
      .get(`/v1/stations/nearby?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`)
      .expect(200);
    return res.body as NearbyStation[];
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

    station.a = await createStation('59000000000101', 0);
    station.b = await createStation('59000000000202', 0.005);
    station.c = await createStation('59000000000303', 0.01);
    station.d = await createStation('59000000000404', 0.015);

    const adminLogin = await login('Admin Modos');
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, adminLogin.body.user.id));
    admin = (await login('Admin Modos', adminLogin.subject)).body;
    owner = (await login('Dono Modos')).body;
    consumer = (await login('Consumidor Modos')).body;
    await addToNetwork(db, owner.user.id, [station.d]);

    for (const id of [station.a, station.b, station.c]) {
      await report(consumer, id, 6.29).expect(201);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('só o administrador muda o modo, e com motivo objetivo quando esconde', async () => {
    await http()
      .patch(`/v1/admin/stations/${station.a}/mode`)
      .set(auth(owner))
      .send({ mode: 'nao_participa', requestedBy: 'Eu', reason: 'Quero sair.' })
      .expect(403);
    const noReason = await setMode(station.b, {
      mode: 'precos_ocultos',
    }).expect(400);
    expect(JSON.stringify(noReason.body)).toContain('motivo objetivo');
  });

  it('não participa: preços continuam, com o modo no app e o registro', async () => {
    const res = await setMode(station.a, { mode: 'nao_participa' }).expect(200);
    expect(res.body as AdminStation).toMatchObject({
      mode: 'nao_participa',
      modeHistory: [
        {
          mode: 'nao_participa',
          requestedBy: 'Proprietário, por telefone',
          decidedBy: 'Admin Modos',
        },
      ],
    });
    const app_ = (await http().get(`/v1/stations/${station.a}`).expect(200))
      .body as Station;
    expect(app_).toMatchObject({ mode: 'nao_participa' });
    expect(app_.prices).toHaveLength(1);
    await setMode(station.a, { mode: 'nao_participa' }).expect(400);
  });

  it('preços ocultos: posto no mapa sem preços, e ninguém informa', async () => {
    await setMode(station.b, {
      mode: 'precos_ocultos',
      hideReason: 'ordem_judicial',
    }).expect(200);
    const found = (await nearby()).find((s) => s.id === station.b);
    expect(found).toMatchObject({ mode: 'precos_ocultos', prices: [] });
    const blocked = await report(owner, station.b, 6.39).expect(422);
    expect((blocked.body as { message: string }).message).toBe(
      'Os preços deste posto não são exibidos no Tankei.',
    );
  });

  it('oculto: o posto sai do app', async () => {
    await setMode(station.c, { mode: 'oculto', hideReason: 'fechado' }).expect(
      200,
    );
    expect((await nearby()).map((s) => s.id)).not.toContain(station.c);
    await http().get(`/v1/stations/${station.c}`).expect(404);
    await http().get(`/v1/stations/${station.c}/showcase`).expect(404);
    await report(consumer, station.c, 6.29).expect(404);
    // O admin continua vendo, para desfazer.
    const back = await setMode(station.c, { mode: 'normal' }).expect(200);
    expect((back.body as AdminStation).modeHistory.map((m) => m.mode)).toEqual([
      'normal',
      'oculto',
    ]);
  });

  it('preço oficial: só posto com rede; consumidores nunca substituem o preço', async () => {
    const noNetwork = await setMode(station.a, {
      mode: 'preco_oficial',
    }).expect(400);
    expect((noNetwork.body as { message: string }).message).toContain(
      'só para posto com rede',
    );
    await setMode(station.d, { mode: 'preco_oficial' }).expect(200);

    // Preço do posto e confirmação de consumidores há mais de 24 h.
    const old = (h: number) => new Date(Date.now() - h * HOUR);
    await db.insert(priceReports).values([
      {
        stationId: station.d,
        fuelType: 'gasolina_comum',
        price: 6.19,
        source: 'posto',
        reporterUserId: owner.user.id,
        reportedAt: old(60),
      },
      ...[admin, consumer].map((who, i) => ({
        stationId: station.d,
        fuelType: 'gasolina_comum' as const,
        price: 6.59,
        source: 'usuario' as const,
        reporterUserId: who.user.id,
        reportedAt: old(40 - i),
      })),
    ]);

    const shown = (await http().get(`/v1/stations/${station.d}`).expect(200))
      .body as Station;
    expect(shown).toMatchObject({ mode: 'preco_oficial' });
    expect(shown.prices[0]).toMatchObject({
      price: 6.19,
      badge: 'atualizado_posto',
      divergence: { price: 6.59 },
    });

    const queue = await http()
      .get('/v1/admin/official-divergences')
      .set(auth(admin))
      .expect(200);
    expect(queue.body as OfficialDivergence[]).toEqual([
      expect.objectContaining({
        station: expect.objectContaining({ id: station.d }) as object,
        stationPrice: 6.19,
        consumerPrice: 6.59,
      }),
    ]);
  });
});
