import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminModerationCase,
  CurrentPrice,
  FuelType,
  LoginResponse,
  NearbyStation,
  ParameterKey,
  PriceHistory,
  StationModerationCase,
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
  organizationMembers,
  priceReports,
  stationFuels,
  stations,
  users,
} from './../src/database/schema';
import { ParametersService } from './../src/parameters/parameters.service';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (PI), CNPJs (5500…) e coordenadas próprios.
// O banco de testes começa com peso neutro (global-setup); aqui, os valores
// de produção valem só para esta instância, por um espião no ParametersService.
const ORIGIN = { lat: -5.09, lng: -42.8 };
const PRODUCTION_WEIGHT: Partial<Record<ParameterKey, number>> = {
  'price.trusted_min_account_days': 3,
  'price.trusted_min_accepted_reports': 1,
  'price.away_weight_pct': 50,
};

describe('Confiança dos preços: fase 2 (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let operator: LoginResponse;
  const station = { s1: '', s2: '', s3: '' };
  let overrides: Partial<Record<ParameterKey, number>> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });

  async function login(name: string, subject = `e2e-${randomUUID()}`) {
    const res = await http()
      .post('/v1/auth/login')
      .send({
        provider: 'google',
        idToken: google.sign(subject, {
          email: `${subject}@example.com`,
          email_verified: true,
        }),
        name,
      })
      .expect(200);
    return res.body as LoginResponse;
  }

  async function createStation(cnpj: string, lng: number) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj} LTDA`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'TERESINA',
        state: 'PI',
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${ORIGIN.lat}), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'gasolina_comum' });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'etanol' });
    return row.id;
  }

  function report(
    who: LoginResponse,
    stationId: string,
    body: Record<string, unknown>,
  ) {
    return http()
      .post(`/v1/stations/${stationId}/prices`)
      .set(auth(who))
      .send({ confirmed: true, ...body });
  }

  async function currentPrice(
    stationId: string,
    fuelType: FuelType = 'gasolina_comum',
  ): Promise<CurrentPrice | undefined> {
    const res = await http()
      .get(`/v1/stations/nearby?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`)
      .expect(200);
    return (res.body as NearbyStation[])
      .find((s) => s.id === stationId)
      ?.prices.find((p) => p.fuelType === fuelType);
  }

  async function history(stationId: string) {
    const res = await http()
      .get(`/v1/portal/stations/${stationId}/price-history`)
      .set(auth(owner))
      .expect(200);
    return (res.body as PriceHistory).entries;
  }

  async function consumers(n: number) {
    return Promise.all(
      Array.from({ length: n }, (_, i) => login(`Consumidor ${i}`)),
    );
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

    const parameters = app.get(ParametersService);
    const original = parameters.get.bind(parameters);
    jest
      .spyOn(parameters, 'get')
      .mockImplementation(((key: ParameterKey) =>
        key in overrides
          ? Promise.resolve(overrides[key])
          : original(key)) as typeof parameters.get);

    station.s1 = await createStation('55000000000101', ORIGIN.lng);
    station.s2 = await createStation('55000000000202', ORIGIN.lng + 0.01);
    station.s3 = await createStation('55000000000303', ORIGIN.lng + 0.02);

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Moderação', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Moderação', subject);

    owner = await login('Dona do Posto');
    const networkId = await addToNetwork(db, owner.user.id, [
      station.s1,
      station.s2,
      station.s3,
    ]);
    operator = await login('Operador do Posto');
    await db.insert(organizationMembers).values({
      organizationId: networkId,
      userId: operator.user.id,
      role: 'operador',
      scope: 'todas',
    });
  });

  afterEach(() => {
    overrides = {};
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sinais do informe (ADR 0024)', () => {
    it('guarda se estava no posto (sim, não ou sem localização), nunca a posição', async () => {
      const [near, far, unknown] = await consumers(3);
      await report(near, station.s2, {
        fuelType: 'etanol',
        price: 4.29,
        position: { latitude: ORIGIN.lat, longitude: ORIGIN.lng + 0.0105 },
      }).expect(201);
      await report(far, station.s2, {
        fuelType: 'etanol',
        price: 4.29,
        position: { latitude: ORIGIN.lat + 0.05, longitude: ORIGIN.lng },
      }).expect(201);
      await report(unknown, station.s2, {
        fuelType: 'etanol',
        price: 4.29,
      }).expect(201);

      const rows = await db
        .select()
        .from(priceReports)
        .where(eq(priceReports.stationId, station.s2));
      const of = (who: LoginResponse) =>
        rows.find((r) => r.reporterUserId === who.user.id);
      expect(of(near)).toMatchObject({
        atStation: true,
        confirmationWeight: 1,
      });
      expect(of(far)).toMatchObject({ atStation: false });
      expect(of(unknown)).toMatchObject({ atStation: null });
    });

    it('conta nova ou sem informe aceito não confirma (peso 0)', async () => {
      overrides = { ...PRODUCTION_WEIGHT };
      const [fresh, veteran] = await consumers(2);
      await db
        .update(users)
        .set({ createdAt: sql`now() - interval '10 days'` })
        .where(eq(users.id, veteran.user.id));

      const near = { latitude: ORIGIN.lat, longitude: ORIGIN.lng + 0.02 };
      await report(fresh, station.s3, {
        fuelType: 'etanol',
        price: 4.39,
        position: near,
      }).expect(201);
      // Conta antiga, mas sem informe aceito antes: ainda não confirma.
      await report(veteran, station.s3, {
        fuelType: 'etanol',
        price: 4.39,
        position: near,
      }).expect(201);
      // Com um informe aceito, passa a confirmar.
      await report(veteran, station.s1, {
        fuelType: 'etanol',
        price: 4.39,
        position: near,
      }).expect(201);

      const rows = await db
        .select()
        .from(priceReports)
        .where(eq(priceReports.fuelType, 'etanol'));
      const mine = (who: LoginResponse, stationId: string) =>
        rows.find(
          (r) => r.reporterUserId === who.user.id && r.stationId === stationId,
        );
      expect(mine(fresh, station.s3)).toMatchObject({
        reporterTrusted: false,
        confirmationWeight: 0,
      });
      expect(mine(veteran, station.s3)).toMatchObject({
        reporterTrusted: false,
        confirmationWeight: 0,
      });
      expect(mine(veteran, station.s1)).toMatchObject({
        reporterTrusted: true,
        // s1 fica a ~2 km de onde a pessoa estava: peso de longe (50%).
        atStation: false,
        confirmationWeight: 0.5,
      });
      expect(await currentPrice(station.s3, 'etanol')).toMatchObject({
        badge: 'informado_motorista',
      });
    });
  });

  describe('divergência, contestação e moderação (ADR 0020)', () => {
    let reportIds: string[] = [];

    it('consumidores confirmam outro valor: o posto vê a divergência e pode reconfirmar', async () => {
      await report(owner, station.s1, {
        fuelType: 'gasolina_comum',
        price: 6.19,
      }).expect(201);
      const [a, b] = await consumers(2);
      await report(a, station.s1, { fuelType: 'gasolina_comum', price: 6.49 });
      await report(b, station.s1, { fuelType: 'gasolina_comum', price: 6.49 });

      expect(await currentPrice(station.s1)).toMatchObject({
        price: 6.19,
        badge: 'atualizado_posto',
        divergence: { price: 6.49 },
      });

      await report(owner, station.s1, {
        fuelType: 'gasolina_comum',
        price: 6.19,
      }).expect(201);
      expect(await currentPrice(station.s1)).toMatchObject({
        price: 6.19,
        divergence: null,
        otherValueReported: false,
      });
    });

    it('o posto contesta: os informes saem do preço até a decisão', async () => {
      const [a, b] = await consumers(2);
      await report(a, station.s1, { fuelType: 'gasolina_comum', price: 6.69 });
      await report(b, station.s1, { fuelType: 'gasolina_comum', price: 6.69 });
      expect((await currentPrice(station.s1))?.divergence).toMatchObject({
        price: 6.69,
      });

      reportIds = (await history(station.s1))
        .filter((e) => e.price === 6.69 && e.contestable)
        .map((e) => e.id);
      expect(reportIds).toHaveLength(2);

      // Operador atualiza preço, mas não contesta.
      await http()
        .post(`/v1/portal/stations/${station.s1}/moderation/contests`)
        .set(auth(operator))
        .send({ reportIds, reason: 'Nunca vendemos a esse preço.' })
        .expect(403);

      const res = await http()
        .post(`/v1/portal/stations/${station.s1}/moderation/contests`)
        .set(auth(owner))
        .send({ reportIds, reason: 'Nunca vendemos a esse preço.' })
        .expect(201);
      expect(res.body as StationModerationCase).toMatchObject({
        kind: 'contestacao',
        status: 'em_analise',
        prices: [6.69],
        reports: 2,
      });

      expect(await currentPrice(station.s1)).toMatchObject({
        price: 6.19,
        divergence: null,
      });
      const entries = await history(station.s1);
      expect(entries.find((e) => e.id === reportIds[0])).toMatchObject({
        contestable: false,
        moderation: { kind: 'contestacao', status: 'em_analise' },
      });
    });

    it('recusa contestar informe do posto, repetido ou de outro posto', async () => {
      const own = (await history(station.s1)).find((e) => e.source === 'posto');
      const url = `/v1/portal/stations/${station.s1}/moderation/contests`;
      const body = (ids: string[]) => ({
        reportIds: ids,
        reason: 'Teste de regra',
      });

      const fromStation = await http()
        .post(url)
        .set(auth(owner))
        .send(body([own!.id]))
        .expect(400);
      expect((fromStation.body as { message: string }).message).toBe(
        'Só informes de consumidores podem ser contestados.',
      );
      await http().post(url).set(auth(owner)).send(body(reportIds)).expect(409);
      await http()
        .post(`/v1/portal/stations/${station.s2}/moderation/contests`)
        .set(auth(owner))
        .send(body(reportIds))
        .expect(404);
    });

    it('a equipe Tankei mantém: os informes voltam a contar', async () => {
      const queue = await http()
        .get('/v1/admin/moderation')
        .set(auth(admin))
        .expect(200);
      const found = (queue.body as AdminModerationCase[]).find(
        (c) => c.station.id === station.s1 && c.kind === 'contestacao',
      );
      expect(found).toMatchObject({
        status: 'em_analise',
        openedBy: 'Dona do Posto',
        reason: 'Nunca vendemos a esse preço.',
        stationPrice: { price: 6.19 },
      });
      expect(found?.reports).toHaveLength(2);
      expect(found?.reports[0].reporter).toMatch(/^Consumidor [0-9A-F]{4}$/);

      await http()
        .post(`/v1/admin/moderation/${found!.id}/decide`)
        .set(auth(owner))
        .send({ decision: 'mantido', reason: 'Conferido por telefone.' })
        .expect(403);
      const decided = await http()
        .post(`/v1/admin/moderation/${found!.id}/decide`)
        .set(auth(admin))
        .send({ decision: 'mantido', reason: 'Conferido por telefone.' })
        .expect(200);
      expect(decided.body as AdminModerationCase).toMatchObject({
        status: 'mantido',
        decision: { decision: 'mantido', decidedBy: 'Admin Moderação' },
      });
      await http()
        .post(`/v1/admin/moderation/${found!.id}/decide`)
        .set(auth(admin))
        .send({ decision: 'anulado', reason: 'Mudei de ideia.' })
        .expect(409);

      expect((await currentPrice(station.s1))?.divergence).toMatchObject({
        price: 6.69,
      });
      const cases = await http()
        .get(`/v1/portal/stations/${station.s1}/moderation`)
        .set(auth(owner))
        .expect(200);
      expect(cases.body as StationModerationCase[]).toEqual([
        expect.objectContaining({
          status: 'mantido',
          decisionReason: 'Conferido por telefone.',
        }),
      ]);
    });

    it('anulado: os informes deixam de contar de vez', async () => {
      const [a, b] = await consumers(2);
      await report(a, station.s2, { fuelType: 'gasolina_comum', price: 5.99 });
      await report(b, station.s2, { fuelType: 'gasolina_comum', price: 5.99 });
      const ids = (await history(station.s2))
        .filter((e) => e.price === 5.99)
        .map((e) => e.id);
      const res = await http()
        .post(`/v1/portal/stations/${station.s2}/moderation/contests`)
        .set(auth(owner))
        .send({ reportIds: ids, reason: 'Concorrente combinando valor.' })
        .expect(201);
      await http()
        .post(
          `/v1/admin/moderation/${(res.body as StationModerationCase).id}/decide`,
        )
        .set(auth(admin))
        .send({ decision: 'anulado', reason: 'Contas criadas juntas.' })
        .expect(200);
      expect(await currentPrice(station.s2)).toBeUndefined();
    });
  });

  describe('rajada (ADR 0020)', () => {
    it('informes iguais e destoantes sem localização vão para a fila', async () => {
      await report(owner, station.s3, {
        fuelType: 'gasolina_comum',
        price: 6.19,
      }).expect(201);
      const crowd = await consumers(3);
      for (const who of crowd) {
        await report(who, station.s3, {
          fuelType: 'gasolina_comum',
          price: 7.99,
        }).expect(201);
      }

      expect(await currentPrice(station.s3)).toMatchObject({
        price: 6.19,
        divergence: null,
        otherValueReported: false,
      });
      const queue = await http()
        .get('/v1/admin/moderation')
        .set(auth(admin))
        .expect(200);
      const burst = (queue.body as AdminModerationCase[]).find(
        (c) => c.station.id === station.s3 && c.kind === 'rajada',
      );
      expect(burst).toMatchObject({ openedBy: null, status: 'em_analise' });
      expect(burst?.reports).toHaveLength(3);
      expect(burst?.reason).toContain('3 informes de R$');
    });
  });
});
