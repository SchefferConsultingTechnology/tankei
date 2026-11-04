import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthTokens, LoginResponse, Me } from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  sessions,
  stationManagers,
  stations,
  userIdentities,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

const TEST_STATION_CNPJ = '99999998000001';

describe('Autenticação e conta (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  const createdUserIds: string[] = [];
  let app: INestApplication<App>;
  let db: Database;
  let stationId: string;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(subject: string, claims: Record<string, unknown> = {}) {
    const res = await http()
      .post('/v1/auth/login')
      .send({ provider: 'google', idToken: google.sign(subject, claims) })
      .expect(200);
    const body = res.body as LoginResponse;
    createdUserIds.push(body.user.id);
    return body;
  }

  async function cleanup() {
    if (createdUserIds.length > 0) {
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db
        .delete(userIdentities)
        .where(inArray(userIdentities.userId, createdUserIds));
      await db
        .delete(stationManagers)
        .where(inArray(stationManagers.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await db.delete(stations).where(eq(stations.cnpj, TEST_STATION_CNPJ));
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

    await db.delete(stations).where(eq(stations.cnpj, TEST_STATION_CNPJ));
    const [station] = await db
      .insert(stations)
      .values({
        cnpj: TEST_STATION_CNPJ,
        legalName: 'POSTO TESTE GESTOR',
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'TESTE',
        state: 'SC',
      })
      .returning({ id: stations.id });
    stationId = station.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('login', () => {
    it('cria a conta como motorista no primeiro login e reconhece a pessoa depois', async () => {
      const subject = `e2e-${randomUUID()}`;
      const first = await login(subject, {
        email: 'maria@teste.tankei',
        email_verified: true,
        name: 'Maria',
        picture: 'https://lh3.googleusercontent.com/a/maria',
      });

      expect(first.user).toMatchObject({
        name: 'Maria',
        email: 'maria@teste.tankei',
        avatarUrl: 'https://lh3.googleusercontent.com/a/maria',
        role: 'motorista',
        managedStations: [],
      });
      expect(first.expiresIn).toBe(900);

      // Sem foto no provedor, a foto antiga deixa de aparecer.
      const second = await login(subject);
      expect(second.user.id).toBe(first.user.id);
      expect(second.user.avatarUrl).toBeNull();
    });

    it('rejeita token de identidade inválido', async () => {
      await http()
        .post('/v1/auth/login')
        .send({ provider: 'google', idToken: 'falso' })
        .expect(401);
    });

    it('informa quando o provedor não está configurado', async () => {
      const res = await http()
        .post('/v1/auth/login')
        .send({ provider: 'apple', idToken: 'qualquer' })
        .expect(400);

      expect(res.body).toMatchObject({
        message: 'Login com Apple não está disponível.',
      });
    });
  });

  describe('rotas protegidas', () => {
    it('exige login', async () => {
      const res = await http().get('/v1/me').expect(401);
      expect(res.body).toMatchObject({ message: 'Faça login para continuar.' });
    });

    it('rejeita token de acesso adulterado', async () => {
      const { accessToken } = await login(`e2e-${randomUUID()}`);
      const [header, payload] = accessToken.split('.');

      await http()
        .get('/v1/me')
        .set(bearer(`${header}.${payload}.assinatura-falsa`))
        .expect(401);
    });

    it('mantém públicas a busca de postos e o health', async () => {
      await http().get('/v1/health').expect(200);
      await http().get('/v1/stations/nearby?lat=-10&lng=-40').expect(200);
    });
  });

  describe('renovação da sessão', () => {
    it('troca o token de renovação a cada uso', async () => {
      const session = await login(`e2e-${randomUUID()}`);

      const res = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);
      const renewed = res.body as AuthTokens;

      expect(renewed.refreshToken).not.toBe(session.refreshToken);
      await http().get('/v1/me').set(bearer(renewed.accessToken)).expect(200);
    });

    it('revoga a família inteira quando um token antigo é reutilizado', async () => {
      const session = await login(`e2e-${randomUUID()}`);
      const res = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);
      const renewed = res.body as AuthTokens;

      // Alguém reutiliza o token antigo (vazado).
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      // O token novo, da mesma família, também deixou de valer.
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: renewed.refreshToken })
        .expect(401);
    });

    it('encerra a sessão no logout', async () => {
      const session = await login(`e2e-${randomUUID()}`);

      await http()
        .post('/v1/auth/logout')
        .send({ refreshToken: session.refreshToken })
        .expect(204);
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });
  });

  describe('vínculo de gestores (administrador)', () => {
    let admin: LoginResponse;
    let manager: LoginResponse;
    const managersUrl = () => `/v1/admin/stations/${stationId}/managers`;

    beforeAll(async () => {
      const adminSubject = `e2e-${randomUUID()}`;
      const first = await login(adminSubject);
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, first.user.id));
      // O perfil novo vale a partir do próximo token.
      admin = await login(adminSubject);
      manager = await login(`e2e-${randomUUID()}`);
    });

    it('bloqueia quem não é administrador', async () => {
      await http()
        .post(managersUrl())
        .set(bearer(manager.accessToken))
        .send({ userId: manager.user.id })
        .expect(403);
    });

    it('vincula o gestor, que passa a ver o posto na própria conta', async () => {
      await http()
        .post(managersUrl())
        .set(bearer(admin.accessToken))
        .send({ userId: manager.user.id })
        .expect(204);

      const res = await http()
        .get('/v1/me')
        .set(bearer(manager.accessToken))
        .expect(200);
      expect((res.body as Me).managedStations).toEqual([
        { id: stationId, name: 'Posto Teste Gestor' },
      ]);

      await http()
        .post(managersUrl())
        .set(bearer(admin.accessToken))
        .send({ userId: manager.user.id })
        .expect(409);
    });

    it('valida posto e usuário', async () => {
      await http()
        .post(`/v1/admin/stations/${randomUUID()}/managers`)
        .set(bearer(admin.accessToken))
        .send({ userId: manager.user.id })
        .expect(404);
      await http()
        .post('/v1/admin/stations/nao-e-uuid/managers')
        .set(bearer(admin.accessToken))
        .send({ userId: manager.user.id })
        .expect(400);
      await http()
        .post(managersUrl())
        .set(bearer(admin.accessToken))
        .send({ userId: randomUUID() })
        .expect(404);
    });

    it('remove o vínculo', async () => {
      await http()
        .delete(`${managersUrl()}/${manager.user.id}`)
        .set(bearer(admin.accessToken))
        .expect(204);
      await http()
        .delete(`${managersUrl()}/${manager.user.id}`)
        .set(bearer(admin.accessToken))
        .expect(404);
    });
  });

  describe('exclusão da conta (LGPD)', () => {
    it('apaga os dados pessoais, encerra as sessões e mantém a linha anônima', async () => {
      const subject = `e2e-${randomUUID()}`;
      const session = await login(subject, {
        email: 'joao@teste.tankei',
        email_verified: true,
        name: 'João',
        picture: 'https://lh3.googleusercontent.com/a/joao',
      });

      await http()
        .delete('/v1/me')
        .set(bearer(session.accessToken))
        .expect(204);

      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.user.id));
      expect(row).toMatchObject({ name: null, email: null, avatarUrl: null });
      expect(row.deletedAt).not.toBeNull();

      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      // Um novo login com a mesma conta Google cria uma conta nova.
      const again = await login(subject);
      expect(again.user.id).not.toBe(session.user.id);
    });
  });
});
