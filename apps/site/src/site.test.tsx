import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildSite } from './build';
import { loadConfig } from './config';

function build(env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tankei-site-'));
  const config = loadConfig({
    SITE_URL: 'https://site.test/',
    PORTAL_URL: 'https://portal.test',
    ...env,
  });
  buildSite(config, dir);
  const read = (file: string) => readFileSync(join(dir, file), 'utf8');
  return { dir, read };
}

const PAGES = [
  'index.html',
  'como-funciona/index.html',
  'para-postos/index.html',
  'privacidade/index.html',
  'termos/index.html',
  '404.html',
];

describe('site oficial', () => {
  it('gera todas as páginas, sem JavaScript executável', () => {
    const { read } = build();
    for (const page of PAGES) {
      const html = read(page);
      assert.match(html, /^<!doctype html><html lang="pt-BR">/);
      // Só dados estruturados (JSON-LD), que o navegador não executa.
      const scripts = html.match(/<script[^>]*>/g) ?? [];
      for (const tag of scripts) {
        assert.equal(tag, '<script type="application/ld+json">', page);
      }
    }
  });

  it('dados estruturados válidos em cada página', () => {
    const { read } = build({ CONTACT_EMAIL: 'contato@site.test' });
    const types = (page: string) =>
      [
        ...read(page).matchAll(
          /<script type="application\/ld\+json">(.*?)<\/script>/g,
        ),
      ].map(([, json]) => (JSON.parse(json) as { '@type': string })['@type']);
    assert.deepEqual(types('index.html'), ['Organization', 'WebSite']);
    assert.deepEqual(types('como-funciona/index.html'), [
      'FAQPage',
      'BreadcrumbList',
    ]);
    assert.deepEqual(types('para-postos/index.html'), ['BreadcrumbList']);
    assert.deepEqual(types('404.html'), []);
    assert.match(read('index.html'), /"email":"contato@site.test"/);
  });

  it('sitemap com a data do build', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tankei-site-'));
    buildSite(
      loadConfig({ SITE_URL: 'https://site.test', SITE_INDEXING: '1' }),
      dir,
      new Date('2026-11-16T12:00:00Z'),
    );
    assert.match(
      readFileSync(join(dir, 'sitemap.xml'), 'utf8'),
      /<loc>https:\/\/site.test\/<\/loc><lastmod>2026-11-16<\/lastmod>/,
    );
  });

  it('todo link interno aponta para uma página ou arquivo gerado', () => {
    const { dir, read } = build();
    for (const page of PAGES) {
      for (const [, href] of read(page).matchAll(/(?:href|src)="(\/[^"#]*)/g)) {
        const file = href.endsWith('/') ? `${href}index.html` : href;
        assert.ok(existsSync(join(dir, file)), `${page}: ${href} não existe`);
      }
    }
  });

  it('fora do Google sem SITE_INDEXING', () => {
    const { read } = build();
    assert.match(
      read('index.html'),
      /<meta name="robots" content="noindex"\/>/,
    );
    assert.equal(read('robots.txt'), 'User-agent: *\nDisallow: /\n');
    assert.doesNotMatch(read('sitemap.xml'), /<loc>/);
  });

  it('com SITE_INDEXING=1, sitemap com as páginas e canonical sem barra dupla', () => {
    const { read } = build({ SITE_INDEXING: '1' });
    assert.doesNotMatch(read('index.html'), /noindex/);
    assert.match(read('404.html'), /noindex/);
    assert.match(
      read('sitemap.xml'),
      /<loc>https:\/\/site.test\/para-postos\/<\/loc>/,
    );
    assert.match(
      read('robots.txt'),
      /Sitemap: https:\/\/site.test\/sitemap.xml/,
    );
    assert.match(
      read('como-funciona/index.html'),
      /<link rel="canonical" href="https:\/\/site.test\/como-funciona\/"\/>/,
    );
  });

  it('pedido de acesso do posto com a origem "site" (ADR 0031)', () => {
    const { read } = build();
    assert.match(
      read('para-postos/index.html'),
      /href="https:\/\/portal.test\/acesso\?origem=site"/,
    );
  });

  it('WhatsApp e contato só quando configurados', () => {
    assert.doesNotMatch(build().read('para-postos/index.html'), /wa\.me/);
    const { read } = build({
      SUPPORT_WHATSAPP: '5548999999999',
      CONTACT_EMAIL: 'contato@site.test',
    });
    assert.match(
      read('para-postos/index.html'),
      /https:\/\/wa\.me\/5548999999999\?text=/,
    );
    assert.match(read('privacidade/index.html'), /mailto:contato@site\.test/);
  });

  it('privacidade e termos marcados como minuta', () => {
    const { read } = build();
    for (const page of ['privacidade/index.html', 'termos/index.html']) {
      assert.match(read(page), /Minuta em revisão jurídica/);
    }
  });

  it('mesmos textos de "Como funciona" do app (help.ts)', () => {
    const html = build().read('como-funciona/index.html');
    assert.match(html, /De onde vêm os preços/);
    assert.match(html, /IQP: Índice de Qualidade do Posto/);
  });
});
