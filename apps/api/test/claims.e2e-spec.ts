import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminClaim,
  Claim,
  ClaimableStation,
  LoginResponse,
  Me,
} from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  stationClaimDecisions,
  stationClaims,
  stationManagers,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco de testes compartilhado: UF (AP) e CNPJs próprios deste arquivo.
describe('Reivindicação de posto (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  const station: Record<'a' | 'b' | 'c' | 'd' | 'e', string> = {
    a: '',
    b: '',
    c: '',
    d: '',
    e: '',
  };

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });

  async function login(name: string, subject = `e2e-${randomUUID()}`) {
    const res = await http()
      .post('/v1/auth/login')
      .send({ provider: 'google', idToken: google.sign(subject), name })
      .expect(200);
    return res.body as LoginResponse;
  }

  async function createStation(
    cnpj: string,
    legalName: string,
    tradeName?: string,
  ) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName,
        tradeName,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'MACAPA',
        state: 'AP',
        location: sql`ST_SetSRID(ST_MakePoint(-51.06, 0.03), 4326)`,
      })
      .returning({ id: stations.id });
    return row.id;
  }

  const claimBody = (stationId: string) => ({
    stationId,
    contactName: 'Maria da Silva',
    phone: '(96) 99123-4567',
    position: 'dono',
    message: 'Melhor ligar à tarde.',
  });

  function claim(who: LoginResponse, stationId: string) {
    return http().post('/v1/claims').set(auth(who)).send(claimBody(stationId));
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

    station.a = await createStation(
      '88000000000101',
      'AUTO POSTO SÃO JOSÉ LTDA',
      'Posto São José',
    );
    station.b = await createStation(
      '88000000000202',
      'COMERCIO DE COMBUSTIVEIS AMAPA LTDA',
    );
    station.c = await createStation('88000000000303', 'POSTO TRES LTDA');
    station.d = await createStation('88000000000404', 'POSTO QUATRO LTDA');
    station.e = await createStation('88000000000505', 'POSTO CINCO LTDA');

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Claims', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Claims', subject);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('busca de postos', () => {
    it('por CNPJ, com pontuação e parcial', async () => {
      const someone = await login('Busca CNPJ');
      const res = await http()
        .get('/v1/claims/stations')
        .query({ q: '88.000.000/0002' })
        .set(auth(someone))
        .expect(200);
      const found = res.body as ClaimableStation[];
      expect(found.map((s) => s.id)).toEqual([station.b]);
      expect(found[0].cnpj).toBe('88.000.000/0002-02');
    });

    it('por nome, sem diferenciar acento nem maiúsculas', async () => {
      const someone = await login('Busca nome');
      const res = await http()
        .get('/v1/claims/stations')
        .query({ q: 'sao jose', state: 'AP' })
        .set(auth(someone))
        .expect(200);
      const found = res.body as ClaimableStation[];
      expect(found.map((s) => s.id)).toEqual([station.a]);
      expect(found[0].name).toBe('Posto São José');
    });

    it('exige login', async () => {
      await http().get('/v1/claims/stations').query({ q: 'posto' }).expect(401);
    });
  });

  describe('pedido', () => {
    it('valida o telefone', async () => {
      const someone = await login('Telefone ruim');
      const res = await http()
        .post('/v1/claims')
        .set(auth(someone))
        .send({ ...claimBody(station.a), phone: '1234' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('Informe o telefone com DDD');
    });

    it('cria em análise e não aceita repetir o mesmo posto', async () => {
      const ana = await login('Ana Claims');
      const res = await claim(ana, station.a).expect(201);
      const created = res.body as Claim;
      expect(created.status).toBe('em_analise');
      expect(created.station.id).toBe(station.a);

      const again = await claim(ana, station.a).expect(409);
      expect((again.body as { message: string }).message).toBe(
        'Você já tem um pedido em análise para este posto.',
      );

      const [row] = await db
        .select({ phone: stationClaims.phone })
        .from(stationClaims)
        .where(eq(stationClaims.id, created.id));
      expect(row.phone).toBe('96991234567');
    });

    it('limita os pedidos em análise por conta (parâmetro)', async () => {
      const bia = await login('Bia Claims');
      await claim(bia, station.b).expect(201);
      await claim(bia, station.c).expect(201);
      await claim(bia, station.d).expect(201);
      const res = await claim(bia, station.e).expect(409);
      expect((res.body as { message: string }).message).toContain(
        'Você já tem 3 pedidos em análise',
      );
    });

    it('quem já gerencia o posto não pede de novo', async () => {
      const caio = await login('Caio Claims');
      await addToNetwork(db, caio.user.id, [station.e]);
      await claim(caio, station.e).expect(409);
    });
  });

  describe('análise pelo administrador', () => {
    it('só administradores veem a fila', async () => {
      const someone = await login('Curioso');
      await http().get('/v1/admin/claims').set(auth(someone)).expect(403);
    });

    it('aprovar cria o vínculo de responsável e libera o portal', async () => {
      const dora = await login('Dora Claims');
      const created = (await claim(dora, station.b).expect(201)).body as Claim;

      const queue = await http()
        .get('/v1/admin/claims')
        .set(auth(admin))
        .expect(200);
      const item = (queue.body as AdminClaim[]).find(
        (c) => c.id === created.id,
      );
      expect(item).toMatchObject({
        contactName: 'Maria da Silva',
        phone: '96991234567',
        message: 'Melhor ligar à tarde.',
        account: { id: dora.user.id, name: 'Dora Claims' },
        status: 'em_analise',
      });

      const res = await http()
        .post(`/v1/admin/claims/${created.id}/approve`)
        .set(auth(admin))
        .send({ verificationMethod: 'telefone' })
        .expect(200);
      expect((res.body as AdminClaim).status).toBe('aprovado');
      expect((res.body as AdminClaim).verificationMethod).toBe('telefone');

      const [link] = await db
        .select()
        .from(stationManagers)
        .where(
          and(
            eq(stationManagers.userId, dora.user.id),
            eq(stationManagers.stationId, station.b),
          ),
        );
      expect(link).toMatchObject({
        role: 'responsavel',
        verificationMethod: 'telefone',
        createdByUserId: admin.user.id,
      });
      expect(link.verifiedAt).toBeInstanceOf(Date);

      const me = await http().get('/v1/me').set(auth(dora)).expect(200);
      expect((me.body as Me).managedStations.map((s) => s.id)).toContain(
        station.b,
      );
      await http()
        .get(`/v1/portal/stations/${station.b}/reputation`)
        .set(auth(dora))
        .expect(200);

      // Decidido não volta para análise.
      await http()
        .post(`/v1/admin/claims/${created.id}/reject`)
        .set(auth(admin))
        .send({ reason: 'Tentativa de mudar a decisão.' })
        .expect(400);
    });

    it('recusar exige motivo, que a pessoa vê', async () => {
      const edu = await login('Edu Claims');
      const created = (await claim(edu, station.c).expect(201)).body as Claim;

      await http()
        .post(`/v1/admin/claims/${created.id}/reject`)
        .set(auth(admin))
        .send({ reason: '' })
        .expect(400);
      await http()
        .post(`/v1/admin/claims/${created.id}/reject`)
        .set(auth(admin))
        .send({ reason: 'Não conseguimos confirmar com o posto.' })
        .expect(200);

      const mine = await http()
        .get('/v1/claims/mine')
        .set(auth(edu))
        .expect(200);
      expect(mine.body as Claim[]).toEqual([
        expect.objectContaining({
          id: created.id,
          status: 'recusado',
          reason: 'Não conseguimos confirmar com o posto.',
        }),
      ]);

      // A decisão é só de inserção (registro de auditoria).
      await expect(
        db
          .update(stationClaimDecisions)
          .set({ reason: 'outro' })
          .where(eq(stationClaimDecisions.claimId, created.id)),
      ).rejects.toThrow();
    });
  });

  it('excluir a conta apaga o contato do pedido, que continua registrado', async () => {
    const fabio = await login('Fábio Claims');
    const created = (await claim(fabio, station.d).expect(201)).body as Claim;
    await http().delete('/v1/me').set(auth(fabio)).expect(204);

    const [row] = await db
      .select()
      .from(stationClaims)
      .where(eq(stationClaims.id, created.id));
    expect(row).toMatchObject({
      contactName: null,
      phone: null,
      message: null,
    });
  });
});
