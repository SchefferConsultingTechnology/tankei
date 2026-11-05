import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  BulkPriceResult,
  Claim,
  Invitation,
  LoginResponse,
  Me,
  MyInvitation,
  OrganizationOverview,
  PriceHistory,
  Team,
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
  organizationEvents,
  organizationStations,
  stationFuels,
  stations,
  users,
} from './../src/database/schema';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco de testes compartilhado: UF (RO) e CNPJs próprios deste arquivo.
describe('Redes de postos e equipe (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let owner: LoginResponse;
  let orgId: string;
  const unit: Record<'a' | 'b' | 'c' | 'd', string> = {
    a: '',
    b: '',
    c: '',
    d: '',
  };

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });

  /** Login com e-mail verificado (necessário para aceitar convites). */
  async function login(
    name: string,
    email?: string,
    subject = `e2e-${randomUUID()}`,
  ) {
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

  async function createStation(cnpj: string, name: string) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: name,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'PORTO VELHO',
        state: 'RO',
        location: sql`ST_SetSRID(ST_MakePoint(-63.9, -8.76), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'gasolina_comum' });
    return row.id;
  }

  const me = async (who: LoginResponse) =>
    (await http().get('/v1/me').set(auth(who)).expect(200)).body as Me;

  function invite(by: LoginResponse, body: Record<string, unknown>) {
    return http()
      .post(`/v1/portal/organizations/${orgId}/invitations`)
      .set(auth(by))
      .send(body);
  }

  async function join(email: string, body: Record<string, unknown>) {
    const created = (await invite(owner, { email, ...body }).expect(201))
      .body as Invitation;
    const person = await login(`Pessoa ${email}`, email);
    await http()
      .post(`/v1/portal/invitations/${created.id}/accept`)
      .set(auth(person))
      .expect(204);
    return person;
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

    unit.a = await createStation('66000000000101', 'REDE TESTE UNIDADE A');
    unit.b = await createStation('66000000000202', 'REDE TESTE UNIDADE B');
    unit.c = await createStation('66000000000303', 'REDE TESTE UNIDADE C');
    unit.d = await createStation('66000000000404', 'REDE TESTE UNIDADE D');

    owner = await login('Dona da Rede', 'dona@rede.teste');
    orgId = await addToNetwork(db, owner.user.id, [unit.a, unit.b, unit.c]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a conta mostra a rede, o papel e as unidades', async () => {
    const account = await me(owner);
    expect(account.managedStations.map((s) => s.id).sort()).toEqual(
      [unit.a, unit.b, unit.c].sort(),
    );
    expect(
      account.managedStations.every((s) => s.role === 'proprietario'),
    ).toBe(true);
    expect(account.organizations).toEqual([
      expect.objectContaining({
        id: orgId,
        role: 'proprietario',
        totalStations: 3,
      }),
    ]);
  });

  describe('convites', () => {
    it('valida papel e escopo', async () => {
      await invite(owner, {
        email: 'x@rede.teste',
        role: 'proprietario',
        scope: 'selecionadas',
        stationIds: [unit.a],
      }).expect(400);
      await invite(owner, {
        email: 'x@rede.teste',
        role: 'gestor',
        scope: 'selecionadas',
        stationIds: [],
      }).expect(400);
      // Unidade de fora da rede.
      await invite(owner, {
        email: 'x@rede.teste',
        role: 'gestor',
        scope: 'selecionadas',
        stationIds: [unit.d],
      }).expect(400);
    });

    it('gestor com unidade escolhida vê só ela, e não convida ninguém', async () => {
      const created = (
        await invite(owner, {
          email: 'Gestor@Rede.Teste',
          role: 'gestor',
          scope: 'selecionadas',
          stationIds: [unit.a],
        }).expect(201)
      ).body as Invitation;
      expect(created).toMatchObject({
        email: 'gestor@rede.teste',
        status: 'pendente',
      });

      // Repetido enquanto pendente.
      await invite(owner, {
        email: 'gestor@rede.teste',
        role: 'leitura',
        scope: 'todas',
      }).expect(409);

      // Outra pessoa não vê nem aceita.
      const stranger = await login('Estranho', 'estranho@rede.teste');
      expect(
        (
          await http()
            .get('/v1/portal/invitations')
            .set(auth(stranger))
            .expect(200)
        ).body,
      ).toEqual([]);
      await http()
        .post(`/v1/portal/invitations/${created.id}/accept`)
        .set(auth(stranger))
        .expect(404);

      const gestor = await login('Gestor da Rede', 'gestor@rede.teste');
      const mine = (
        await http().get('/v1/portal/invitations').set(auth(gestor)).expect(200)
      ).body as MyInvitation[];
      expect(mine).toEqual([
        expect.objectContaining({
          id: created.id,
          role: 'gestor',
          stations: [{ id: unit.a, name: 'Rede Teste Unidade A' }],
        }),
      ]);
      await http()
        .post(`/v1/portal/invitations/${created.id}/accept`)
        .set(auth(gestor))
        .expect(204);

      const account = await me(gestor);
      expect(account.managedStations).toEqual([
        expect.objectContaining({
          id: unit.a,
          role: 'gestor',
          organizationId: orgId,
        }),
      ]);
      await http()
        .get(`/v1/portal/stations/${unit.a}/competition`)
        .set(auth(gestor))
        .expect(200);
      await http()
        .get(`/v1/portal/stations/${unit.b}/competition`)
        .set(auth(gestor))
        .expect(403);
      await invite(gestor, {
        email: 'y@rede.teste',
        role: 'leitura',
        scope: 'todas',
      }).expect(403);
      await http()
        .get(`/v1/portal/organizations/${orgId}/team`)
        .set(auth(gestor))
        .expect(403);

      // Visão da rede: só a unidade do escopo.
      const overview = (
        await http()
          .get(`/v1/portal/organizations/${orgId}`)
          .set(auth(gestor))
          .expect(200)
      ).body as OrganizationOverview;
      expect(overview.stations.map((s) => s.id)).toEqual([unit.a]);

      // Aceito não vale de novo.
      await http()
        .post(`/v1/portal/invitations/${created.id}/accept`)
        .set(auth(gestor))
        .expect(400);
    });

    it('convite revogado não pode ser aceito', async () => {
      const created = (
        await invite(owner, {
          email: 'revogado@rede.teste',
          role: 'leitura',
          scope: 'todas',
        }).expect(201)
      ).body as Invitation;
      await http()
        .delete(`/v1/portal/organizations/${orgId}/invitations/${created.id}`)
        .set(auth(owner))
        .expect(204);
      const person = await login('Revogado', 'revogado@rede.teste');
      await http()
        .post(`/v1/portal/invitations/${created.id}/accept`)
        .set(auth(person))
        .expect(400);

      const team = (
        await http()
          .get(`/v1/portal/organizations/${orgId}/team`)
          .set(auth(owner))
          .expect(200)
      ).body as Team;
      expect(team.invitations.find((i) => i.id === created.id)?.status).toBe(
        'revogado',
      );
    });
  });

  describe('papéis', () => {
    it('operador informa como posto; somente leitura não informa nem avalia', async () => {
      const operador = await join('operador@rede.teste', {
        role: 'operador',
        scope: 'todas',
      });
      await http()
        .post(`/v1/stations/${unit.b}/prices`)
        .set(auth(operador))
        .send({ fuelType: 'gasolina_comum', price: 6.19 })
        .expect(201);
      const history = (
        await http()
          .get(`/v1/portal/stations/${unit.b}/price-history`)
          .set(auth(owner))
          .expect(200)
      ).body as PriceHistory;
      expect(history.entries[0]).toMatchObject({
        source: 'posto',
        price: 6.19,
      });

      const leitura = await join('leitura@rede.teste', {
        role: 'leitura',
        scope: 'todas',
      });
      const denied = await http()
        .post(`/v1/stations/${unit.b}/prices`)
        .set(auth(leitura))
        .send({ fuelType: 'gasolina_comum', price: 6.09 })
        .expect(403);
      expect((denied.body as { message: string }).message).toBe(
        'Seu papel no posto não permite atualizar preços.',
      );
      await http()
        .post(`/v1/stations/${unit.b}/reviews`)
        .set(auth(leitura))
        .send({ ratings: { atendimento: 5 } })
        .expect(403);
      // Mas vê o portal.
      await http()
        .get(`/v1/portal/stations/${unit.b}/reputation`)
        .set(auth(leitura))
        .expect(200);
    });

    it('preço em lote nas unidades do escopo, uma a uma', async () => {
      const res = await http()
        .post(`/v1/portal/organizations/${orgId}/prices`)
        .set(auth(owner))
        .send({
          fuelType: 'gasolina_comum',
          price: 6.29,
          stationIds: [unit.a, unit.c],
        })
        .expect(200);
      expect((res.body as BulkPriceResult).results).toEqual([
        expect.objectContaining({ stationId: unit.a, ok: true }),
        expect.objectContaining({ stationId: unit.c, ok: true }),
      ]);
      // Unidade de fora da rede.
      await http()
        .post(`/v1/portal/organizations/${orgId}/prices`)
        .set(auth(owner))
        .send({ fuelType: 'gasolina_comum', price: 6.29, stationIds: [unit.d] })
        .expect(403);

      const overview = (
        await http()
          .get(`/v1/portal/organizations/${orgId}`)
          .set(auth(owner))
          .expect(200)
      ).body as OrganizationOverview;
      expect(overview.stations).toHaveLength(3);
      expect(
        overview.stations.find((s) => s.id === unit.c)?.prices[0],
      ).toMatchObject({ price: 6.29, badge: 'atualizado_posto' });
    });

    it('alterar escopo e remover; a rede nunca fica sem proprietário', async () => {
      const pessoa = await join('troca@rede.teste', {
        role: 'gestor',
        scope: 'selecionadas',
        stationIds: [unit.c],
      });
      expect((await me(pessoa)).managedStations).toHaveLength(1);

      await http()
        .patch(`/v1/portal/organizations/${orgId}/members/${pessoa.user.id}`)
        .set(auth(owner))
        .send({ role: 'gestor', scope: 'todas' })
        .expect(204);
      expect((await me(pessoa)).managedStations).toHaveLength(3);

      const lastOwner = await http()
        .delete(`/v1/portal/organizations/${orgId}/members/${owner.user.id}`)
        .set(auth(owner))
        .expect(400);
      expect((lastOwner.body as { message: string }).message).toContain(
        'ao menos um proprietário',
      );

      await http()
        .delete(`/v1/portal/organizations/${orgId}/members/${pessoa.user.id}`)
        .set(auth(owner))
        .expect(204);
      expect((await me(pessoa)).managedStations).toEqual([]);
    });

    it('cada ação de equipe fica no registro de auditoria', async () => {
      const events = await db
        .select({ action: organizationEvents.action })
        .from(organizationEvents)
        .where(eq(organizationEvents.organizationId, orgId));
      const actions = new Set(events.map((e) => e.action));
      for (const action of [
        'convite_criado',
        'convite_aceito',
        'convite_revogado',
        'membro_alterado',
        'membro_removido',
      ]) {
        expect(actions).toContain(action);
      }
      await expect(
        db
          .update(organizationEvents)
          .set({ action: 'outro' })
          .where(eq(organizationEvents.organizationId, orgId)),
      ).rejects.toThrow();
    });
  });

  it('reivindicação aprovada coloca o posto na rede de quem pediu', async () => {
    const subject = `e2e-${randomUUID()}`;
    let admin = await login('Admin Rede', undefined, subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Rede', undefined, subject);

    const claim = (
      await http()
        .post('/v1/claims')
        .set(auth(owner))
        .send({
          stationId: unit.d,
          contactName: 'Dona da Rede',
          phone: '69991234567',
          position: 'dono',
        })
        .expect(201)
    ).body as Claim;
    await http()
      .post(`/v1/admin/claims/${claim.id}/approve`)
      .set(auth(admin))
      .send({ verificationMethod: 'presencial' })
      .expect(200);

    const [row] = await db
      .select({ organizationId: organizationStations.organizationId })
      .from(organizationStations)
      .where(eq(organizationStations.stationId, unit.d));
    expect(row.organizationId).toBe(orgId);
    expect((await me(owner)).managedStations).toHaveLength(4);
  });
});
