import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AdhesionDashboard, LoginResponse } from '@tankei/shared';
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
  stationClaimDecisions,
  stationClaims,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Banco compartilhado: UF (RS) e CNPJs (6400…) só deste arquivo; o filtro por
// UF isola os números dos outros testes.
describe('Dashboard de adesão (ADR 0037) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let someone: LoginResponse;

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

  async function station(n: number, city: string) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj: `640000000${String(n).padStart(3, '0')}01`,
        legalName: `POSTO GAUCHO ${n} LTDA`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA DOS ANDRADAS, 1',
        city,
        state: 'RS',
        location: sql`ST_SetSRID(ST_MakePoint(-51.2, -30.03), 4326)`,
      })
      .returning({ id: stations.id });
    return row.id;
  }

  /** Posto aderido em `at`, com o pedido aprovado 10 h depois de feito. */
  async function adhere(stationId: string, at: Date) {
    const owner = await login('Dono RS');
    const [org] = await db
      .insert(organizations)
      .values({ name: `Rede ${stationId}` })
      .returning({ id: organizations.id });
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: owner.user.id,
      role: 'proprietario',
    });
    const [claim] = await db
      .insert(stationClaims)
      .values({
        stationId,
        userId: owner.user.id,
        contactName: 'Dono RS',
        phone: '51999990000',
        position: 'dono',
        origin: 'app_dono',
        createdAt: new Date(at.getTime() - 10 * 3_600_000),
      })
      .returning({ id: stationClaims.id });
    await db.insert(stationClaimDecisions).values({
      claimId: claim.id,
      decision: 'aprovado',
      verificationMethod: 'telefone',
      decidedByUserId: admin.user.id,
      decidedAt: at,
    });
    await db
      .insert(organizationStations)
      .values({ organizationId: org.id, stationId, addedAt: at });
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

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Dashboard', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Dashboard', subject);
    someone = await login('Sem Acesso');

    const a = await station(1, 'PORTO ALEGRE');
    const b = await station(2, 'PORTO ALEGRE');
    const c = await station(3, 'CANOAS');
    await station(4, 'CANOAS'); // sem adesão
    await adhere(a, new Date('2026-03-15T12:00:00-03:00'));
    await adhere(b, new Date('2026-04-10T12:00:00-03:00'));
    await adhere(c, new Date('2026-04-20T12:00:00-03:00'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('só administradores veem', async () => {
    await http()
      .get('/v1/admin/dashboard/adhesion?from=2026-01-01&to=2026-06-30')
      .set(auth(someone))
      .expect(403);
    await http()
      .get('/v1/admin/dashboard/adhesion?from=2026-06-30&to=2026-01-01')
      .set(auth(admin))
      .expect(400);
  });

  it('conta adesões por mês, acumulado, cidades e pedidos', async () => {
    const res = await http()
      .get(
        '/v1/admin/dashboard/adhesion?from=2026-03-01&to=2026-06-30&state=RS',
      )
      .set(auth(admin))
      .expect(200);
    const data = res.body as AdhesionDashboard;
    expect(data.period.granularity).toBe('semana');
    expect(data.kpis).toMatchObject({
      adheredTotal: 3,
      adheredInPeriod: 3,
      stationsInScope: 4,
      approvedInPeriod: 3,
      avgApprovalHours: 10,
    });
    expect(data.series.reduce((sum, p) => sum + p.adhered, 0)).toBe(3);
    expect(data.series[data.series.length - 1].cumulative).toBe(3);
    expect(data.byCity[0]).toMatchObject({
      city: 'Porto Alegre',
      adhered: 2,
      stations: 2,
    });
    expect(data.byOrigin.find((o) => o.origin === 'app_dono')?.claims).toBe(3);
    expect(data.funnel).toMatchObject({ requested: 3, approved: 3 });

    // Por mês (período longo): março 1, abril 2; antes do período conta no acumulado.
    const year = (
      await http()
        .get(
          '/v1/admin/dashboard/adhesion?from=2026-04-01&to=2026-12-31&state=RS',
        )
        .set(auth(admin))
        .expect(200)
    ).body as AdhesionDashboard;
    expect(year.period.granularity).toBe('mes');
    expect(year.series[0]).toMatchObject({
      start: '2026-04-01',
      adhered: 2,
      cumulative: 3,
    });
    expect(year.kpis).toMatchObject({
      adheredInPeriod: 2,
      adheredTotal: 3,
    });
  });
});
