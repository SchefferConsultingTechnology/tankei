import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AdminMedia,
  LoginResponse,
  ParameterKey,
  Promotion,
  Station,
  StationPhoto,
  StationPhotos,
  StationPromotion,
  StationShowcase,
} from '@tankei/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
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
import { ParametersService } from './../src/parameters/parameters.service';
import { StorageService } from './../src/showcase/storage.service';
import { createFakeIdentityProvider } from './support/fake-identity-provider';
import { addToNetwork } from './support/network';

// Banco compartilhado: UF (RN), CNPJs (5700…) e coordenadas próprios.
// Armazenamento em memória no lugar do S3.
const ORIGIN = { lat: -5.79, lng: -35.21 };

class MemoryStorage {
  readonly objects = new Map<string, { body: Buffer; type: string }>();
  enabled = true;
  put(key: string, body: Buffer, type: string) {
    this.objects.set(key, { body, type });
    return Promise.resolve();
  }
  remove(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
  publicUrl(key: string) {
    return `https://imagens.test/${key}`;
  }
  onApplicationBootstrap() {
    return Promise.resolve();
  }
}

describe('Vitrine do posto: fotos e promoções (e2e)', () => {
  const google = createFakeIdentityProvider('google');
  const storage = new MemoryStorage();
  let app: INestApplication<App>;
  let db: Database;
  let admin: LoginResponse;
  let owner: LoginResponse;
  let operator: LoginResponse;
  let stationId = '';
  let jpeg: Buffer;
  const overrides: Partial<Record<ParameterKey, number>> = {};

  const http = () => request(app.getHttpServer());
  const auth = (who: LoginResponse) => ({
    Authorization: `Bearer ${who.accessToken}`,
  });
  const portal = (path: string) => `/v1/portal/stations/${stationId}${path}`;
  const keyOf = (url: string) => url.replace('https://imagens.test/', '');

  async function login(name: string, subject = `e2e-${randomUUID()}`) {
    const res = await http()
      .post('/v1/auth/login')
      .send({ provider: 'google', idToken: google.sign(subject), name })
      .expect(200);
    return { body: res.body as LoginResponse, subject };
  }

  async function showcase() {
    const res = await http()
      .get(`/v1/stations/${stationId}/showcase`)
      .expect(200);
    return res.body as StationShowcase;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IDENTITY_VERIFIERS)
      .useValue({ google: google.verifier, apple: null })
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DRIZZLE);

    const parameters = app.get(ParametersService);
    const original = parameters.get.bind(parameters);
    jest
      .spyOn(parameters, 'get')
      .mockImplementation(((key: ParameterKey) =>
        key in overrides
          ? Promise.resolve(overrides[key])
          : original(key)) as typeof parameters.get);

    const [row] = await db
      .insert(stations)
      .values({
        cnpj: '57000000000101',
        legalName: 'POSTO VITRINE LTDA',
        brand: 'BANDEIRA BRANCA',
        address: 'RUA TESTE, 1',
        city: 'NATAL',
        state: 'RN',
        location: sql`ST_SetSRID(ST_MakePoint(${ORIGIN.lng}, ${ORIGIN.lat}), 4326)`,
      })
      .returning({ id: stations.id });
    stationId = row.id;
    await db.insert(stationFuels).values([
      { stationId, fuelType: 'gasolina_comum' },
      { stationId, fuelType: 'etanol' },
    ]);

    const adminLogin = await login('Admin Vitrine');
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, adminLogin.body.user.id));
    admin = (await login('Admin Vitrine', adminLogin.subject)).body;
    owner = (await login('Dona Vitrine')).body;
    operator = (await login('Operador Vitrine')).body;
    const networkId = await addToNetwork(db, owner.user.id, [stationId]);
    await db.insert(organizationMembers).values({
      organizationId: networkId,
      userId: operator.user.id,
      role: 'operador',
      scope: 'todas',
    });

    // Foto grande, com metadados (como a de um celular).
    jpeg = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#c33' },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Dona Vitrine' } })
      .toBuffer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('fotos', () => {
    let photo: StationPhoto;

    it('publica reduzida, em WebP e sem metadados', async () => {
      const res = await http()
        .post(portal('/photos'))
        .set(auth(owner))
        .field('caption', 'Fachada')
        .attach('file', jpeg, {
          filename: 'fachada.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      photo = res.body as StationPhoto;
      expect(photo).toMatchObject({
        caption: 'Fachada',
        width: 1600,
        height: 1067,
      });

      const stored = storage.objects.get(keyOf(photo.url));
      expect(stored?.type).toBe('image/webp');
      const meta = await sharp(stored!.body).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();

      expect((await showcase()).photos).toEqual([
        expect.objectContaining({ id: photo.id, caption: 'Fachada' }),
      ]);
    });

    it('recusa quem não gerencia promoções, arquivo que não é imagem e acima do tamanho', async () => {
      await http()
        .post(portal('/photos'))
        .set(auth(operator))
        .attach('file', jpeg, 'a.jpg')
        .expect(403);

      const text = await http()
        .post(portal('/photos'))
        .set(auth(owner))
        .attach('file', Buffer.from('não sou imagem'), 'falsa.jpg')
        .expect(400);
      expect((text.body as { message: string }).message).toBe(
        'Imagem inválida. Use JPG, PNG ou WebP.',
      );

      const big = await http()
        .post(portal('/photos'))
        .set(auth(owner))
        .attach('file', Buffer.alloc(6 * 1024 * 1024, 1), 'grande.jpg')
        .expect(413);
      expect((big.body as { message: string }).message).toBe(
        'A imagem pode ter no máximo 5 MB.',
      );
    });

    it('respeita o limite de fotos do parâmetro', async () => {
      overrides['media.max_station_photos'] = 1;
      const res = await http()
        .post(portal('/photos'))
        .set(auth(owner))
        .attach('file', jpeg, 'b.jpg')
        .expect(409);
      expect((res.body as { message: string }).message).toContain(
        'O posto já tem 1 fotos',
      );
      delete overrides['media.max_station_photos'];
    });

    it('a equipe Tankei remove com motivo; o posto vê o motivo', async () => {
      const queue = await http()
        .get('/v1/admin/media')
        .set(auth(admin))
        .expect(200);
      expect(queue.body as AdminMedia[]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'foto',
            id: photo.id,
            uploadedBy: 'Dona Vitrine',
            removed: null,
          }),
        ]),
      );

      await http()
        .post(`/v1/admin/media/photos/${photo.id}/remove`)
        .set(auth(admin))
        .send({ reason: 'Aparece a placa de um carro.' })
        .expect(204);
      expect(storage.objects.has(keyOf(photo.url))).toBe(false);
      expect((await showcase()).photos).toEqual([]);

      const mine = await http()
        .get(portal('/photos'))
        .set(auth(owner))
        .expect(200);
      expect(mine.body as StationPhotos).toMatchObject({
        maxPhotos: 10,
        maxUploadMb: 5,
        photos: [],
        removedByTankei: [
          { id: photo.id, reason: 'Aparece a placa de um carro.' },
        ],
      });
    });

    it('o posto remove a própria foto', async () => {
      const res = await http()
        .post(portal('/photos'))
        .set(auth(owner))
        .attach('file', jpeg, 'c.jpg')
        .expect(201);
      await http()
        .delete(portal(`/photos/${(res.body as StationPhoto).id}`))
        .set(auth(owner))
        .expect(204);
      expect((await showcase()).photos).toEqual([]);
    });
  });

  describe('promoções', () => {
    let promotion: Promotion;
    const hours = (h: number) =>
      new Date(Date.now() + h * 3_600_000).toISOString();

    async function currentPrice(fuel: string) {
      const res = await http().get(`/v1/stations/${stationId}`).expect(200);
      return (res.body as Station).prices.find((p) => p.fuelType === fuel);
    }

    it('cria com preço promocional, que vale no app com o título', async () => {
      const res = await http()
        .post(portal('/promotions'))
        .set(auth(owner))
        .send({
          title: 'Semana do motorista',
          description: 'Lavagem grátis no abastecimento acima de 30 litros.',
          startsAt: hours(-1),
          endsAt: hours(48),
          prices: [{ fuelType: 'gasolina_comum', price: 5.99 }],
        })
        .expect(201);
      promotion = res.body as Promotion;
      expect(promotion).toMatchObject({
        status: 'vigente',
        imageUrl: null,
        prices: [{ fuelType: 'gasolina_comum', price: 5.99 }],
      });
      expect(await currentPrice('gasolina_comum')).toMatchObject({
        price: 5.99,
        badge: 'promocao',
        promotion: { label: 'Semana do motorista' },
      });
    });

    it('preço muito diferente do atual pede confirmação', async () => {
      await http()
        .post(`/v1/stations/${stationId}/prices`)
        .set(auth(owner))
        .send({ fuelType: 'etanol', price: 4.29 })
        .expect(201);
      const body = {
        title: 'Etanol relâmpago',
        startsAt: hours(-1),
        endsAt: hours(5),
        prices: [{ fuelType: 'etanol', price: 3.0 }],
      };
      const first = await http()
        .post(portal('/promotions'))
        .set(auth(owner))
        .send(body)
        .expect(409);
      expect(first.body).toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
      expect((first.body as { message: string }).message).toContain('Etanol:');

      await http()
        .post(portal('/promotions'))
        .set(auth(owner))
        .send({ ...body, confirmed: true })
        .expect(201);
    });

    it('recusa duração acima do parâmetro e quem não gerencia promoções', async () => {
      const long = await http()
        .post(portal('/promotions'))
        .set(auth(owner))
        .send({
          title: 'Mês inteiro',
          startsAt: hours(0),
          endsAt: hours(24 * 30),
        })
        .expect(400);
      expect((long.body as { message: string }).message).toBe(
        'A promoção pode durar no máximo 7 dias.',
      );
      await http()
        .post(portal('/promotions'))
        .set(auth(operator))
        .send({ title: 'Sem permissão', startsAt: hours(0), endsAt: hours(5) })
        .expect(403);
    });

    it('agendada não aparece na vitrine; arte aparece na vigente', async () => {
      await http()
        .post(portal('/promotions'))
        .set(auth(owner))
        .send({
          title: 'Fim de semana',
          startsAt: hours(24),
          endsAt: hours(48),
        })
        .expect(201);

      const res = await http()
        .put(portal(`/promotions/${promotion.id}/image`))
        .set(auth(owner))
        .attach('file', jpeg, 'arte.jpg')
        .expect(200);
      expect((res.body as Promotion).imageUrl).toMatch(
        /^https:\/\/imagens\.test\//,
      );

      const titles = (await showcase()).promotions.map((p) => p.title);
      expect(titles).toContain('Semana do motorista');
      expect(titles).not.toContain('Fim de semana');
      const own = (
        await http().get(portal('/promotions')).set(auth(owner)).expect(200)
      ).body as StationPromotion[];
      expect(own.find((p) => p.title === 'Fim de semana')).toMatchObject({
        status: 'agendada',
        createdBy: 'Dona Vitrine',
      });
    });

    it('a equipe Tankei remove a arte, com motivo para o posto', async () => {
      await http()
        .post(`/v1/admin/media/promotions/${promotion.id}/remove-image`)
        .set(auth(admin))
        .send({ reason: 'Arte com marca de terceiro.' })
        .expect(204);
      const own = (
        await http().get(portal('/promotions')).set(auth(owner)).expect(200)
      ).body as StationPromotion[];
      expect(own.find((p) => p.id === promotion.id)).toMatchObject({
        imageUrl: null,
        imageRemovedReason: 'Arte com marca de terceiro.',
      });
    });

    it('encerrar antes: o preço promocional deixa de valer', async () => {
      const res = await http()
        .post(portal(`/promotions/${promotion.id}/end`))
        .set(auth(owner))
        .expect(200);
      expect((res.body as Promotion).status).toBe('encerrada');
      expect(await currentPrice('gasolina_comum')).toBeUndefined();
      expect((await showcase()).promotions.map((p) => p.id)).not.toContain(
        promotion.id,
      );
      await http()
        .post(portal(`/promotions/${promotion.id}/end`))
        .set(auth(owner))
        .expect(409);
    });
  });
});
