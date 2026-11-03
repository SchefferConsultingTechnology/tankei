import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NearbyStation } from '@tankei/shared';
import { inArray, like, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
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

  const nearby = (query: string) =>
    request(app.getHttpServer()).get(`/stations/nearby?${query}`);
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
    const id = (suffix: string) =>
      inserted.find((s) => s.cnpj === `${CNPJ_PREFIX}${suffix}`)!.id;

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

    expect(names(body)).toEqual(['POSTO TESTE 000001', 'POSTO TESTE 000002']);
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
      'POSTO TESTE 000001',
      'POSTO TESTE 000002',
      'POSTO TESTE 000003',
    ]);
  });

  it('filtra pelo combustível', async () => {
    const res = await nearby(
      `lat=${ORIGIN.lat}&lng=${ORIGIN.lng}&fuel=etanol`,
    ).expect(200);

    expect(names(res.body as NearbyStation[])).toEqual(['POSTO TESTE 000002']);
  });

  it.each([
    ['latitude não numérica', 'lat=abc&lng=-40'],
    ['latitude fora do intervalo', 'lat=-91&lng=-40'],
    ['sem longitude', 'lat=-10'],
    ['raio acima do máximo', 'lat=-10&lng=-40&radius=999999'],
    ['combustível desconhecido', 'lat=-10&lng=-40&fuel=querosene'],
  ])('rejeita %s', async (_, query) => {
    await nearby(query).expect(400);
  });
});
