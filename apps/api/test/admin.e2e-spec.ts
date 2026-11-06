import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminNetwork,
  AdminNetworkSummary,
  AdminParameter,
  AdminStation,
  AdminStationSummary,
  LoginResponse,
  ParameterChange,
} from '@tankei/shared';
import { PARAMETER_KEYS } from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import { organizationMembers, stations, users } from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';

// Banco de testes compartilhado: UF (AC) e CNPJs (5400…) próprios deste arquivo.
// Parâmetros são globais: aqui só se grava o valor que já vale.
describe('Administração: parâmetros, postos e redes (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let ana: LoginResponse;
  let bruno: LoginResponse;
  let stationId = '';
  let networkId = '';
  const anaEmail = `ana-${randomUUID()}@example.com`;

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });

  async function login(name: string, subject: string, email?: string) {
    const res = await http()
      .post('/v1/auth/login')
      .send({
        provider: 'google',
        idToken: google.sign(
          subject,
          email ? { email, email_verified: true } : {},
        ),
        name,
      })
      .expect(200);
    return res.body as LoginResponse;
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

    const [row] = await db
      .insert(stations)
      .values({
        cnpj: '54000000000191',
        legalName: 'AUTO POSTO ACREANO LTDA',
        brand: 'IPIRANGA',
        address: 'RUA TESTE, 10',
        city: 'XAPURI',
        state: 'AC',
        location: sql`ST_SetSRID(ST_MakePoint(-68.5, -10.65), 4326)`,
      })
      .returning({ id: stations.id });
    stationId = row.id;

    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Suporte', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Suporte', subject);
    ana = await login('Ana Acreana', `e2e-${randomUUID()}`, anaEmail);
    bruno = await login(
      'Bruno Gestor',
      `e2e-${randomUUID()}`,
      `bruno-${randomUUID()}@example.com`,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('só o administrador acessa', async () => {
    await http().get('/v1/admin/parameters').set(auth(ana)).expect(403);
    await http().get('/v1/admin/stations?q=xapuri').set(auth(ana)).expect(403);
    await http().get('/v1/admin/networks').set(auth(ana)).expect(403);
  });

  describe('Parâmetros', () => {
    it('lista todos, com nome, unidade e última alteração', async () => {
      const res = await http()
        .get('/v1/admin/parameters')
        .set(auth(admin))
        .expect(200);
      const list = res.body as AdminParameter[];
      expect(list.map((p) => p.key).sort()).toEqual([...PARAMETER_KEYS].sort());
      expect(
        list.find((p) => p.key === 'portal.competition_radius_m'),
      ).toMatchObject({
        group: 'portal',
        label: 'Raio da concorrência',
        unit: 'meters',
      });
    });

    it('recusa valor fora da unidade, par incoerente e chave desconhecida', async () => {
      const percent = await http()
        .put('/v1/admin/parameters/price.reference_max_pct')
        .set(auth(admin))
        .send({ value: 150, reason: 'Teste de validação' })
        .expect(400);
      expect(percent.body).toMatchObject({
        message: 'Use um valor entre 0 e 100.',
      });

      const integer = await http()
        .put('/v1/admin/parameters/price.promotion_max_days')
        .set(auth(admin))
        .send({ value: 2.5, reason: 'Teste de validação' })
        .expect(400);
      expect(integer.body).toMatchObject({
        message: 'Use um número inteiro maior que zero.',
      });

      const pair = await http()
        .put('/v1/admin/parameters/price.reference_normal_pct')
        .set(auth(admin))
        .send({ value: 99, reason: 'Teste de validação' })
        .expect(400);
      expect(pair.body).toMatchObject({
        message:
          'A distância normal da média ANP não pode passar da distância máxima.',
      });

      await http()
        .put('/v1/admin/parameters/nao.existe')
        .set(auth(admin))
        .send({ value: 1, reason: 'Teste de validação' })
        .expect(404);

      const noReason = await http()
        .put('/v1/admin/parameters/price.promotion_max_days')
        .set(auth(admin))
        .send({ value: 7, reason: '' })
        .expect(400);
      expect(JSON.stringify(noReason.body)).toContain('pelo menos 5');
    });

    it('registra a alteração com motivo e autor, sem apagar o histórico', async () => {
      const before = (
        await http().get('/v1/admin/parameters').set(auth(admin)).expect(200)
      ).body as AdminParameter[];
      const current = before.find((p) => p.key === 'price.promotion_max_days');
      expect(current).toBeDefined();

      const res = await http()
        .put('/v1/admin/parameters/price.promotion_max_days')
        .set(auth(admin))
        .send({ value: current?.value, reason: 'Revisão sem mudança' })
        .expect(200);
      expect(res.body).toMatchObject({
        value: current?.value,
        reason: 'Revisão sem mudança',
        changedBy: 'Admin Suporte',
      });
      expect((res.body as AdminParameter).changes).toBeGreaterThan(
        current?.changes ?? 0,
      );

      const history = await http()
        .get('/v1/admin/parameters/price.promotion_max_days/history')
        .set(auth(admin))
        .expect(200);
      const changes = history.body as ParameterChange[];
      expect(changes[0]).toMatchObject({ reason: 'Revisão sem mudança' });
      expect(changes.at(-1)?.changedBy).toBeNull();
    });
  });

  describe('Postos e redes', () => {
    it('busca posto por CNPJ parcial e por cidade, sem rede', async () => {
      const byCnpj = await http()
        .get('/v1/admin/stations?q=54.000.000')
        .set(auth(admin))
        .expect(200);
      expect(byCnpj.body as AdminStationSummary[]).toEqual([
        expect.objectContaining({
          id: stationId,
          name: 'Auto Posto Acreano',
          cnpj: '54.000.000/0001-91',
          network: null,
        }),
      ]);

      const byCity = await http()
        .get('/v1/admin/stations?q=xapuri')
        .set(auth(admin))
        .expect(200);
      expect((byCity.body as AdminStationSummary[]).map((s) => s.id)).toContain(
        stationId,
      );
    });

    it('vincula responsável pelo e-mail da conta', async () => {
      const unknown = await http()
        .post(`/v1/admin/stations/${stationId}/managers`)
        .set(auth(admin))
        .send({ email: 'ninguem@example.com' })
        .expect(404);
      expect((unknown.body as { message: string }).message).toContain(
        'Nenhuma conta com esse e-mail',
      );

      await http()
        .post(`/v1/admin/stations/${stationId}/managers`)
        .set(auth(admin))
        .send({ email: anaEmail.toUpperCase() })
        .expect(204);

      const res = await http()
        .get(`/v1/admin/stations/${stationId}`)
        .set(auth(admin))
        .expect(200);
      const station = res.body as AdminStation;
      expect(station.verifiedManagers).toEqual([
        expect.objectContaining({
          userId: ana.user.id,
          verificationMethod: 'presencial',
        }),
      ]);
      expect(station.network).not.toBeNull();
      networkId = station.network?.id ?? '';
    });

    it('lista a rede pelo e-mail de alguém da equipe e mostra o registro', async () => {
      const list = await http()
        .get(`/v1/admin/networks?q=${encodeURIComponent(anaEmail)}`)
        .set(auth(admin))
        .expect(200);
      expect(list.body as AdminNetworkSummary[]).toEqual([
        expect.objectContaining({
          id: networkId,
          stations: 1,
          members: 1,
          owners: ['Ana Acreana'],
        }),
      ]);

      const res = await http()
        .get(`/v1/admin/networks/${networkId}`)
        .set(auth(admin))
        .expect(200);
      const network = res.body as AdminNetwork;
      expect(network.stations).toEqual([
        expect.objectContaining({ id: stationId, cnpj: '54.000.000/0001-91' }),
      ]);
      expect(network.members).toEqual([
        expect.objectContaining({ userId: ana.user.id, role: 'proprietario' }),
      ]);
      expect(network.events.map((e) => e.description)).toEqual(
        expect.arrayContaining([
          'Rede criada',
          'Auto Posto Acreano entrou na rede, com Ana Acreana como proprietário verificado',
        ]),
      );
    });

    it('ajusta papel com motivo e mantém ao menos um proprietário', async () => {
      await db.insert(organizationMembers).values({
        organizationId: networkId,
        userId: bruno.user.id,
        role: 'gestor',
        scope: 'todas',
      });

      const lastOwner = await http()
        .post(`/v1/admin/networks/${networkId}/members/${ana.user.id}/remove`)
        .set(auth(admin))
        .send({ reason: 'Teste de último dono' })
        .expect(400);
      expect((lastOwner.body as { message: string }).message).toContain(
        'ao menos um proprietário',
      );

      await http()
        .patch(`/v1/admin/networks/${networkId}/members/${bruno.user.id}`)
        .set(auth(admin))
        .send({
          role: 'proprietario',
          scope: 'todas',
          reason: 'Dono pediu por telefone',
        })
        .expect(204);

      await http()
        .post(`/v1/admin/networks/${networkId}/members/${ana.user.id}/remove`)
        .set(auth(admin))
        .send({ reason: 'Vendeu o posto' })
        .expect(204);

      const network = (
        await http()
          .get(`/v1/admin/networks/${networkId}`)
          .set(auth(admin))
          .expect(200)
      ).body as AdminNetwork;
      expect(network.members).toEqual([
        expect.objectContaining({
          userId: bruno.user.id,
          role: 'proprietario',
        }),
      ]);
      expect(network.events.slice(0, 2)).toEqual([
        expect.objectContaining({
          description:
            'Ana Acreana saiu da equipe pelo administrador. Motivo: Vendeu o posto',
          actor: 'Admin Suporte',
        }),
        expect.objectContaining({
          description:
            'Bruno Gestor passou a proprietário, com todas as unidades pelo administrador. Motivo: Dono pediu por telefone',
        }),
      ]);

      // A verificação de responsável também sai (ADR 0011).
      const station = (
        await http()
          .get(`/v1/admin/stations/${stationId}`)
          .set(auth(admin))
          .expect(200)
      ).body as AdminStation;
      expect(station.verifiedManagers).toEqual([]);
    });

    it('renomeia a rede, com registro', async () => {
      await http()
        .patch(`/v1/admin/networks/${networkId}`)
        .set(auth(admin))
        .send({ name: 'Rede Acreana' })
        .expect(204);
      const network = (
        await http()
          .get(`/v1/admin/networks/${networkId}`)
          .set(auth(admin))
          .expect(200)
      ).body as AdminNetwork;
      expect(network.name).toBe('Rede Acreana');
      expect(network.events[0].description).toBe(
        'Rede renomeada para "Rede Acreana" pelo administrador',
      );
    });
  });
});
