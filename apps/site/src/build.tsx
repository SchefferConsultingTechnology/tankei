import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadConfig, type SiteConfig } from './config';
import { HomePage } from './pages/home';
import { HowItWorksPage } from './pages/how-it-works';
import { PrivacyPage, TermsPage } from './pages/legal';
import { NotFoundPage } from './pages/not-found';
import { StationsPage } from './pages/stations';

/** Páginas publicadas: caminho e componente. "/x/" vira dist/x/index.html. */
export function sitePages(config: SiteConfig): [string, ReactElement][] {
  return [
    ['/', <HomePage config={config} />],
    ['/como-funciona/', <HowItWorksPage config={config} />],
    ['/para-postos/', <StationsPage config={config} />],
    ['/privacidade/', <PrivacyPage config={config} />],
    ['/termos/', <TermsPage config={config} />],
  ];
}

export function renderPage(element: ReactElement): string {
  return `<!doctype html>${renderToStaticMarkup(element)}`;
}

function sitemap(config: SiteConfig, paths: string[]): string {
  const urls = paths
    .map((path) => `  <url><loc>${config.url}${path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robots(config: SiteConfig): string {
  return config.indexing
    ? `User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

/** Gera o site estático em outDir (ADR 0043). */
export function buildSite(config: SiteConfig, outDir: string): string[] {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(__dirname, '..', 'public'), outDir, { recursive: true });

  const written: string[] = [];
  const write = (file: string, content: string) => {
    const target = join(outDir, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    written.push(file);
  };

  const pages = sitePages(config);
  for (const [path, element] of pages) {
    write(join(path, 'index.html'), renderPage(element));
  }
  write('404.html', renderPage(<NotFoundPage config={config} />));
  // O sitemap só lista as páginas quando a indexação está ligada.
  write(
    'sitemap.xml',
    sitemap(config, config.indexing ? pages.map(([path]) => path) : []),
  );
  write('robots.txt', robots(config));
  return written;
}

if (require.main === module) {
  const config = loadConfig();
  const files = buildSite(config, join(__dirname, '..', 'dist'));
  console.log(
    `Site gerado em dist/ (${files.length} arquivos) para ${config.url}${config.indexing ? '' : ', sem indexação'}.`,
  );
}
