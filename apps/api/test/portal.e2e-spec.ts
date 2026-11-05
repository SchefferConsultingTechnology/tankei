import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  FuelType,
  IqpDimension,
  CityComparison,
  LoginResponse,
  PriceHistory,
  StationCompetition,
  StationReputation,
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
  iqpScores,
  municipalities,
  priceReferences,
  priceReports,
  stationFuels,
  organizationStations,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco de testes compartilhado entre arquivos: UF (TO), município, CNPJs e
// coordenadas próprios deste arquivo.
const ORIGIN = { lat: -11, lng: -48 };
const CITY = '1799901';
const OTHER_CITY = '1799902';
const HISTORY_CITY = '1799903';
const DAY = 86_400_000;

describe('Portal do posto (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let gestor: LoginResponse;
  let motorista: LoginResponse;
  let admin: LoginResponse;
  const id: Record<
    'own' | 'near1' | 'near2' | 'noPrice' | 'far' | 'history',
    string
  > = {
    own: '',
    near1: '',
    near2: '',
    noPrice: '',
    far: '',
    history: '',
  };
  let consumidorB: LoginResponse;

  const http = () => request(app.getHttpServer());

  async function login(name: string, subject = `e2e-${randomUUID()}`) {
    const res = await http()
      .post('/v1/auth/login')
      .send({
        provider: 'google',
        idToken: google.sign(subject),
        name,
      })
      .expect(200);
    return res.body as LoginResponse;
  }

  async function createStation(
    cnpj: string,
    offsetLat: number,
    municipalityCode: string,
    fuels: FuelType[],
  ) {
    const [created] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj}`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'PORTAL',
        state: 'TO',
        municipalityCode,
        location: sql`ST_SetSRID(ST_MakePoint(${ORIGIN.lng}, ${ORIGIN.lat + offsetLat}), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values(fuels.map((fuelType) => ({ stationId: created.id, fuelType })));
    return created.id;
  }

  async function price(
    stationId: string,
    fuelType: FuelType,
    value: number,
    extra: Partial<typeof priceReports.$inferInsert> = {},
  ) {
    await db.insert(priceReports).values({
      stationId,
      fuelType,
      price: value,
      source: 'usuario',
      status: 'valido',
      ...extra,
    });
  }

  async function score(
    stationId: string,
    total: number | null,
    dims: Partial<Record<IqpDimension, number>>,
  ) {
    const all: IqpDimension[] = [
      'atendimento_agilidade',
      'limpeza_infraestrutura',
      'transparencia',
      'servicos_conveniencia',
      'seguranca',
    ];
    await db.insert(iqpScores).values({
      stationId,
      methodologyVersion: '1.0.0',
      score: total,
      confidence: total == null ? null : 'media',
      reviewers: 5,
      effectiveReviews: 5,
      dimensions: Object.fromEntries(
        all.map((d) => [d, { score: dims[d] ?? null, weight: 20 }]),
      ) as Record<IqpDimension, { score: number | null; weight: number }>,
    });
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

    await db.insert(municipalities).values([
      {
        code: CITY,
        name: 'Cidade Portal',
        normalizedName: 'cidade portal',
        state: 'TO',
      },
      {
        code: OTHER_CITY,
        name: 'Outra Cidade Portal',
        normalizedName: 'outra cidade portal',
        state: 'TO',
      },
      {
        code: HISTORY_CITY,
        name: 'Cidade Historico',
        normalizedName: 'cidade historico',
        state: 'TO',
      },
    ]);
    await db.insert(priceReferences).values({
      weekStart: '2026-10-18',
      weekEnd: '2026-10-24',
      state: 'TO',
      fuelType: 'gasolina_comum',
      averagePrice: 6.5,
      minPrice: 6,
      maxPrice: 7,
      stationsSurveyed: 50,
      sourceUrl: 'teste',
    });

    const fuels: FuelType[] = ['gasolina_comum', 'etanol'];
    id.own = await createStation('77000000000101', 0, CITY, fuels);
    id.near1 = await createStation('77000000000102', 0.01, CITY, fuels);
    id.near2 = await createStation('77000000000103', -0.01, CITY, fuels);
    id.noPrice = await createStation('77000000000104', 0.02, CITY, fuels);
    // A cerca de 11 km: fora do raio de 5 km, mas na mesma cidade.
    id.far = await createStation('77000000000105', 0.1, CITY, fuels);

    await price(id.own, 'gasolina_comum', 6.3);
    await price(id.near1, 'gasolina_comum', 6.2);
    await price(id.near2, 'gasolina_comum', 6.4);
    await price(id.near2, 'etanol', 4.5);
    await price(id.far, 'gasolina_comum', 5.9);

    // Outra cidade, a cerca de 110 km: fora do raio.
    const other1 = await createStation('77000000000106', 1, OTHER_CITY, fuels);
    const other2 = await createStation(
      '77000000000107',
      1.01,
      OTHER_CITY,
      fuels,
    );
    const other3 = await createStation(
      '77000000000108',
      1.02,
      OTHER_CITY,
      fuels,
    );
    await price(other1, 'gasolina_comum', 5.8);
    await price(other2, 'gasolina_comum', 6.0);
    await price(other3, 'gasolina_comum', 6.4);

    await score(id.own, 80, { atendimento_agilidade: 90, seguranca: 70 });
    await score(id.near1, 60, { atendimento_agilidade: 50, seguranca: 90 });
    await score(id.near2, null, {}); // "Dados insuficientes": fora da média.

    gestor = await login('Gestor Portal');
    motorista = await login('Motorista Portal');
    const adminSubject = `e2e-${randomUUID()}`;
    admin = await login('Admin Portal', adminSubject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    // Token emitido antes da mudança de perfil: entra de novo para carregar o admin.
    admin = await login('Admin Portal', adminSubject);
    const gestorNetwork = await addToNetwork(db, gestor.user.id, [id.own]);

    // Histórico: posto próprio, longe dos demais e em outra cidade.
    consumidorB = await login('Consumidor B Portal');
    id.history = await createStation('77000000000109', -2, HISTORY_CITY, fuels);
    await db
      .insert(organizationStations)
      .values({ organizationId: gestorNetwork, stationId: id.history });
    const ago = (ms: number) => new Date(Date.now() - ms);
    await price(id.history, 'gasolina_comum', 6.1, {
      reporterUserId: motorista.user.id,
      reportedAt: ago(3 * DAY),
    });
    await price(id.history, 'etanol', 4.3, {
      reporterUserId: motorista.user.id,
      reportedAt: ago(2 * DAY),
    });
    await price(id.history, 'gasolina_comum', 6.15, {
      reporterUserId: consumidorB.user.id,
      reportedAt: ago(DAY),
    });
    await price(id.history, 'gasolina_comum', 6.2, {
      source: 'posto',
      reporterUserId: gestor.user.id,
      reportedAt: ago(60 * 60 * 1000),
    });
    await price(id.history, 'gasolina_comum', 6.0, {
      reporterUserId: motorista.user.id,
      reportedAt: ago(40 * DAY),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('acesso', () => {
    it('exige login', async () => {
      await http().get(`/v1/portal/stations/${id.own}/competition`).expect(401);
    });

    it('recusa quem não gerencia o posto', async () => {
      const res = await http()
        .get(`/v1/portal/stations/${id.own}/competition`)
        .set('Authorization', `Bearer ${motorista.accessToken}`)
        .expect(403);
      expect((res.body as { message: string }).message).toBe(
        'Você não faz parte da equipe deste posto.',
      );
    });

    it('gestor de outro posto não vê este', async () => {
      await http()
        .get(`/v1/portal/stations/${id.near1}/reputation`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(403);
    });
  });

  describe('concorrência', () => {
    let body: StationCompetition;

    beforeAll(async () => {
      const res = await http()
        .get(`/v1/portal/stations/${id.own}/competition`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      body = res.body as StationCompetition;
    });

    it('usa o raio do parâmetro e os combustíveis do posto', () => {
      expect(body.radiusMeters).toBe(5000);
      expect(body.fuels.map((f) => f.fuelType)).toEqual([
        'gasolina_comum',
        'etanol',
      ]);
    });

    it('mostra os postos no raio com preço, do mais barato, sem o próprio', () => {
      const gasolina = body.fuels[0];
      expect(gasolina.price?.price).toBe(6.3);
      expect(gasolina.nearby.map((c) => [c.id, c.price.price])).toEqual([
        [id.near1, 6.2],
        [id.near2, 6.4],
      ]);
      expect(gasolina.nearby[0].distanceMeters).toBeGreaterThan(1000);
    });

    it('posição na cidade conta todos os postos da cidade com preço', () => {
      // 5,90 (longe) e 6,20 são mais baratos: 3º de 4.
      expect(body.fuels[0].cityRank).toEqual({ position: 3, total: 4 });
    });

    it('traz a média da ANP no estado, quando houver', () => {
      expect(body.fuels[0].stateReference).toEqual({
        weekStart: '2026-10-18',
        averagePrice: 6.5,
        referenceFuel: 'gasolina_comum',
      });
      expect(body.fuels[1].stateReference).toBeNull();
    });

    it('sem preço do posto, não há posição', () => {
      const etanol = body.fuels[1];
      expect(etanol.price).toBeNull();
      expect(etanol.cityRank).toBeNull();
      expect(etanol.nearby.map((c) => c.id)).toEqual([id.near2]);
    });

    it('administrador também acessa', async () => {
      await http()
        .get(`/v1/portal/stations/${id.own}/competition`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
    });
  });

  describe('raio da concorrência', () => {
    it('o raio escolhido filtra os postos e fica limitado ao parâmetro', async () => {
      const near = await http()
        .get(`/v1/portal/stations/${id.own}/competition?radius=1000`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      const small = near.body as StationCompetition;
      expect(small.radiusMeters).toBe(1000);
      expect(small.maxRadiusMeters).toBe(5000);
      // Os vizinhos ficam a cerca de 1,1 km: fora de 1 km.
      expect(small.fuels[0].nearby).toEqual([]);

      const big = await http()
        .get(`/v1/portal/stations/${id.own}/competition?radius=900000`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      expect((big.body as StationCompetition).radiusMeters).toBe(5000);
    });
  });

  describe('histórico de preços', () => {
    it('lista posto e consumidores, com apelido estável e o informe em vigor', async () => {
      const res = await http()
        .get(`/v1/portal/stations/${id.history}/price-history`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      const body = res.body as PriceHistory;
      expect(body.days).toBe(30);
      // O informe de 40 dias atrás fica fora do período padrão.
      expect(body.entries.map((e) => e.price)).toEqual([6.2, 6.15, 4.3, 6.1]);

      const [posto, b, aEtanol, aGasolina] = body.entries;
      expect(posto).toMatchObject({
        source: 'posto',
        reporter: 'Posto (Gestor)',
        current: true,
      });
      expect(b.current).toBe(false);
      expect(aEtanol.current).toBe(true); // único preço de etanol
      expect(aEtanol.reporter).toMatch(/^Consumidor [0-9A-F]{4}$/);
      expect(aGasolina.reporter).toBe(aEtanol.reporter);
      expect(b.reporter).not.toBe(aEtanol.reporter);
      expect(JSON.stringify(body)).not.toContain('Motorista Portal');
    });

    it('filtra por combustível e limita o período', async () => {
      const res = await http()
        .get(
          `/v1/portal/stations/${id.history}/price-history?fuel=etanol&days=90`,
        )
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      expect((res.body as PriceHistory).entries.map((e) => e.price)).toEqual([
        4.3,
      ]);

      await http()
        .get(`/v1/portal/stations/${id.history}/price-history?days=91`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(400);
    });

    it('só para quem gerencia o posto', async () => {
      await http()
        .get(`/v1/portal/stations/${id.history}/price-history`)
        .set('Authorization', `Bearer ${motorista.accessToken}`)
        .expect(403);
    });
  });

  describe('outra cidade', () => {
    it('menor preço, média, mediana e a posição que o posto teria lá', async () => {
      const res = await http()
        .get(
          `/v1/portal/stations/${id.own}/city-comparison?municipality=${OTHER_CITY}`,
        )
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      const body = res.body as CityComparison;
      expect(body.municipality.name).toBe('Outra Cidade Portal');
      expect(body.fuels[0]).toEqual({
        fuelType: 'gasolina_comum',
        ownPrice: 6.3,
        stations: 3,
        min: 5.8,
        average: 6.067,
        median: 6.0,
        positionThere: { position: 3, total: 4 },
      });
      expect(body.fuels[1]).toMatchObject({
        fuelType: 'etanol',
        ownPrice: null,
        stations: 0,
        median: null,
        positionThere: null,
      });
    });

    it('município inexistente', async () => {
      await http()
        .get(
          `/v1/portal/stations/${id.own}/city-comparison?municipality=1799999`,
        )
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(404);
    });
  });

  describe('reputação', () => {
    it('compara o IQP do posto com a média da cidade', async () => {
      const res = await http()
        .get(`/v1/portal/stations/${id.own}/reputation`)
        .set('Authorization', `Bearer ${gestor.accessToken}`)
        .expect(200);
      const body = res.body as StationReputation;

      expect(body.station.score).toBe(80);
      // Só postos com nota entram: (80 + 60) / 2.
      expect(body.city.stations).toBe(2);
      expect(body.city.score).toBe(70);
      const city = Object.fromEntries(
        body.city.dimensions.map((d) => [d.dimension, d.score]),
      );
      expect(city.atendimento_agilidade).toBe(70);
      expect(city.seguranca).toBe(80);
      expect(city.transparencia).toBeNull();
    });
  });
});
