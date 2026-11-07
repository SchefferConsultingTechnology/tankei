import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminClaim,
  AppConfig,
  ClaimableStation,
  LoginResponse,
  Station,
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
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (RR), CNPJs (6100…) e coordenadas próprios.
describe('Caminho do dono do posto (ADR 0031) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let free = '';
  let managed = '';

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

  async function createStation(cnpj: string, tradeName: string, lng: number) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj,
        legalName: `${tradeName.toUpperCase()} LTDA`,
        tradeName,
        brand: 'BANDEIRA BRANCA',
        address: 'AVENIDA CAPITAO ENE GARCEZ, 100',
        city: 'BOA VISTA',
        state: 'RR',
        location: sql`ST_SetSRID(ST_MakePoint(${lng}, 2.82), 4326)`,
      })
      .returning({ id: stations.id });
    return row.id;
  }

  beforeAll(async () => {
    process.env.SUPPORT_WHATSAPP = '+55 (48) 99904-0445';
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
      .mockImplementation(() => Promise.resolve());

    free = await createStation('61000000000101', 'Posto Roraima', -60.67);
    managed = await createStation('61000000000202', 'Posto Boa Vista', -60.68);
    const manager = await login('Dono Boa Vista');
    await addToNetwork(db, manager.user.id, [managed]);

    owner = await login('Dono Roraima');
    const subject = `e2e-${randomUUID()}`;
    admin = await login('Admin Convite', subject);
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, admin.user.id));
    admin = await login('Admin Convite', subject);
  });

  afterAll(async () => {
    delete process.env.SUPPORT_WHATSAPP;
    await app.close();
  });

  it('a configuração pública traz o WhatsApp só com dígitos', async () => {
    const res = await http().get('/v1/config').expect(200);
    expect(res.body as AppConfig).toMatchObject({
      supportWhatsapp: '5548999040445',
    });
  });

  it('o posto diz se já tem rede no portal', async () => {
    const a = (await http().get(`/v1/stations/${free}`).expect(200))
      .body as Station;
    const b = (await http().get(`/v1/stations/${managed}`).expect(200))
      .body as Station;
    expect(a.managed).toBe(false);
    expect(b.managed).toBe(true);
  });

  it('o pedido pelo link do app chega com o posto e a origem', async () => {
    const station = (
      await http()
        .get(`/v1/claims/stations/${free}`)
        .set(auth(owner))
        .expect(200)
    ).body as ClaimableStation;
    expect(station).toMatchObject({
      id: free,
      name: 'Posto Roraima',
      cnpj: '61.000.000/0001-01',
    });
    await http()
      .get(`/v1/claims/stations/${randomUUID()}`)
      .set(auth(owner))
      .expect(404);

    await http()
      .post('/v1/claims')
      .set(auth(owner))
      .send({
        stationId: free,
        contactName: 'Dono Roraima',
        phone: '(95) 99999-0000',
        position: 'dono',
        origin: 'app_dono',
      })
      .expect(201);
    const queue = (
      await http()
        .get('/v1/admin/claims?status=em_analise')
        .set(auth(admin))
        .expect(200)
    ).body as AdminClaim[];
    expect(queue.find((c) => c.station.id === free)).toMatchObject({
      origin: 'app_dono',
    });
  });

  it('sem origem, o pedido conta como do portal', async () => {
    const other = await login('Gerente Roraima');
    await http()
      .post('/v1/claims')
      .set(auth(other))
      .send({
        stationId: free,
        contactName: 'Gerente Roraima',
        phone: '(95) 98888-0000',
        position: 'gerente',
      })
      .expect(201);
    const queue = (
      await http()
        .get('/v1/admin/claims?status=em_analise')
        .set(auth(admin))
        .expect(200)
    ).body as AdminClaim[];
    expect(queue.find((c) => c.account.id === other.user.id)?.origin).toBe(
      'portal',
    );
  });
});
