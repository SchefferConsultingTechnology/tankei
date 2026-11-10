import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  LoginResponse,
  StationFeatures,
  StationVisits,
  VisitInput,
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
  organizations,
  organizationStations,
  priceReports,
  reviews,
  stations,
  stationVisits,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Banco compartilhado: CNPJs (6500…) e coordenadas (Manaus) só deste arquivo.
describe('Visitas ao posto (spec 0003) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let someone: LoginResponse;
  let stationId: string;
  let otherStationId: string;

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  // 6 dias antes de hoje, contados no fuso de Brasília (como a API).
  const weekAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);

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
        cnpj: `650000000${String(n).padStart(3, '0')}01`,
        legalName: `POSTO AMAZONAS ${n} LTDA`,
        brand: 'BANDEIRA BRANCA',
        address: 'AV. EDUARDO RIBEIRO, 1',
        city: 'MANAUS',
        state: 'AM',
        location: sql`ST_SetSRID(ST_MakePoint(${-60.02 - n / 100}, -3.1), 4326)`,
      })
      .returning({ id: stations.id });
    return row.id;
  }

  function visit(overrides: Partial<VisitInput> = {}): VisitInput {
    const openedAt = new Date(Date.now() - 3_600_000).toISOString();
    return {
      id: randomUUID(),
      stationId,
      visitorId: randomUUID(),
      source: 'mapa',
      drivingMode: false,
      openedAt,
      detailOpenedAt: openedAt,
      detailMs: 40_000,
      actions: [],
      closeReason: 'saiu_da_ficha',
      ...overrides,
    };
  }

  const send = (visits: VisitInput[]) =>
    http().post('/v1/telemetry/visits').send({ visits });

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
    admin = await login('Admin Visitas', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Visitas', subject);
    owner = await login('Dono AM');
    someone = await login('Sem Acesso AM');

    stationId = await station(1);
    otherStationId = await station(2);
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Rede Amazonas' })
      .returning({ id: organizations.id });
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: owner.user.id,
      role: 'proprietario',
    });
    await db
      .insert(organizationStations)
      .values({ organizationId: org.id, stationId });
  });

  afterAll(async () => {
    await app.close();
  });

  it('grava visitas anônimas, sem duplicar e descartando as inválidas', async () => {
    const batch = [
      ...Array.from({ length: 6 }, () => visit()),
      visit({
        detailOpenedAt: null,
        detailMs: null,
        closeReason: 'tempo',
        actions: ['route', 'route'],
      }),
    ];
    const first = await send(batch).expect(200);
    expect(first.body).toEqual({ accepted: 7 });

    // Reenvio (falha de rede): nada novo.
    const again = await send(batch).expect(200);
    expect(again.body).toEqual({ accepted: 0 });

    // Antiga demais, posto inexistente: ignoradas sem erro.
    const ignored = await send([
      visit({ openedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
      visit({ stationId: randomUUID() }),
    ]).expect(200);
    expect(ignored.body).toEqual({ accepted: 0 });

    // Tempo na ficha acima do teto: limitado a 600 s.
    const long = visit({ detailMs: 3_600_000 });
    await send([long]).expect(200);
    const [row] = await db
      .select({
        detailMs: stationVisits.detailMs,
        actions: stationVisits.actions,
      })
      .from(stationVisits)
      .where(eq(stationVisits.id, long.id));
    expect(row.detailMs).toBe(600_000);

    // A tabela é só de inserção.
    await expect(
      db
        .update(stationVisits)
        .set({ detailMs: 1 })
        .where(eq(stationVisits.id, long.id)),
    ).rejects.toThrow();
  });

  it('recusa tempo na ficha sem ficha aberta', async () => {
    await send([visit({ detailOpenedAt: null, detailMs: 1000 })]).expect(400);
  });

  it('só mostra ao posto com o recurso liberado', async () => {
    const path = `/v1/portal/stations/${stationId}/visits?from=${weekAgo}&to=${today}`;
    const locked = await http().get(path).set(auth(owner)).expect(403);
    expect((locked.body as { code?: string }).code).toBe('FEATURE_LOCKED');

    // Quem não é do posto: 403 de acesso, sem o código do recurso.
    const denied = await http().get(path).set(auth(someone)).expect(403);
    expect((denied.body as { code?: string }).code).toBeUndefined();

    const features = await http()
      .put(`/v1/admin/stations/${stationId}/features/visitas`)
      .set(auth(admin))
      .send({ active: true, note: 'Teste e2e' })
      .expect(200);
    expect((features.body as StationFeatures).features).toEqual([
      expect.objectContaining({
        feature: 'visitas',
        active: true,
        note: 'Teste e2e',
      }),
    ]);
    await http()
      .put(`/v1/admin/stations/${stationId}/features/outra`)
      .set(auth(admin))
      .send({ active: true })
      .expect(400);
    await http()
      .put(`/v1/admin/stations/${stationId}/features/visitas`)
      .set(auth(owner))
      .send({ active: true })
      .expect(403);

    const portalFeatures = await http()
      .get(`/v1/portal/stations/${stationId}/features`)
      .set(auth(owner))
      .expect(200);
    expect((portalFeatures.body as StationFeatures).features[0].active).toBe(
      true,
    );
    await http()
      .get(`/v1/portal/stations/${otherStationId}/features`)
      .set(auth(owner))
      .expect(403);
  });

  it('mostra totais e conversões, escondendo contagens abaixo do mínimo', async () => {
    // 5 visitas viram informe de preço (o mínimo é 5); 1 vira avaliação.
    const ids = (
      await db
        .select({ id: stationVisits.id })
        .from(stationVisits)
        .where(eq(stationVisits.stationId, stationId))
        .limit(5)
    ).map((r) => r.id);
    await db.insert(priceReports).values(
      ids.map((visitId) => ({
        stationId,
        fuelType: 'gasolina_comum' as const,
        price: 6.29,
        source: 'usuario' as const,
        reporterUserId: someone.user.id,
        visitId,
      })),
    );
    await db.insert(reviews).values({
      stationId,
      userId: someone.user.id,
      answers: { atendimento: 4 },
      visitId: ids[0],
    });

    const res = await http()
      .get(
        `/v1/portal/stations/${stationId}/visits?from=${weekAgo}&to=${today}`,
      )
      .set(auth(owner))
      .expect(200);
    const body = res.body as StationVisits;
    expect(body.minBucket).toBe(5);
    expect(body.period.granularity).toBe('dia');
    expect(body.kpis).toMatchObject({
      visits: 8,
      visitors: 8,
      detailVisits: 7,
      priceReports: 5,
      reviews: null,
      medianDetailSeconds: 40,
      previous: { visits: null },
    });
    // 8 visitas em 1 dia de 7: o resto é zero, não "abaixo do mínimo".
    expect(body.series).toHaveLength(7);
    expect(body.bySource.find((s) => s.source === 'mapa')?.visits).toBe(8);
    expect(body.bySource.find((s) => s.source === 'lista')?.visits).toBeNull();
    // Uma visita com rota: abaixo do mínimo.
    expect(body.actions.find((a) => a.action === 'route')?.visits).toBeNull();
    expect(body.byWeekday).toHaveLength(7);
    expect(body.byHour).toHaveLength(8);
  });

  it('liga a avaliação feita pelo app à visita', async () => {
    const v = visit();
    const driver = await login('Motorista AM');
    const res = await http()
      .post(`/v1/stations/${stationId}/reviews`)
      .set(auth(driver))
      .send({ ratings: { atendimento: 5 }, visitId: v.id })
      .expect(201);
    const [row] = await db
      .select({ visitId: reviews.visitId })
      .from(reviews)
      .where(eq(reviews.id, (res.body as { id: string }).id));
    expect(row.visitId).toBe(v.id);
  });
});
