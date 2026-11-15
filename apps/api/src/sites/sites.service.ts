import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SITE_PATH_PREFIX,
  stationSlugBase,
  type Station,
  type StationIqp,
  type StationShowcase,
  type StationSite,
} from '@tankei/shared';
import { and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  stationFeatureChanges,
  stationSiteSlugs,
  stations,
} from '../database/schema';
import { IqpService } from '../iqp/iqp.service';
import { ParametersService } from '../parameters/parameters.service';
import { ShowcaseService } from '../showcase/showcase.service';
import { StationsService } from '../stations/stations.service';

/** Dados da página do posto, como o app os vê (spec 0004). */
export interface StationPageData {
  station: Station;
  iqp: StationIqp;
  showcase: StationShowcase;
  slug: string;
}

/** Resultado da busca pelo endereço da página. */
export type SiteLookup =
  | { kind: 'page'; data: StationPageData }
  | { kind: 'redirect'; slug: string }
  | { kind: 'not_found' };

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Página pública do posto (spec 0004, ADR 0042). É uma vitrine do que já está
 * na plataforma: os dados vêm dos mesmos serviços do app, com as mesmas
 * regras (modo de exibição, preços, IQP).
 */
@Injectable()
export class SitesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly stations: StationsService,
    private readonly iqp: IqpService,
    private readonly showcase: ShowcaseService,
    private readonly parameters: ParametersService,
  ) {}

  /** Endereço público da página do posto; cria o slug na primeira vez. */
  async siteFor(stationId: string, baseUrl: string): Promise<StationSite> {
    const station = await this.stations.findById(stationId);
    const slug = await this.currentSlug(station);
    return { slug, url: siteUrl(baseUrl, slug) };
  }

  /**
   * Página pelo slug. Um slug antigo do posto (nome mudou) redireciona para o
   * atual. Posto oculto ou inativo não tem página.
   */
  async lookup(slug: string): Promise<SiteLookup> {
    const [row] = await this.db
      .select({ stationId: stationSiteSlugs.stationId })
      .from(stationSiteSlugs)
      .where(eq(stationSiteSlugs.slug, slug));
    if (!row) return { kind: 'not_found' };

    let station: Station;
    try {
      station = await this.stations.findById(row.stationId);
    } catch (error) {
      if (error instanceof NotFoundException) return { kind: 'not_found' };
      throw error;
    }
    const current = await this.currentSlug(station);
    if (current !== slug) return { kind: 'redirect', slug: current };

    const [iqp, showcase] = await Promise.all([
      this.iqp.detail(station.id),
      this.showcase.showcase(station.id),
    ]);
    return { kind: 'page', data: { station, iqp, showcase, slug } };
  }

  /**
   * Páginas que entram no sitemap.xml: só postos com o recurso "site"
   * liberado (spec 0004). As demais existem, mas não são anunciadas ao Google.
   */
  async sitemapEntries(): Promise<{ slug: string }[]> {
    const latest = this.db
      .selectDistinctOn([stationFeatureChanges.stationId], {
        stationId: stationFeatureChanges.stationId,
        active: stationFeatureChanges.active,
      })
      .from(stationFeatureChanges)
      .where(eq(stationFeatureChanges.feature, 'site'))
      .orderBy(
        stationFeatureChanges.stationId,
        desc(stationFeatureChanges.createdAt),
      )
      .as('latest');
    const rows = await this.db
      .select({ stationId: latest.stationId })
      .from(latest)
      .innerJoin(stations, eq(stations.id, latest.stationId))
      .where(
        and(
          eq(latest.active, true),
          eq(stations.active, true),
          ne(stations.displayMode, 'oculto'),
        ),
      );
    const list = await this.stations.findByIds(rows.map((r) => r.stationId));
    const entries: { slug: string }[] = [];
    for (const station of list) {
      entries.push({ slug: await this.currentSlug(station) });
    }
    return entries.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  cacheSeconds(): Promise<number> {
    return this.parameters.get('site.cache_seconds');
  }

  /**
   * Slug atual do posto. Escolhido pelo posto ou pela equipe: o mais recente.
   * Automático: segue o nome no app e a cidade; se o nome muda, ganha um slug
   * novo e o antigo passa a redirecionar.
   */
  private async currentSlug(station: Station): Promise<string> {
    const own = await this.db
      .select({ slug: stationSiteSlugs.slug, source: stationSiteSlugs.source })
      .from(stationSiteSlugs)
      .where(eq(stationSiteSlugs.stationId, station.id))
      .orderBy(desc(stationSiteSlugs.createdAt));
    const chosen = own.find((row) => row.source !== 'auto');
    if (chosen) return chosen.slug;

    const base = stationSlugBase(station.name, station.city);
    const matching = own
      .map((row) => row.slug)
      .filter((slug) => slug === base || isNumbered(slug, base));
    if (matching.length > 0) return matching[matching.length - 1];

    return this.createAutoSlug(station.id, base);
  }

  /** Primeiro slug livre: base, base-2, base-3... */
  private async createAutoSlug(stationId: string, base: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await this.db
        .select({
          slug: stationSiteSlugs.slug,
          stationId: stationSiteSlugs.stationId,
        })
        .from(stationSiteSlugs)
        .where(
          or(
            eq(stationSiteSlugs.slug, base),
            sql`${stationSiteSlugs.slug} ~ ${`^${escapeRegex(base)}-[0-9]+$`}`,
          ),
        )
        .orderBy(asc(stationSiteSlugs.createdAt));
      // Outra requisição pode ter criado o slug deste posto agora mesmo.
      const mine = taken.find((row) => row.stationId === stationId);
      if (mine) return mine.slug;

      const used = new Set(taken.map((row) => row.slug));
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      try {
        await this.db
          .insert(stationSiteSlugs)
          .values({ stationId, slug, source: 'auto' });
        return slug;
      } catch (error) {
        if (uniqueViolation(error)) continue;
        throw error;
      }
    }
    throw new Error(`Não foi possível criar o endereço do posto ${stationId}.`);
  }
}

/** Endereço completo da página: https://.../p/<slug>. */
export function siteUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${SITE_PATH_PREFIX}${slug}`;
}

function isNumbered(slug: string, base: string): boolean {
  return (
    slug.startsWith(`${base}-`) && /^\d+$/.test(slug.slice(base.length + 1))
  );
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string }; code?: string }) ?? {};
  return (
    cause.code === PG_UNIQUE_VIOLATION ||
    cause.cause?.code === PG_UNIQUE_VIOLATION
  );
}
