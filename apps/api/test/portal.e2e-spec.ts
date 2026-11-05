import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  FuelType,
  IqpDimension,
  LoginResponse,
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
  stationManagers,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Banco de testes compartilhado entre arquivos: UF (TO), município, CNPJs e
// coordenadas próprios deste arquivo.
const ORIGIN = { lat: -11, lng: -48 };
const CITY = '1799901';
const OTHER_CITY = '1799902';

describe('Portal do posto (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let gestor: LoginResponse;
  let motorista: LoginResponse;
  let admin: LoginResponse;
  const id: Record<'own' | 'near1' | 'near2' | 'noPrice' | 'far', string> = {
    own: '',
    near1: '',
    near2: '',
    noPrice: '',
    far: '',
  };

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

  async function price(stationId: string, fuelType: FuelType, value: number) {
    await db.insert(priceReports).values({
      stationId,
      fuelType,
      price: value,
      source: 'usuario',
      status: 'valido',
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
    await db
      .insert(stationManagers)
      .values({ userId: gestor.user.id, stationId: id.own });
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
        'Você não gerencia este posto.',
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
