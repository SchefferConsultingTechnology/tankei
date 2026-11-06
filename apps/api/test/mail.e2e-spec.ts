import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminClaim,
  Claim,
  LoginResponse,
  PriceHistory,
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
  stationFuels,
  stations,
  users,
} from './../src/database/schema';
import { MailService } from './../src/mail/mail.service';
import type { MailMessage } from './../src/mail/templates';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (MS), CNPJs (5600…) e coordenadas próprios.
// Sem RESEND_API_KEY nada sai; o espião registra o que seria enviado.
const ORIGIN = { lat: -20.46, lng: -54.62 };

describe('E-mails transacionais (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let manager: LoginResponse;
  let operator: LoginResponse;
  let networkId = '';
  const station = { a: '', b: '' };
  const sent: { to: string[]; message: MailMessage }[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });
  const emailOf = (who: LoginResponse) => who.user.email!.toLowerCase();

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
    return { body: res.body as LoginResponse, subject };
  }

  /** Avisos rodam em segundo plano: espera até aparecerem. */
  async function mailsTo(
    address: string,
    subjectPart: string,
    count = 1,
  ): Promise<MailMessage[]> {
    const find = () =>
      sent
        .filter(
          (m) =>
            m.to.map((t) => t.toLowerCase()).includes(address) &&
            m.message.subject.includes(subjectPart),
        )
        // O formatador de moeda usa espaço não separável depois do "R$".
        .map((m) => ({
          ...m.message,
          text: m.message.text.replace(/\u00a0/g, ' '),
        }));
    for (let i = 0; i < 50 && find().length < count; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return find();
  }

  async function createStation(cnpj: string, lng: number) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `POSTO ${cnpj} LTDA`,
        tradeName: `Posto ${cnpj.slice(-4)}`,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'CAMPO GRANDE',
        state: 'MS',
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${ORIGIN.lat}), 4326)`,
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

    jest
      .spyOn(app.get(MailService), 'send')
      .mockImplementation((to: string[], message: MailMessage) => {
        sent.push({ to, message });
        return Promise.resolve();
      });

    station.a = await createStation('56000000000101', ORIGIN.lng);
    station.b = await createStation('56000000000202', ORIGIN.lng + 0.01);

    const adminLogin = await login('Admin E-mail');
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, adminLogin.body.user.id));
    admin = (await login('Admin E-mail', adminLogin.subject)).body;
    owner = (await login('Dono E-mail')).body;
    manager = (await login('Gestora E-mail')).body;
    operator = (await login('Operador E-mail')).body;
    networkId = await addToNetwork(db, owner.user.id, [station.a]);
    await db.insert(organizationMembers).values([
      {
        organizationId: networkId,
        userId: manager.user.id,
        role: 'gestor',
        scope: 'todas',
      },
      {
        organizationId: networkId,
        userId: operator.user.id,
        role: 'operador',
        scope: 'todas',
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('convite para a equipe vai para o e-mail convidado', async () => {
    const invited = `convidado-${randomUUID()}@example.com`;
    await http()
      .post(`/v1/portal/organizations/${networkId}/invitations`)
      .set(auth(owner))
      .send({ email: invited, role: 'operador', scope: 'todas' })
      .expect(201);

    const [mail] = await mailsTo(invited, 'Convite para a equipe');
    expect(mail.text).toContain('Dono E-mail convidou você');
    expect(mail.text).toContain('como Operador');
  });

  it('pedido de acesso avisa a equipe Tankei e o proprietário; a decisão avisa quem pediu', async () => {
    const requester = (await login('Pessoa que Pede')).body;
    const res = await http()
      .post('/v1/claims')
      .set(auth(requester))
      .send({
        stationId: station.a,
        contactName: 'Pessoa que Pede',
        phone: '(67) 99123-4567',
        position: 'gerente',
      })
      .expect(201);

    expect(await mailsTo(emailOf(admin), 'Novo pedido de acesso')).toHaveLength(
      1,
    );
    const [toOwner] = await mailsTo(emailOf(owner), 'Pedido de acesso a');
    expect(toOwner.text).toContain('Pessoa que Pede (Gerente) pediu acesso');
    // Gestora não gerencia a equipe: não recebe.
    expect(await mailsTo(emailOf(manager), 'Pedido de acesso a')).toEqual([]);

    await http()
      .post(`/v1/admin/claims/${(res.body as Claim).id}/reject`)
      .set(auth(admin))
      .send({ reason: 'Não conseguimos confirmar o vínculo.' })
      .expect(200);
    const [decided] = await mailsTo(
      emailOf(requester),
      'Pedido de acesso recusado',
    );
    expect(decided.text).toContain('Motivo: Não conseguimos confirmar');

    // Aprovação: posto sem rede (b).
    const other = (await login('Dona Aprovada')).body;
    const claim = await http()
      .post('/v1/claims')
      .set(auth(other))
      .send({
        stationId: station.b,
        contactName: 'Dona Aprovada',
        phone: '(67) 99123-4568',
        position: 'dono',
      })
      .expect(201);
    await http()
      .post(`/v1/admin/claims/${(claim.body as AdminClaim).id}/approve`)
      .set(auth(admin))
      .send({ verificationMethod: 'telefone' })
      .expect(200);
    expect(await mailsTo(emailOf(other), 'Acesso liberado')).toHaveLength(1);
  });

  it('divergência avisa quem atualiza preço, uma vez por divergência', async () => {
    await http()
      .post(`/v1/stations/${station.a}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'gasolina_comum', price: 6.19, confirmed: true })
      .expect(201);
    const consumers = [
      (await login('Consumidor 1')).body,
      (await login('Consumidor 2')).body,
      (await login('Consumidor 3')).body,
    ];
    for (const who of consumers) {
      await http()
        .post(`/v1/stations/${station.a}/prices`)
        .set(auth(who))
        .send({ fuelType: 'gasolina_comum', price: 6.49, confirmed: true })
        .expect(201);
    }

    const subject = 'consumidores informaram outro preço';
    const [toOwner] = await mailsTo(emailOf(owner), subject);
    expect(toOwner.text).toContain('Consumidores confirmaram R$ 6,49');
    expect(toOwner.text).toContain('O seu preço é R$ 6,19');
    expect(await mailsTo(emailOf(manager), subject)).toHaveLength(1);
    expect(await mailsTo(emailOf(operator), subject)).toHaveLength(1);
    // O terceiro consumidor confirmou o mesmo valor: sem e-mail repetido.
    expect(sent.filter((m) => m.message.subject.includes(subject)).length).toBe(
      1,
    );
  });

  it('contestação avisa a equipe Tankei; a decisão avisa quem pode contestar', async () => {
    const history = await http()
      .get(`/v1/portal/stations/${station.a}/price-history`)
      .set(auth(owner))
      .expect(200);
    const reportIds = (history.body as PriceHistory).entries
      .filter((e) => e.contestable)
      .map((e) => e.id);
    const contest = await http()
      .post(`/v1/portal/stations/${station.a}/moderation/contests`)
      .set(auth(manager))
      .send({ reportIds, reason: 'Nunca vendemos a esse preço.' })
      .expect(201);
    const [opened] = await mailsTo(emailOf(admin), 'Moderação: contestação');
    expect(opened.text).toContain('3 informes fora do preço');

    await http()
      .post(
        `/v1/admin/moderation/${(contest.body as { id: string }).id}/decide`,
      )
      .set(auth(admin))
      .send({ decision: 'anulado', reason: 'Contas criadas juntas.' })
      .expect(200);
    const subject = 'Contestação decidida';
    const [toManager] = await mailsTo(emailOf(manager), subject);
    expect(toManager.text).toContain('anulados');
    expect(toManager.text).toContain('Explicação: Contas criadas juntas.');
    expect(await mailsTo(emailOf(owner), subject)).toHaveLength(1);
    // Operador não contesta: não recebe a decisão.
    expect(await mailsTo(emailOf(operator), subject, 0)).toEqual([]);
  });
});
