import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CityStations, CityWithStations } from '@tankei/shared';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  municipalities,
  priceReports,
  stationFuels,
  stations,
} from './../src/database/schema';

// Municípios e postos próprios (RR), porque os arquivos de teste rodam em
// paralelo no mesmo banco.
const ALFA = '9900001';
const BETA = '9900002';

describe('Postos por cidade (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  const http = () => request(app.getHttpServer());

  async function station(
    cnpj: string,
    municipalityCode: string,
    lat: number | null,
    active = true,
  ) {
    const [created] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj.slice(-2)} LTDA`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'CIDADE TESTE',
        state: 'RR',
        municipalityCode,
        active,
        location:
          lat === null
            ? null
            : sql`ST_SetSRID(ST_MakePoint(-61, ${lat}), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: created.id, fuelType: 'gasolina_comum' });
    return created.id;
  }

  async function price(stationId: string, value: number) {
    await db.insert(priceReports).values({
      stationId,
      fuelType: 'gasolina_comum',
      price: value,
      source: 'posto',
      status: 'valido',
    });
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DRIZZLE);

    await db.insert(municipalities).values([
      {
        code: ALFA,
        name: 'Cidade Teste Alfa',
        state: 'RR',
        normalizedName: 'CIDADE TESTE ALFA',
      },
      {
        code: BETA,
        name: 'Cidade Teste Beta',
        state: 'RR',
        normalizedName: 'CIDADE TESTE BETA',
      },
    ]);

    const caro = await station('77777777000101', ALFA, 2.0);
    const barato = await station('77777777000102', ALFA, 2.2);
    await station('77777777000103', ALFA, null); // sem preço e sem coordenada
    await station('77777777000104', ALFA, 2.1, false); // inativo
    await station('77777777000105', BETA, 3.0);
    await price(caro, 6.89);
    await price(barato, 6.49);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/stations/cities', () => {
    it('lista as cidades da UF com postos ativos, em ordem alfabética', async () => {
      const res = await http().get('/v1/stations/cities?state=rr').expect(200);

      expect(res.body as CityWithStations[]).toEqual([
        { code: ALFA, name: 'Cidade Teste Alfa', state: 'RR', stations: 3 },
        { code: BETA, name: 'Cidade Teste Beta', state: 'RR', stations: 1 },
      ]);
    });

    it('rejeita UF inválida', async () => {
      const res = await http().get('/v1/stations/cities?state=XX').expect(400);
      expect(res.body).toMatchObject({ message: 'UF inválida.' });
    });
  });

  describe('GET /v1/stations?municipality=', () => {
    it('traz os postos da cidade, os mais baratos primeiro, com o nome oficial', async () => {
      const res = await http()
        .get(`/v1/stations?municipality=${ALFA}&fuel=gasolina_comum`)
        .expect(200);
      const body = res.body as CityStations;

      expect(body.municipality).toEqual({
        code: ALFA,
        name: 'Cidade Teste Alfa',
        state: 'RR',
      });
      expect(body.total).toBe(3);
      expect(body.stations.map((s) => s.name)).toEqual([
        'Posto 02', // R$ 6,49
        'Posto 01', // R$ 6,89
        'Posto 03', // sem preço
      ]);
      expect(body.stations[0].city).toBe('Cidade Teste Alfa');
      // Centro entre os dois postos com coordenada.
      expect(body.center?.lat).toBeCloseTo(2.1, 5);
      expect(body.center?.lng).toBeCloseTo(-61, 5);
    });

    it('sem combustível, ordena pelo nome', async () => {
      const res = await http()
        .get(`/v1/stations?municipality=${ALFA}`)
        .expect(200);

      expect((res.body as CityStations).stations.map((s) => s.name)).toEqual([
        'Posto 01',
        'Posto 02',
        'Posto 03',
      ]);
    });

    it.each([
      ['inexistente', '9999999', 404],
      ['inválido', 'lages', 400],
    ])('responde erro para município %s', async (_, code, status) => {
      await http().get(`/v1/stations?municipality=${code}`).expect(status);
    });
  });
});
