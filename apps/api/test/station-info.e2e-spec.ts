import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AppConfig,
  LoginResponse,
  OpeningHours,
  Station,
  StationInfo,
} from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import { stationInfoVersions, stations, users } from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

const HOURS: OpeningHours = {
  dias_uteis: {
    mode: 'horario',
    intervals: [{ open: '06:00', close: '22:00' }],
  },
  sabado: {
    mode: 'horario',
    intervals: [
      { open: '07:00', close: '12:00' },
      { open: '13:30', close: '18:00' },
    ],
  },
  domingo: { mode: 'fechado', intervals: [] },
  feriado: { mode: '24h', intervals: [] },
};

// Banco compartilhado: UF (PA), CNPJs (6200…) e coordenadas próprios.
describe('Horário e serviços do posto (ADR 0033) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let owner: LoginResponse;
  let operator: LoginResponse;
  let admin: LoginResponse;
  let stationA = '';
  let stationB = '';

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
        address: 'RODOVIA BR-316, KM 10',
        city: 'BELEM',
        state: 'PA',
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, -1.45), 4326)`,
      })
      .returning({ id: stations.id });
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

    stationA = await createStation('62000000000101', -48.48);
    stationB = await createStation('62000000000202', -48.49);
    owner = await login('Dono Belém');
    operator = await login('Frentista Belém');
    await addToNetwork(db, owner.user.id, [stationA]);
    await addToNetwork(db, operator.user.id, [stationB], 'operador');

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Horário', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Horário', subject);
  });

  afterAll(async () => {
    await app.close();
  });

  it('o posto informa horário e serviços pelo portal; o app recebe', async () => {
    const empty = (
      await http()
        .get(`/v1/portal/stations/${stationA}/info`)
        .set(auth(owner))
        .expect(200)
    ).body as StationInfo;
    expect(empty).toEqual({
      displayName: null,
      officialName: 'Posto 0101',
      hours: null,
      services: [],
      updatedAt: null,
      updatedBy: null,
    });

    const saved = (
      await http()
        .put(`/v1/portal/stations/${stationA}/info`)
        .set(auth(owner))
        .send({ hours: HOURS, services: ['calibrador', 'borracharia'] })
        .expect(200)
    ).body as StationInfo;
    expect(saved).toMatchObject({
      hours: HOURS,
      services: ['calibrador', 'borracharia'],
      updatedBy: 'posto',
    });

    const station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.hours).toEqual(HOURS);
    expect(station.services).toEqual(['calibrador', 'borracharia']);
  });

  it('o posto escolhe o nome no app (ADR 0035)', async () => {
    const named = (
      await http()
        .put(`/v1/portal/stations/${stationA}/info`)
        .set(auth(owner))
        .send({
          displayName: '  Posto do Trevo  ',
          hours: HOURS,
          services: ['calibrador'],
        })
        .expect(200)
    ).body as StationInfo;
    expect(named).toMatchObject({
      displayName: 'Posto do Trevo',
      officialName: 'Posto 0101',
    });
    let station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.name).toBe('Posto do Trevo');

    // Sem o campo, mantém o nome.
    await http()
      .put(`/v1/portal/stations/${stationA}/info`)
      .set(auth(owner))
      .send({ hours: HOURS, services: ['calibrador', 'borracharia'] })
      .expect(200);
    station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.name).toBe('Posto do Trevo');

    await http()
      .put(`/v1/portal/stations/${stationA}/info`)
      .set(auth(owner))
      .send({ displayName: 'X', hours: HOURS, services: [] })
      .expect(400);

    // Nulo volta ao nome oficial.
    await http()
      .put(`/v1/portal/stations/${stationA}/info`)
      .set(auth(owner))
      .send({
        displayName: null,
        hours: HOURS,
        services: ['calibrador', 'borracharia'],
      })
      .expect(200);
    station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.name).toBe('Posto 0101');
  });

  it('valida o horário e o papel no posto', async () => {
    await http()
      .put(`/v1/portal/stations/${stationA}/info`)
      .set(auth(owner))
      .send({
        hours: { ...HOURS, domingo: { mode: 'horario', intervals: [] } },
        services: [],
      })
      .expect(400);
    await http()
      .put(`/v1/portal/stations/${stationA}/info`)
      .set(auth(owner))
      .send({
        hours: {
          ...HOURS,
          domingo: {
            mode: 'horario',
            intervals: [{ open: '25:00', close: '10:00' }],
          },
        },
        services: [],
      })
      .expect(400);
    // Operador vê, mas não altera.
    await http()
      .get(`/v1/portal/stations/${stationB}/info`)
      .set(auth(operator))
      .expect(200);
    await http()
      .put(`/v1/portal/stations/${stationB}/info`)
      .set(auth(operator))
      .send({ hours: null, services: ['calibrador'] })
      .expect(403);
    // Sem vínculo com o posto.
    await http()
      .put(`/v1/portal/stations/${stationA}/info`)
      .set(auth(operator))
      .send({ hours: null, services: [] })
      .expect(403);
  });

  it('a equipe preenche pelo admin; versões não são apagadas', async () => {
    await http()
      .put(`/v1/admin/stations/${stationB}/info`)
      .set(auth(owner))
      .send({ hours: null, services: ['borracharia'] })
      .expect(403);
    const saved = (
      await http()
        .put(`/v1/admin/stations/${stationB}/info`)
        .set(auth(admin))
        .send({ hours: null, services: ['borracharia'] })
        .expect(200)
    ).body as StationInfo;
    expect(saved).toMatchObject({
      services: ['borracharia'],
      updatedBy: 'equipe',
    });
    await http()
      .put(`/v1/admin/stations/${randomUUID()}/info`)
      .set(auth(admin))
      .send({ hours: null, services: [] })
      .expect(404);

    await expect(
      db
        .update(stationInfoVersions)
        .set({ services: [] })
        .where(eq(stationInfoVersions.stationId, stationB)),
    ).rejects.toThrow();
  });

  it('horário gravado antes de uma regra nova continua legível', async () => {
    // Sábado com intervalos sobrepostos: hoje recusado na entrada.
    await db.insert(stationInfoVersions).values({
      stationId: stationA,
      hours: {
        ...HOURS,
        sabado: {
          mode: 'horario',
          intervals: [
            { open: '07:00', close: '20:00' },
            { open: '14:00', close: '18:00' },
          ],
        },
      },
      services: ['calibrador'],
      source: 'posto',
    });
    const station = (await http().get(`/v1/stations/${stationA}`).expect(200))
      .body as Station;
    expect(station.hours?.sabado.intervals).toHaveLength(2);
    await http()
      .get(`/v1/portal/stations/${stationA}/info`)
      .set(auth(owner))
      .expect(200);
  });

  it('a configuração pública traz o tempo do cartão do mapa', async () => {
    const res = await http().get('/v1/config').expect(200);
    expect((res.body as AppConfig).mapCardCloseSeconds).toBe(8);
  });
});
