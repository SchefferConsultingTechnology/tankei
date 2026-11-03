import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  CurrentPrice,
  FuelType,
  LoginResponse,
  NearbyStation,
} from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  priceReferences,
  priceReports,
  stationFuels,
  stationManagers,
  stations,
} from './../src/database/schema';
import { ParametersService } from './../src/parameters/parameters.service';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Roda no banco de testes, recriado a cada execução (test/global-setup.ts).
// Região própria: os arquivos de teste rodam em paralelo no mesmo banco.
const ORIGIN = { lat: -20, lng: -45 };

describe('Informes de preço (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let ana: LoginResponse;
  let bia: LoginResponse;
  let caio: LoginResponse;
  let gestor: LoginResponse;
  const station: Record<'s1' | 's2' | 's3', string> = {
    s1: '',
    s2: '',
    s3: '',
  };

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

  function report(
    who: LoginResponse,
    stationId: string,
    body: Record<string, unknown>,
  ) {
    return http()
      .post(`/v1/stations/${stationId}/prices`)
      .set('Authorization', `Bearer ${who.accessToken}`)
      .send(body);
  }

  async function currentPrice(
    stationId: string,
    fuelType: FuelType,
  ): Promise<CurrentPrice | undefined> {
    const res = await http()
      .get(`/v1/stations/nearby?lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`)
      .expect(200);
    return (res.body as NearbyStation[])
      .find((s) => s.id === stationId)
      ?.prices.find((p) => p.fuelType === fuelType);
  }

  async function createStation(cnpj: string, fuels: FuelType[]) {
    const [created] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj}`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'TESTE',
        state: 'SC',
        location: sql`ST_SetSRID(ST_MakePoint(${ORIGIN.lng}, ${ORIGIN.lat}), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values(fuels.map((fuelType) => ({ stationId: created.id, fuelType })));
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

    // Referências de SC da semana de 18/10 (valores reais da ANP).
    await db.insert(priceReferences).values(
      (
        [
          ['gasolina_comum', 6.29],
          ['etanol', 4.4],
        ] as const
      ).map(([fuelType, averagePrice]) => ({
        weekStart: '2026-10-18',
        weekEnd: '2026-10-24',
        state: 'SC',
        fuelType,
        averagePrice,
        minPrice: averagePrice - 0.5,
        maxPrice: averagePrice + 0.5,
        stationsSurveyed: 100,
        sourceUrl: 'teste',
      })),
    );

    station.s1 = await createStation('11111111000101', [
      'gasolina_comum',
      'etanol',
    ]);
    station.s2 = await createStation('22222222000102', ['gasolina_comum']);
    station.s3 = await createStation('33333333000103', ['gasolina_comum']);

    [ana, bia, caio, gestor] = await Promise.all([
      login('Ana'),
      login('Bia'),
      login('Caio'),
      login('Gestor'),
    ]);
    await db
      .insert(stationManagers)
      .values({ userId: gestor.user.id, stationId: station.s2 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige login para informar', async () => {
    await http()
      .post(`/v1/stations/${station.s1}/prices`)
      .send({ fuelType: 'gasolina_comum', price: 6.29 })
      .expect(401);
  });

  describe('motoristas', () => {
    it('um informe aparece como "Informado por motorista"', async () => {
      const res = await report(ana, station.s1, {
        fuelType: 'gasolina_comum',
        price: 6.29,
      }).expect(201);

      expect(res.body).toMatchObject({
        status: 'valido',
        message: 'Preço registrado. Obrigado!',
      });
      expect(await currentPrice(station.s1, 'gasolina_comum')).toMatchObject({
        price: 6.29,
        badge: 'informado_motorista',
        stale: false,
        promotion: null,
      });
    });

    it('outra pessoa com o mesmo valor confirma', async () => {
      await report(bia, station.s1, {
        fuelType: 'gasolina_comum',
        price: 6.29,
      }).expect(201);

      expect(await currentPrice(station.s1, 'gasolina_comum')).toMatchObject({
        badge: 'confirmado_motoristas',
      });
    });

    it('valor muito abaixo da média fica suspeito até ser confirmado (Dia Livre de Impostos)', async () => {
      const res = await report(ana, station.s1, {
        fuelType: 'etanol',
        price: 2.39,
      }).expect(201);
      expect(res.body).toMatchObject({ status: 'suspeito' });
      expect(await currentPrice(station.s1, 'etanol')).toBeUndefined();

      await report(bia, station.s1, {
        fuelType: 'etanol',
        price: 2.39,
      }).expect(201);
      expect(await currentPrice(station.s1, 'etanol')).toMatchObject({
        price: 2.39,
        badge: 'confirmado_motoristas',
      });
    });

    it('pede confirmação para valor muito diferente do preço atual', async () => {
      const res = await report(caio, station.s1, {
        fuelType: 'gasolina_comum',
        price: 0.629,
      }).expect(409);

      expect(res.body).toMatchObject({
        code: 'CONFIRMATION_REQUIRED',
        currentPrice: 6.29,
      });
    });

    it('rejeita valor fora da faixa, mas registra o informe', async () => {
      const res = await report(caio, station.s1, {
        fuelType: 'gasolina_comum',
        price: 0.629,
        confirmed: true,
      }).expect(422);
      expect(res.body).toMatchObject({ code: 'PRICE_OUT_OF_RANGE' });

      const [saved] = await db
        .select()
        .from(priceReports)
        .where(eq(priceReports.reporterUserId, caio.user.id));
      expect(saved).toMatchObject({
        status: 'rejeitado',
        price: 0.629,
        referenceDeviationPct: 90,
      });
      expect(await currentPrice(station.s1, 'gasolina_comum')).toMatchObject({
        price: 6.29,
      });
    });

    it('limita informes repetidos da mesma conta', async () => {
      const res = await report(caio, station.s1, {
        fuelType: 'gasolina_comum',
        price: 6.29,
      }).expect(429);

      expect(res.body).toMatchObject({
        message: expect.stringContaining('há pouco') as unknown,
      });
    });

    it('não aceita combustível que o posto não vende', async () => {
      await report(ana, station.s1, {
        fuelType: 'diesel_s10',
        price: 7.2,
      }).expect(422);
    });

    it('valida o corpo do informe', async () => {
      const res = await report(ana, station.s1, {
        fuelType: 'gasolina_comum',
        price: 6.2999,
      }).expect(400);
      expect(res.body).toMatchObject({
        message: 'Use no máximo 3 casas decimais.',
      });
    });
  });

  describe('gestor do posto', () => {
    it('informa como "Atualizado pelo posto"', async () => {
      await report(gestor, station.s2, {
        fuelType: 'gasolina_comum',
        price: 6.19,
      }).expect(201);

      expect(await currentPrice(station.s2, 'gasolina_comum')).toMatchObject({
        price: 6.19,
        badge: 'atualizado_posto',
      });
    });

    it('um motorista sozinho não substitui o preço do posto; confirmado, substitui', async () => {
      await report(ana, station.s2, {
        fuelType: 'gasolina_comum',
        price: 6.25,
      }).expect(201);
      expect(await currentPrice(station.s2, 'gasolina_comum')).toMatchObject({
        price: 6.19,
        badge: 'atualizado_posto',
      });

      await report(bia, station.s2, {
        fuelType: 'gasolina_comum',
        price: 6.25,
      }).expect(201);
      expect(await currentPrice(station.s2, 'gasolina_comum')).toMatchObject({
        price: 6.25,
        badge: 'confirmado_motoristas',
      });
    });

    it('cria promoção com período, que vale sobre os outros preços', async () => {
      const now = Date.now();
      const res = await report(gestor, station.s2, {
        fuelType: 'gasolina_comum',
        price: 3.459,
        promotion: {
          label: 'Dia Livre de Impostos',
          startsAt: new Date(now - 60_000).toISOString(),
          endsAt: new Date(now + 6 * 3_600_000).toISOString(),
        },
      }).expect(201);

      // Na promoção, o limite normal não se aplica: aceito, não suspeito.
      expect(res.body).toMatchObject({ status: 'valido' });
      expect(await currentPrice(station.s2, 'gasolina_comum')).toMatchObject({
        price: 3.459,
        badge: 'promocao',
        promotion: { label: 'Dia Livre de Impostos' },
      });
    });

    it('limita a duração da promoção pelo parâmetro', async () => {
      const now = Date.now();
      const res = await report(gestor, station.s2, {
        fuelType: 'gasolina_comum',
        price: 5.99,
        promotion: {
          label: 'Semana longa',
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + 8 * 24 * 3_600_000).toISOString(),
        },
      }).expect(400);
      expect(res.body).toMatchObject({
        message: 'A promoção pode durar no máximo 7 dias.',
      });
    });

    it('só o gestor informa promoção', async () => {
      const now = Date.now();
      await report(caio, station.s2, {
        fuelType: 'gasolina_comum',
        price: 3.459,
        promotion: {
          label: 'Falsa',
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + 3_600_000).toISOString(),
        },
      }).expect(403);
    });

    it('pode informar combustível novo, que passa a constar no posto', async () => {
      await report(gestor, station.s2, {
        fuelType: 'etanol',
        price: 4.39,
      }).expect(201);

      const fuels = await db
        .select()
        .from(stationFuels)
        .where(
          and(
            eq(stationFuels.stationId, station.s2),
            eq(stationFuels.fuelType, 'etanol'),
          ),
        );
      expect(fuels).toHaveLength(1);
    });
  });

  it('respeita o limite diário configurado no parâmetro', async () => {
    // Ana já registrou 3 informes. Ajuste do limite sem deploy (ADR 0006).
    await app
      .get(ParametersService)
      .set('price.reports_per_day_max', 3, 'Teste e2e');

    const res = await report(ana, station.s3, {
      fuelType: 'gasolina_comum',
      price: 6.29,
    }).expect(429);
    expect(res.body).toMatchObject({
      message:
        'Você atingiu o limite de informes de hoje. Obrigado pela ajuda!',
    });
  });
});
