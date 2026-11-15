import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { StationSite } from '@tankei/shared';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { DRIZZLE, type Database } from './../src/database/database.module';
import {
  priceReports,
  stationFeatureChanges,
  stationFuels,
  stationSiteSlugs,
  stations,
} from './../src/database/schema';

// Banco compartilhado: CNPJs (6800…) e coordenadas (Rio Branco) só deste arquivo.
describe('Página do posto (spec 0004) (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  const http = () => request(app.getHttpServer());

  async function station(n: number, legalName: string) {
    const [row] = await db
      .insert(stations)
      .values({
        cnpj: `680000000${String(n).padStart(3, '0')}01`,
        legalName,
        brand: 'BANDEIRA BRANCA',
        address: 'RUA DO ACRE, 1',
        city: 'RIO BRANCO',
        state: 'AC',
        location: sql`ST_SetSRID(ST_MakePoint(${-67.8 - n / 100}, -9.97), 4326)`,
      })
      .returning({ id: stations.id });
    await db
      .insert(stationFuels)
      .values({ stationId: row.id, fuelType: 'gasolina_comum' });
    return row.id;
  }

  async function siteOf(id: string) {
    const res = await http().get(`/v1/stations/${id}/site`).expect(200);
    return res.body as StationSite;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DRIZZLE);
  });

  afterAll(async () => {
    delete process.env.SITE_INDEXING;
    await app.close();
  });

  it('cria o endereço pelo nome e pela cidade e abre a página', async () => {
    const id = await station(1, 'POSTO ACREANO LTDA');
    await db.insert(priceReports).values({
      stationId: id,
      fuelType: 'gasolina_comum',
      price: 6.89,
      source: 'posto',
    });

    const site = await siteOf(id);
    expect(site.slug).toBe('posto-acreano-rio-branco');
    expect(site.url).toMatch(/\/p\/posto-acreano-rio-branco$/);
    // De novo: o mesmo endereço, sem criar outro.
    expect((await siteOf(id)).slug).toBe(site.slug);

    const res = await http().get(`/p/${site.slug}`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('public, max-age=120');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(res.headers['x-robots-tag']).toBe('noindex');
    expect(res.text).toContain('<h1>Posto Acreano</h1>');
    expect(res.text).toContain('R$ 6,89');
    expect(res.text).toContain('"@type":"GasStation"');
  });

  it('nome repetido na cidade ganha número', async () => {
    const a = await station(2, 'POSTO GEMEO LTDA');
    const b = await station(3, 'POSTO GEMEO ME');
    expect((await siteOf(a)).slug).toBe('posto-gemeo-rio-branco');
    expect((await siteOf(b)).slug).toBe('posto-gemeo-rio-branco-2');
  });

  it('nome novo no app: endereço novo, e o antigo redireciona', async () => {
    const id = await station(4, 'COMERCIO DE COMBUSTIVEIS XAPURI LTDA');
    const old = await siteOf(id);

    await db
      .update(stations)
      .set({ displayName: 'Posto Seringal' })
      .where(eq(stations.id, id));
    const res = await http().get(`/p/${old.slug}`).expect(301);
    expect(res.headers.location).toMatch(/\/p\/posto-seringal-rio-branco$/);
    await http().get('/p/posto-seringal-rio-branco').expect(200);

    // Os dois endereços continuam do posto (tabela só de inserção).
    const rows = await db
      .select({ slug: stationSiteSlugs.slug })
      .from(stationSiteSlugs)
      .where(eq(stationSiteSlugs.stationId, id));
    expect(rows.map((r) => r.slug).sort()).toEqual([
      old.slug,
      'posto-seringal-rio-branco',
    ]);
  });

  it('endereço inexistente, inválido ou de posto oculto: página indisponível', async () => {
    const id = await station(5, 'POSTO SUMIDO LTDA');
    const site = await siteOf(id);
    await db
      .update(stations)
      .set({ displayMode: 'oculto' })
      .where(eq(stations.id, id));

    for (const path of [
      `/p/${site.slug}`,
      '/p/nao-existe-xyz',
      '/p/Inv%C3%A1lido',
    ]) {
      const res = await http().get(path).expect(404);
      expect(res.text).toContain('Página indisponível');
    }
  });

  it('sitemap só com postos que têm o site liberado, e só com indexação', async () => {
    const withSite = await station(6, 'POSTO ASSINANTE LTDA');
    const without = await station(7, 'POSTO SEM SITE LTDA');
    await db.insert(stationFeatureChanges).values({
      stationId: withSite,
      feature: 'site',
      active: true,
      source: 'equipe',
    });
    await siteOf(without);

    let res = await http().get('/sitemap.xml').expect(200);
    expect(res.text).not.toContain('<loc>');
    expect((await http().get('/robots.txt').expect(200)).text).toContain(
      'Disallow: /',
    );

    process.env.SITE_INDEXING = '1';
    res = await http().get('/sitemap.xml').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('/p/posto-assinante-rio-branco</loc>');
    expect(res.text).not.toContain('posto-sem-site');
    expect((await http().get('/robots.txt').expect(200)).text).toContain(
      'Sitemap: ',
    );
    delete process.env.SITE_INDEXING;
  });

  it('a API continua sob /v1', async () => {
    await http().get('/v1/health').expect(200);
    await http().get('/stations/nearby').expect(404);
  });
});
