import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminAgreement,
  Agreement,
  LoginResponse,
  Station,
  StationAgreement,
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
  stationAgreementVersions,
  stationFuels,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (MA), CNPJs (6300…), coordenadas e nomes próprios.
describe('Convênios (ADR 0034) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  const tag = randomUUID().slice(0, 8);
  let app: INestApplication<App>;
  let db: Database;
  let owner: LoginResponse;
  let operator: LoginResponse;
  let admin: LoginResponse;
  let stationA = '';
  let stationB = '';
  let agreement: Agreement;

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
        tradeName: `Posto ${cnpj.slice(-4)}`,
        brand: 'BANDEIRA BRANCA',
        address: 'AVENIDA DOS HOLANDESES, 1',
        city: 'SAO LUIS',
        state: 'MA',
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, -2.53), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'gasolina_comum' });
    return row.id;
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

    stationA = await createStation('63000000000101', -44.3);
    stationB = await createStation('63000000000202', -44.31);
    owner = await login('Dono São Luís');
    operator = await login('Frentista São Luís');
    await addToNetwork(db, owner.user.id, [stationA]);
    await addToNetwork(db, operator.user.id, [stationB], 'operador');

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Convênios', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Convênios', subject);
  });

  afterAll(async () => {
    await app.close();
  });

  it('o portal cria um convênio sem duplicar o mesmo nome', async () => {
    agreement = (
      await http()
        .post('/v1/portal/agreements')
        .set(auth(owner))
        .send({ name: `Clube Frota ${tag}`, description: 'Cartão da frota.' })
        .expect(201)
    ).body as Agreement;
    // Mesmo nome com maiúsculas e acento: devolve o existente.
    const again = (
      await http()
        .post('/v1/portal/agreements')
        .set(auth(operator))
        .send({ name: `CLUBE FRÓTA ${tag.toUpperCase()}` })
        .expect(201)
    ).body as Agreement;
    expect(again.id).toBe(agreement.id);

    const found = (
      await http()
        .get(`/v1/portal/agreements?q=frota ${tag}`)
        .set(auth(operator))
        .expect(200)
    ).body as Agreement[];
    expect(found.map((a) => a.id)).toContain(agreement.id);
  });

  it('o posto cadastra o desconto; o preço exibido não muda', async () => {
    await http()
      .post(`/v1/stations/${stationA}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'gasolina_comum', price: 6.19, confirmed: true })
      .expect(201);

    const list = (
      await http()
        .put(`/v1/portal/stations/${stationA}/agreements/${agreement.id}`)
        .set(auth(owner))
        .send({
          discounts: [
            { fuelType: 'gasolina_comum', kind: 'reais_litro', value: 0.2 },
          ],
          note: 'Pagando pelo app',
        })
        .expect(200)
    ).body as StationAgreement[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      agreement: { id: agreement.id },
      note: 'Pagando pelo app',
    });

    const station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.prices[0].price).toBe(6.19);
    expect(station.agreements[0].discounts).toEqual([
      { fuelType: 'gasolina_comum', kind: 'reais_litro', value: 0.2 },
    ]);
  });

  it('valida limites, permissões e encerra', async () => {
    // Acima do limite (30%).
    await http()
      .put(`/v1/portal/stations/${stationA}/agreements/${agreement.id}`)
      .set(auth(owner))
      .send({
        discounts: [
          { fuelType: 'gasolina_comum', kind: 'percentual', value: 45 },
        ],
      })
      .expect(400);
    // Operador não cadastra desconto.
    await http()
      .put(`/v1/portal/stations/${stationB}/agreements/${agreement.id}`)
      .set(auth(operator))
      .send({
        discounts: [
          { fuelType: 'gasolina_comum', kind: 'percentual', value: 3 },
        ],
      })
      .expect(403);

    const ended = (
      await http()
        .post(`/v1/portal/stations/${stationA}/agreements/${agreement.id}/end`)
        .set(auth(owner))
        .expect(200)
    ).body as StationAgreement[];
    expect(ended).toEqual([]);
    const station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.agreements).toEqual([]);
    await expect(
      db
        .update(stationAgreementVersions)
        .set({ note: 'x' })
        .where(eq(stationAgreementVersions.stationId, stationA)),
    ).rejects.toThrow();
  });

  it('o admin administra; convênio já usado não é excluído', async () => {
    await http().get('/v1/admin/agreements').set(auth(owner)).expect(403);
    const all = (
      await http().get('/v1/admin/agreements').set(auth(admin)).expect(200)
    ).body as AdminAgreement[];
    expect(all.find((a) => a.id === agreement.id)).toMatchObject({
      everUsed: true,
      stationsUsing: 0,
      createdFrom: 'portal',
    });
    await http()
      .delete(`/v1/admin/agreements/${agreement.id}`)
      .set(auth(admin))
      .expect(409);

    const unused = (
      await http()
        .post('/v1/admin/agreements')
        .set(auth(admin))
        .send({ name: `Sem Uso ${tag}` })
        .expect(201)
    ).body as AdminAgreement;
    await http()
      .post('/v1/admin/agreements')
      .set(auth(admin))
      .send({ name: `sem uso ${tag}` })
      .expect(409);
    await http()
      .delete(`/v1/admin/agreements/${unused.id}`)
      .set(auth(admin))
      .expect(204);

    // Desativado: some da busca e não aceita desconto novo.
    const off = (
      await http()
        .patch(`/v1/admin/agreements/${agreement.id}`)
        .set(auth(admin))
        .send({ active: false, name: `Clube Frota ${tag} (antigo)` })
        .expect(200)
    ).body as AdminAgreement;
    expect(off).toMatchObject({ active: false });
    await http()
      .put(`/v1/portal/stations/${stationA}/agreements/${agreement.id}`)
      .set(auth(owner))
      .send({
        discounts: [
          { fuelType: 'gasolina_comum', kind: 'percentual', value: 3 },
        ],
      })
      .expect(400);
  });
});
