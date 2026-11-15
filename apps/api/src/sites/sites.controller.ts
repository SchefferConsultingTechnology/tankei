import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { stationSiteSchema, type StationSite } from '@tankei/shared';
import type { Request, Response } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { Public } from '../auth/decorators';
import { renderStationPage, renderUnavailablePage } from './render/page';
import { siteUrl, SitesService } from './sites.service';

class StationSiteDto extends createZodDto(stationSiteSchema) {}

/** Slug válido: letras minúsculas sem acento, números e hífens. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/**
 * Sem script nenhum na página: o texto do posto nunca é executado (spec
 * 0004, critério 5). Estilos inline são da própria página.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  'img-src https: data:',
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

/** Endereço base das páginas: SITE_URL ou, sem ela, o da própria requisição. */
function baseUrl(req: Request): string {
  return process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
}

/** Só homologação e produção aparecem no Google (ADR 0036). */
function indexing(): boolean {
  return process.env.SITE_INDEXING === '1';
}

/**
 * Página pública do posto (spec 0004, ADR 0042), fora do prefixo /v1: o HTML
 * sai pronto do servidor, para o Google e a prévia do WhatsApp.
 */
@ApiExcludeController()
@Public()
@Controller()
export class SitePagesController {
  constructor(private readonly sites: SitesService) {}

  @Get('p/:slug')
  async page(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const base = baseUrl(req);
    const result = SLUG_PATTERN.test(slug)
      ? await this.sites.lookup(slug)
      : ({ kind: 'not_found' } as const);

    res.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.set('X-Content-Type-Options', 'nosniff');
    if (!indexing()) res.set('X-Robots-Tag', 'noindex');

    if (result.kind === 'redirect') {
      res.redirect(301, siteUrl(base, result.slug));
      return;
    }
    if (result.kind === 'not_found') {
      res
        .status(404)
        .set('Cache-Control', 'no-store')
        .type('html')
        .send(renderUnavailablePage());
      return;
    }
    const seconds = await this.sites.cacheSeconds();
    res
      .status(200)
      .set('Cache-Control', `public, max-age=${seconds}`)
      .type('html')
      .send(
        renderStationPage(result.data, {
          url: siteUrl(base, result.data.slug),
          indexing: indexing(),
        }),
      );
  }

  @Get('sitemap.xml')
  async sitemap(@Req() req: Request, @Res() res: Response): Promise<void> {
    const base = baseUrl(req);
    const entries = indexing() ? await this.sites.sitemapEntries() : [];
    const urls = entries
      .map((e) => `  <url><loc>${escapeXml(siteUrl(base, e.slug))}</loc></url>`)
      .join('\n');
    res
      .set('Cache-Control', 'public, max-age=3600')
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${urls ? '\n' : ''}</urlset>\n`,
      );
  }

  @Get('robots.txt')
  robots(@Req() req: Request, @Res() res: Response): void {
    const body = indexing()
      ? `User-agent: *\nAllow: /p/\nDisallow: /v1/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n';
    res
      .set('Cache-Control', 'public, max-age=3600')
      .type('text/plain')
      .send(body);
  }
}

@ApiTags('Postos')
@Public()
@Controller('stations/:id/site')
export class StationSiteController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: StationSiteDto,
    description:
      'Endereço da página pública do posto (spec 0004), para compartilhar.',
  })
  site(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Posto inválido.'),
      }),
    )
    id: string,
    @Req() req: Request,
  ): Promise<StationSite> {
    return this.sites.siteFor(id, baseUrl(req));
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
