import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FUEL_TYPES, type NearbyStation } from '@tankei/shared';
import { inArray, like, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { DRIZZLE, type Database } from './../src/database/database.module';
import { stationFuels, stations } from './../src/database/schema';

// Postos de teste num ponto longe de Curitibanos, com CNPJs reservados para testes.
const ORIGIN = { lat: -10, lng: -40 };
const CNPJ_PREFIX = '99999999';

function station(suffix: string, lat: number | null, active = true) {
  return {
    cnpj: `${CNPJ_PREFIX}${suffix}`,
    legalName: `POSTO TESTE ${suffix}`,
    brand: 'BANDEIRA BRANCA',
    address: 'RUA TESTE, 1',
    city: 'TESTE',
    state: 'BA',
    active,
    location:
      lat === null
        ? null
        : sql`ST_SetSRID(ST_MakePoint(${ORIGIN.lng}, ${lat}), 4326)`,
  };
}

describe('StationsController (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  /** Id de cada posto de teste, pelo sufixo do CNPJ. */
  let stationIds: Record<string, string>;

  const nearby = (query: string) =>
    request(app.getHttpServer()).get(`/v1/stations/nearby?${query}`);
  const names = (body: NearbyStation[]) => body.map((s) => s.name);

  async function cleanup() {
    const test = like(stations.cnpj, `${CNPJ_PREFIX}%`);
    const ids = db.select({ id: stations.id }).from(stations).where(test);
    await db.delete(stationFuels).where(inArray(stationFuels.stationId, ids));
    await db.delete(stations).where(test);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DRIZZLE);

    await cleanup();
    const inserted = await db
      .insert(stations)
      .values([
        station('000001', ORIGIN.lat), // na origem
        station('000002', ORIGIN.lat - 0.009), // ~1 km
        station('000003', ORIGIN.lat - 0.09), // ~10 km
        station('000004', ORIGIN.lat, false), // inativo
        station('000005', null), // sem coordenada
      ])
      .returning({ id: stations.id, cnpj: stations.cnpj });
    stationIds = Object.fromEntries(
      inserted.map((s) => [s.cnpj.slice(CNPJ_PREFIX.length), s.id]),
    );
    const id = (suffix: string) => stationIds[suffix];

    await db.insert(stationFuels).values([
      { stationId: id('000001'), fuelType: 'gasolina_comum' },
      { stationId: id('000002'), fuelType: 'gasolina_comum' },
      { stationId: id('000002'), fuelType: 'etanol' },
    ]);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('retorna os postos ativos com coordenada dentro do raio padrão, do mais próximo ao mais distante', async () => {
    const res = await nearby(`lat=${ORIGIN.lat}&lng=${ORIGIN.lng}`).expect(200);
    const body = res.body as NearbyStation[];

    expect(names(body)).toEqual(['Posto Teste 000001', 'Posto Teste 000002']);
    expect(body[0]).toMatchObject({
      distanceMeters: 0,
      location: ORIGIN,
      fuels: ['gasolina_comum'],
    });
    expect(body[1].distanceMeters).toBeGreaterThan(950);
    expect(body[1].distanceMeters).toBeLessThan(1050);
    expect(body[1].fuels).toEqual(['gasolina_comum', 'etanol']);
  });

  it('amplia a busca com o raio', async () => {
    const res = await nearby(
      `lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&radius=20000`,
    ).expect(200);

    expect(names(res.body as NearbyStation[])).toEqual([
      'Posto Teste 000001',
      'Posto Teste 000002',
      'Posto Teste 000003',
    ]);
  });

  it('filtra pelo combustível', async () => {
    const res = await nearby(
      `lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&fuel=etanol`,
    ).expect(200);

    expect(names(res.body as NearbyStation[])).toEqual(['Posto Teste 000002']);
  });

  it.each([
    ['latitude não numérica', 'lat=abc&lng=-40', 'lat', 'Latitude inválida.'],
    ['latitude vazia', 'lat=&lng=-40', 'lat', 'Latitude inválida.'],
    [
      'latitude fora do intervalo',
      'lat=-91&lng=-40',
      'lat',
      'Latitude inválida.',
    ],
    ['sem longitude', 'lat=-10', 'lng', 'Longitude inválida.'],
    [
      'raio acima do máximo',
      'lat=-10&lng=-40&radius=999999',
      'radius',
      'O raio deve estar entre 1 e 50000 metros.',
    ],
    [
      'combustível desconhecido',
      'lat=-10&lng=-40&fuel=querosene',
      'fuel',
      `Combustível inválido. Use: ${FUEL_TYPES.join(', ')}.`,
    ],
  ])('rejeita %s', async (_, query, path, message) => {
    const res = await nearby(query).expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message,
      issues: [{ path, message }],
    });
  });

  it('documenta o endpoint no OpenAPI', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/docs-json')
      .expect(200);
    const doc = res.body as {
      paths: Record<string, { get: { parameters: { name: string }[] } }>;
    };

    const params = doc.paths['/v1/stations/nearby'].get.parameters;
    expect(params.map((p) => p.name)).toEqual(
      expect.arrayContaining(['lat', 'lng', 'radius', 'fuel']),
    );
  });

  describe('GET /v1/stations/:id', () => {
    const get = (id: string) =>
      request(app.getHttpServer()).get(`/v1/stations/${id}`);

    it('retorna o posto com combustíveis, preços e IQP', async () => {
      const res = await get(stationIds['000002']).expect(200);

      expect(res.body).toEqual({
        id: stationIds['000002'],
        name: 'Posto Teste 000002',
        brand: 'Bandeira Branca',
        address: 'RUA TESTE, 1',
        district: null,
        city: 'Teste',
        state: 'BA',
        location: { lat: ORIGIN.lat - 0.009, lng: ORIGIN.lng },
        fuels: ['gasolina_comum', 'etanol'],
        prices: [],
        iqp: { score: null, confidence: null, reviewers: 0 },
        mode: 'normal',
        hours: null,
        services: [],
        managed: false,
        activePromotions: [],
      });
    });

    it('retorna posto sem coordenada, com a localização nula', async () => {
      const res = await get(stationIds['000005']).expect(200);
      expect(res.body).toMatchObject({ location: null, fuels: [] });
    });

    it.each([
      ['inativo', () => stationIds['000004'], 404],
      ['inexistente', () => '00000000-0000-4000-8000-000000000000', 404],
      ['com id inválido', () => 'nao-e-uuid', 400],
    ])('responde erro para posto %s', async (_, id, status) => {
      await get(id()).expect(status);
    });
  });
});
