import { z } from 'zod';

/**
 * Site do posto (spec 0004, ADR 0042). Primeira entrega: a página básica de
 * todo posto em /p/<slug>, montada com os dados da plataforma.
 */

/** Caminho das páginas dos postos, fora do prefixo /v1 da API. */
export const SITE_PATH_PREFIX = '/p/';

/** Tamanho máximo do slug, para o endereço caber numa placa ou adesivo. */
export const SITE_SLUG_MAX_LENGTH = 80;

/** "Auto Posto São João" → "auto-posto-sao-joao". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slug automático: nome no app e cidade ("posto-zulu-curitibanos"). A cidade
 * não se repete quando já está no nome ("centro-automotivo-curitibanos").
 */
export function stationSlugBase(name: string, city: string): string {
  const namePart = slugify(name) || 'posto';
  const cityPart = slugify(city);
  const withCity =
    !cityPart || `-${namePart}-`.includes(`-${cityPart}-`)
      ? namePart
      : `${namePart}-${cityPart}`;
  return withCity.slice(0, SITE_SLUG_MAX_LENGTH).replace(/-+$/, '');
}

/** Endereço público da página do posto. */
export const stationSiteSchema = z.object({
  slug: z.string(),
  url: z.string().describe('Endereço completo da página do posto.'),
});
export type StationSite = z.infer<typeof stationSiteSchema>;
