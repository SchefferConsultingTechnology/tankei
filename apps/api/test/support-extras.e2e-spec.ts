import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminClaim,
  AdminNetwork,
  AdminStation,
  Claim,
  LoginResponse,
  StationClaimNotice,
} from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { IDENTITY_VERIFIERS } from './../src/auth/identity/identity-verifiers.provider';
import { DRIZZLE, type Database } from './../src/database/database.module';
import { stations, users } from './../src/database/schema';
import { MailService } from './../src/mail/mail.service';
import type { MailMessage } from './../src/mail/templates';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (SE) e CNPJs (5800…) próprios deste arquivo.
describe('Suporte: pedido não reconhecido, mover posto e rede sem dono (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  const station = { a: '', b: '' };
  const sent: { to: string[]; message: MailMessage }[] = [];

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
    return { body: res.body as LoginResponse, subject };
  }

  async function mailWith(subjectPart: string) {
    for (let i = 0; i < 50; i++) {
      const found = sent.find((m) => m.message.subject.includes(subjectPart));
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return undefined;
  }

  async function createStation(cnpj: string, name: string) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `${name} LTDA`,
        tradeName: name,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'ARACAJU',
        state: 'SE',
        location: sql`ST_SetSRID(ST_MakePoint(-37.07, -10.91), 4326)`,
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
    jest
      .spyOn(app.get(MailService), 'send')
      .mockImplementation((to: string[], message: MailMessage) => {
        sent.push({ to, message });
        return Promise.resolve();
      });

    station.a = await createStation('58000000000101', 'Posto Sergipe A');
    station.b = await createStation('58000000000202', 'Posto Sergipe B');
    const adminLogin = await login('Admin Suporte Extra');
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, adminLogin.body.user.id));
    admin = (await login('Admin Suporte Extra', adminLogin.subject)).body;
    owner = (await login('Dona Sergipe')).body;
    await addToNetwork(db, owner.user.id, [station.a]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('o proprietário vê o pedido de outra pessoa e diz que não reconhece', async () => {
    const stranger = (await login('Pessoa Estranha')).body;
    const created = await http()
      .post('/v1/claims')
      .set(auth(stranger))
      .send({
        stationId: station.a,
        contactName: 'Pessoa Estranha',
        phone: '(79) 99123-4567',
        position: 'gerente',
      })
      .expect(201);
    const claimId = (created.body as Claim).id;

    const notices = await http()
      .get(`/v1/portal/stations/${station.a}/claims`)
      .set(auth(owner))
      .expect(200);
    expect(notices.body as StationClaimNotice[]).toEqual([
      expect.objectContaining({
        id: claimId,
        contactName: 'Pessoa Estranha',
        position: 'gerente',
        disputedByMe: false,
      }),
    ]);
    // Quem pediu não é da equipe: não vê os pedidos do posto.
    await http()
      .get(`/v1/portal/stations/${station.a}/claims`)
      .set(auth(stranger))
      .expect(403);

    const url = `/v1/portal/stations/${station.a}/claims/${claimId}/dispute`;
    await http()
      .post(url)
      .set(auth(owner))
      .send({ reason: 'Não trabalha aqui.' })
      .expect(204);
    await http()
      .post(url)
      .set(auth(owner))
      .send({ reason: 'De novo.' })
      .expect(409);

    const queue = await http()
      .get('/v1/admin/claims')
      .set(auth(admin))
      .expect(200);
    expect(
      (queue.body as AdminClaim[]).find((c) => c.id === claimId)?.disputes,
    ).toEqual([
      expect.objectContaining({
        by: 'Dona Sergipe',
        reason: 'Não trabalha aqui.',
      }),
    ]);
    const mail = await mailWith('Pedido contestado pelo proprietário');
    expect(mail?.message.text).toContain('Dona Sergipe');
    expect(mail?.to).toContain(admin.user.email);
  });

  it('o administrador move o posto para outra rede e depois tira da rede', async () => {
    const other = (await login('Dono Outra Rede')).body;
    const otherNetwork = await addToNetwork(db, other.user.id, [station.b]);

    await http()
      .patch(`/v1/admin/stations/${station.a}/network`)
      .set(auth(admin))
      .send({
        networkId: otherNetwork,
        reason: 'Posto vendido para a outra rede.',
      })
      .expect(204);
    let detail = (
      await http()
        .get(`/v1/admin/stations/${station.a}`)
        .set(auth(admin))
        .expect(200)
    ).body as AdminStation;
    expect(detail.network?.id).toBe(otherNetwork);
    // A antiga dona perde o acesso ao posto.
    await http()
      .get(`/v1/portal/stations/${station.a}/claims`)
      .set(auth(owner))
      .expect(403);
    const network = (
      await http()
        .get(`/v1/admin/networks/${otherNetwork}`)
        .set(auth(admin))
        .expect(200)
    ).body as AdminNetwork;
    expect(network.events[0].description).toBe(
      'Posto Sergipe A entrou na rede pelo administrador. Motivo: Posto vendido para a outra rede.',
    );

    await http()
      .patch(`/v1/admin/stations/${station.a}/network`)
      .set(auth(admin))
      .send({ networkId: otherNetwork, reason: 'Repetido por engano.' })
      .expect(400);
    await http()
      .patch(`/v1/admin/stations/${station.a}/network`)
      .set(auth(admin))
      .send({ networkId: null, reason: 'Posto fechou.' })
      .expect(204);
    detail = (
      await http()
        .get(`/v1/admin/stations/${station.a}`)
        .set(auth(admin))
        .expect(200)
    ).body as AdminStation;
    expect(detail.network).toBeNull();
  });

  it('excluir a última conta proprietária avisa a equipe Tankei', async () => {
    const lonely = (await login('Dona Sozinha')).body;
    const lonelyStation = await createStation(
      '58000000000303',
      'Posto Sozinho',
    );
    const networkId = await addToNetwork(db, lonely.user.id, [lonelyStation]);

    await http().delete('/v1/me').set(auth(lonely)).expect(204);

    const mail = await mailWith('Rede sem proprietário');
    expect(mail?.message.text).toContain(`/redes/${networkId}`);
    expect(mail?.to).toContain(admin.user.email);
  });
});
