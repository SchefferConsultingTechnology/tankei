import type { SiteConfig } from './config';

/**
 * Dados estruturados schema.org (JSON-LD) do site oficial (ADR 0043). Ajudam
 * o Google a entender quem é o Tankei e cada página. São dados, não código:
 * o navegador não executa um <script type="application/ld+json">.
 */

export type JsonLd = Record<string, unknown>;

/** Quem publica o site: a organização Tankei. */
export function organizationLd(config: SiteConfig): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${config.url}/#organizacao`,
    name: 'Tankei',
    url: `${config.url}/`,
    logo: `${config.url}/apple-touch-icon.png`,
    description:
      'Preços de combustível e qualidade dos postos, informados pelos próprios postos e por motoristas.',
    ...(config.contactEmail
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: config.contactEmail,
            availableLanguage: 'Portuguese',
          },
        }
      : {}),
  };
}

/** O site como um todo, em português do Brasil. */
export function websiteLd(config: SiteConfig): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${config.url}/#site`,
    name: 'Tankei',
    url: `${config.url}/`,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${config.url}/#organizacao` },
  };
}

/** Trilha de navegação: Início › página. */
export function breadcrumbLd(
  config: SiteConfig,
  items: { name: string; path: string }[],
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${config.url}${item.path}`,
    })),
  };
}

/** Perguntas frequentes, com as mesmas respostas que aparecem na página. */
export function faqLd(items: { q: string; a: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** JSON para dentro de <script>: escapa "<" e separadores de linha. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}
