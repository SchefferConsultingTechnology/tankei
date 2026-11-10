import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ChargingAdmin, LoginResponse, Station } from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  organizationMembers,
  organizations,
  organizationStations,
  stationFuels,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Banco compartilhado: CNPJs (6700…) e coordenadas (Belém) só deste arquivo.
describe('Recarga elétrica (ADR 0041) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let managed: string;
  let open: string;

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

  async function station(n: number) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj: `670000000${String(n).padStart(3, '0')}01`,
        legalName: `POSTO PARA ${n} LTDA`,
        brand: 'BANDEIRA BRANCA',
        address: 'AV. NAZARE, 1',
        city: 'BELEM',
        state: 'PA',
        location: sql`ST_SetSRID(ST_MakePoint(${-48.49 - n / 100}, -1.45), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'gasolina_comum' });
    return row.id;
  }

  const fuelsOf = async (stationId: string) =>
    (
      await db
        .select({ fuel: stationFuels.fuelType })
        .from(stationFuels)
        .where(eq(stationFuels.stationId, stationId))
    )
      .map((r) => r.fuel)
      .sort();

  const getStation = async (id: string) =>
    (await http().get(`/v1/stations/${id}`).expect(200)).body as Station;

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

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Recarga', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Recarga', subject);
    owner = await login('Dono PA');

    managed = await station(1);
    open = await station(2);
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Rede Pará' })
      .returning({ id: organizations.id });
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: owner.user.id,
      role: 'proprietario',
    });
    await db
      .insert(organizationStations)
      .values({ organizationId: org.id, stationId: managed });
  });

  afterAll(async () => {
    await app.close();
  });

  it('o posto cadastra os pontos pelo portal e o app mostra', async () => {
    const res = await http()
      .put(`/v1/portal/stations/${managed}/charging`)
      .set(auth(owner))
      .send({
        chargers: [
          {
            current: 'dc',
            connector: 'ccs2',
            powerKw: 60,
            count: 2,
            payments: ['app'],
            operator: 'Zletric',
            fees: 'R$ 1,00/min após 15 min parado',
          },
        ],
      })
      .expect(200);
    expect((res.body as ChargingAdmin).official?.source).toBe('posto');
    expect(await fuelsOf(managed)).toEqual(['gasolina_comum', 'recarga_dc']);

    const s = await getStation(managed);
    expect(s.fuels).toContain('recarga_dc');
    expect(s.charging).toMatchObject({
      source: 'posto',
      chargers: [
        {
          current: 'dc',
          connector: 'ccs2',
          powerKw: 60,
          count: 2,
          access: 'publico',
          operator: 'Zletric',
          timeBased: false,
        },
      ],
    });

    // Preço por kWh, com os limites dos parâmetros (R$ 0,50 a R$ 6,00).
    await http()
      .post(`/v1/stations/${managed}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'recarga_dc', price: 2.9 })
      .expect(201);
    const far = await http()
      .post(`/v1/stations/${managed}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'recarga_dc', price: 29, confirmed: true })
      .expect(422);
    expect((far.body as { code: string }).code).toBe('PRICE_OUT_OF_RANGE');
    const after = await getStation(managed);
    expect(after.prices.find((p) => p.fuelType === 'recarga_dc')?.price).toBe(
      2.9,
    );

    // AC sem ponto cadastrado: não aceita preço nem do posto.
    await http()
      .post(`/v1/stations/${managed}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'recarga_ac', price: 1.5 })
      .expect(422);

    // Lista vazia: o posto deixou de ter recarga.
    await http()
      .put(`/v1/portal/stations/${managed}/charging`)
      .set(auth(owner))
      .send({ chargers: [] })
      .expect(200);
    expect(await fuelsOf(managed)).toEqual(['gasolina_comum']);
    expect((await getStation(managed)).charging).toBeNull();
  });

  it('consumidores sugerem; aparece depois de 2 pessoas e a moderação descarta', async () => {
    const first = await login('Motorista PA 1');
    const second = await login('Motorista PA 2');

    const one = await http()
      .post(`/v1/stations/${open}/charging/suggestions`)
      .set(auth(first))
      .send({ current: 'ac', connector: 'tipo2' })
      .expect(201);
    expect(one.body).toMatchObject({ confirmed: false });
    // A mesma pessoa de novo não conta duas vezes.
    await http()
      .post(`/v1/stations/${open}/charging/suggestions`)
      .set(auth(first))
      .send({ current: 'ac' })
      .expect(201);
    expect((await getStation(open)).charging).toBeNull();

    const two = await http()
      .post(`/v1/stations/${open}/charging/suggestions`)
      .set(auth(second))
      .send({ current: 'ac' })
      .expect(201);
    expect(two.body).toMatchObject({ confirmed: true });
    const s = await getStation(open);
    expect(s.charging).toMatchObject({
      source: 'usuarios',
      chargers: [{ current: 'ac', connector: 'tipo2', powerKw: null }],
    });
    expect(s.fuels).toContain('recarga_ac');

    // Agora o consumidor informa o preço por kWh.
    await http()
      .post(`/v1/stations/${open}/prices`)
      .set(auth(first))
      .send({ fuelType: 'recarga_ac', price: 1.8 })
      .expect(201);

    // A equipe do posto não sugere; posto com cadastro oficial não aceita sugestão.
    await http()
      .post(`/v1/stations/${managed}/charging/suggestions`)
      .set(auth(owner))
      .send({ current: 'dc' })
      .expect(403);

    const dismissed = await http()
      .post(`/v1/admin/stations/${open}/charging/dismiss`)
      .set(auth(admin))
      .send({ current: 'ac', reason: 'Conferido em campo: não tem recarga.' })
      .expect(201);
    expect((dismissed.body as ChargingAdmin).suggestions).toEqual([]);
    expect((await getStation(open)).charging).toBeNull();
    const fuels = await db
      .select()
      .from(stationFuels)
      .where(
        and(
          eq(stationFuels.stationId, open),
          eq(stationFuels.fuelType, 'recarga_ac'),
        ),
      );
    expect(fuels).toHaveLength(0);

    // Cadastro oficial pela equipe: sugestões passam a ser recusadas.
    await http()
      .put(`/v1/admin/stations/${open}/charging`)
      .set(auth(admin))
      .send({
        chargers: [
          { current: 'ac', connector: 'tipo2', powerKw: 22, count: 1 },
        ],
      })
      .expect(200);
    await http()
      .post(`/v1/stations/${open}/charging/suggestions`)
      .set(auth(second))
      .send({ current: 'dc' })
      .expect(409);
  });

  it('valida o cadastro', async () => {
    await http()
      .put(`/v1/portal/stations/${managed}/charging`)
      .set(auth(owner))
      .send({
        chargers: [{ current: 'dc', connector: 'xyz', powerKw: 0, count: 1 }],
      })
      .expect(400);
    const someone = await login('Sem acesso PA');
    await http()
      .put(`/v1/portal/stations/${managed}/charging`)
      .set(auth(someone))
      .send({ chargers: [] })
      .expect(403);
  });
});
