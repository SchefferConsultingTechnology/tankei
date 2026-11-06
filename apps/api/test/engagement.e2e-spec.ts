import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  Contribution,
  LoginResponse,
  PriceAlert,
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
import {
  favoriteStations,
  priceAlerts,
  stationFuels,
  stations,
} from './../src/database/schema';
import { MailService } from './../src/mail/mail.service';
import type { MailMessage } from './../src/mail/templates';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (PB), CNPJs (6000…) e coordenadas próprios.
describe('Favoritos, alertas e contribuição (ADR 0029) (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  let app: INestApplication<App>;
  let db: Database;
  let driver: LoginResponse;
  let owner: LoginResponse;
  let stationId = '';
  const sent: { to: string[]; message: MailMessage }[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });

  async function login(name: string, withEmail = true) {
    const subject = `e2e-${randomUUID()}`;
    const res = await http()
      .post('/v1/auth/login')
      .send({
        provider: 'google',
        idToken: google.sign(
          subject,
          withEmail
            ? { email: `${subject}@example.com`, email_verified: true }
            : {},
        ),
        name,
      })
      .expect(200);
    return res.body as LoginResponse;
  }

  async function mailsWith(subjectPart: string, atLeast = 1) {
    const find = () =>
      sent.filter((m) => m.message.subject.includes(subjectPart));
    for (let i = 0; i < 50 && find().length < atLeast; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return find();
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

    const [row] = await db
      .insert(stations)
      .values({
        cnpj: '60000000000101',
        legalName: 'POSTO PARAIBA LTDA',
        tradeName: 'Posto Paraíba',
        brand: 'BANDEIRA BRANCA',
        address: 'RUA DAS FLORES, 10',
        city: 'JOAO PESSOA',
        state: 'PB',
        location: sql`ST_SetSRID(ST_MakePoint(-34.86, -7.12), 4326)`,
      })
      .returning({ id: stations.id });
    stationId = row.id;
    await db
      .insert(stationFuels)
      .values({ stationId, fuelType: 'gasolina_comum' });

    driver = await login('Motorista Alerta');
    owner = await login('Dono Paraíba');
    await addToNetwork(db, owner.user.id, [stationId]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('favorita, lista com preços e desfavorita', async () => {
    await http()
      .put(`/v1/me/favorites/${stationId}`)
      .set(auth(driver))
      .expect(204);
    // Repetir não duplica.
    await http()
      .put(`/v1/me/favorites/${stationId}`)
      .set(auth(driver))
      .expect(204);
    const list = await http()
      .get('/v1/me/favorites')
      .set(auth(driver))
      .expect(200);
    expect((list.body as Station[]).map((s) => s.id)).toEqual([stationId]);

    await http()
      .put(`/v1/me/favorites/${randomUUID()}`)
      .set(auth(driver))
      .expect(404);
    await http()
      .delete(`/v1/me/favorites/${stationId}`)
      .set(auth(driver))
      .expect(204);
    expect(
      (await http().get('/v1/me/favorites').set(auth(driver)).expect(200)).body,
    ).toEqual([]);
  });

  it('alerta avisa por e-mail quando o preço fica abaixo, sem repetir no intervalo', async () => {
    const created = await http()
      .post('/v1/me/alerts')
      .set(auth(driver))
      .send({ stationId, fuelType: 'gasolina_comum', maxPrice: 6.0 })
      .expect(201);
    expect(created.body as PriceAlert).toMatchObject({
      station: { id: stationId, name: 'Posto Paraíba' },
      maxPrice: 6,
      currentPrice: null,
    });
    await http()
      .post('/v1/me/alerts')
      .set(auth(driver))
      .send({ stationId, fuelType: 'gasolina_comum', maxPrice: 5.5 })
      .expect(409);

    // Acima do limite: nada.
    await http()
      .post(`/v1/stations/${stationId}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'gasolina_comum', price: 6.29, confirmed: true })
      .expect(201);
    // Abaixo: e-mail.
    await http()
      .post(`/v1/stations/${stationId}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'gasolina_comum', price: 5.89, confirmed: true })
      .expect(201);
    const [mail] = await mailsWith('Posto Paraíba');
    expect(mail.to).toEqual([driver.user.email]);
    expect(mail.message.text.replace(/\u00a0/g, ' ')).toContain(
      'Gasolina comum está a R$ 5,89',
    );

    // Outra baixa no mesmo dia: não repete.
    await http()
      .post(`/v1/stations/${stationId}/prices`)
      .set(auth(owner))
      .send({ fuelType: 'gasolina_comum', price: 5.79, confirmed: true })
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await mailsWith('Posto Paraíba')).toHaveLength(1);

    const alerts = (
      await http().get('/v1/me/alerts').set(auth(driver)).expect(200)
    ).body as PriceAlert[];
    expect(alerts[0]).toMatchObject({ currentPrice: 5.79 });
    expect(alerts[0].lastNotifiedAt).not.toBeNull();
  });

  it('conta sem e-mail não cria alerta', async () => {
    const noEmail = await login('Sem E-mail', false);
    const res = await http()
      .post('/v1/me/alerts')
      .set(auth(noEmail))
      .send({ stationId, fuelType: 'gasolina_comum', maxPrice: 6 })
      .expect(400);
    expect((res.body as { message: string }).message).toContain('e-mail');
  });

  it('mostra a contribuição de quem informa', async () => {
    await http()
      .post(`/v1/stations/${stationId}/prices`)
      .set(auth(driver))
      .send({ fuelType: 'gasolina_comum', price: 5.79, confirmed: true })
      .expect(201);
    const res = await http()
      .get('/v1/me/contribution')
      .set(auth(driver))
      .expect(200);
    // Banco de testes com peso neutro: a conta já é confiável.
    expect(res.body as Contribution).toMatchObject({
      level: 'colaborador',
      acceptedReports: 1,
      reportsLast30Days: 1,
      stationsHelped: 1,
      nextLevel: {
        level: 'informante_confiavel',
        missing: 'Faltam 19 preços aceitos.',
      },
    });
  });

  it('excluir a conta apaga favoritos e alertas', async () => {
    const leaving = await login('Vai Sair');
    await http()
      .put(`/v1/me/favorites/${stationId}`)
      .set(auth(leaving))
      .expect(204);
    await http()
      .post('/v1/me/alerts')
      .set(auth(leaving))
      .send({ stationId, fuelType: 'gasolina_comum', maxPrice: 6 })
      .expect(201);
    await http().delete('/v1/me').set(auth(leaving)).expect(204);
    expect(
      await db
        .select()
        .from(favoriteStations)
        .where(eq(favoriteStations.userId, leaving.user.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(priceAlerts)
        .where(eq(priceAlerts.userId, leaving.user.id)),
    ).toEqual([]);
  });
});
