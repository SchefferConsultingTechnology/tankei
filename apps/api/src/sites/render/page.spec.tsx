import {
  slugify,
  stationSlugBase,
  type Station,
  type StationIqp,
} from '@tankei/shared';
import type { StationPageData } from '../sites.service';
import { formatLocalDateTime, renderStationPage } from './page';
import { mapTiles, openingHoursSpecification, safeJson } from './seo';

const iqp: StationIqp = {
  score: 82,
  confidence: 'media',
  reviewers: 12,
  methodologyVersion: '1.0.0',
  computedAt: '2026-11-10T12:00:00.000Z',
  dimensions: [
    {
      dimension: 'atendimento_agilidade',
      label: 'Atendimento e agilidade',
      score: 90,
      weight: 25,
    },
  ],
};

function station(overrides: Partial<Station> = {}): Station {
  return {
    id: '7d1f3c1e-8a0b-4c55-9d5e-2f8a6b7c9d01',
    name: 'Posto Zulu',
    brand: 'Bandeira Branca',
    address: 'Rodovia BR-116, km 250',
    district: 'Centro',
    city: 'Curitibanos',
    state: 'SC',
    location: { lat: -27.28, lng: -50.58 },
    fuels: ['gasolina_comum', 'etanol'],
    prices: [
      {
        fuelType: 'gasolina_comum',
        price: 6.29,
        badge: 'atualizado_posto',
        stale: false,
        updatedAt: '2026-11-15T11:45:00.000Z',
        promotion: null,
        divergence: null,
        otherValueReported: false,
      },
    ],
    iqp: { score: 82, confidence: 'media', reviewers: 12 },
    mode: 'normal',
    hours: null,
    services: [],
    agreements: [],
    charging: null,
    managed: true,
    activePromotions: [],
    ...overrides,
  };
}

function page(s: Station, photos: StationPageData['showcase']['photos'] = []) {
  return renderStationPage(
    {
      station: s,
      iqp,
      showcase: { photos, promotions: [] },
      slug: 'posto-zulu-curitibanos',
    },
    {
      url: 'https://exemplo.test/p/posto-zulu-curitibanos',
      indexing: false,
      now: new Date('2026-11-15T12:00:00.000Z'),
    },
  );
}

describe('slug do posto', () => {
  it('tira acentos e símbolos', () => {
    expect(slugify('Auto Posto São João & Cia.')).toBe(
      'auto-posto-sao-joao-e-cia',
    );
  });

  it('junta nome e cidade sem repetir a cidade', () => {
    expect(stationSlugBase('Posto Zulu', 'Curitibanos')).toBe(
      'posto-zulu-curitibanos',
    );
    expect(
      stationSlugBase('Centro Automotivo Curitibanos', 'Curitibanos'),
    ).toBe('centro-automotivo-curitibanos');
    expect(stationSlugBase('Posto Lages Norte', 'Lages')).toBe(
      'posto-lages-norte',
    );
  });

  it('nome sem letras vira "posto"', () => {
    expect(stationSlugBase('***', 'São José')).toBe('posto-sao-jose');
  });

  it('respeita o tamanho máximo sem hífen no fim', () => {
    const slug = stationSlugBase('a'.repeat(79) + ' b', 'Lages');
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('página do posto', () => {
  it('mostra o texto do posto como texto, nunca como HTML', () => {
    const html = page(station({ name: '<script>alert(1)</script>Posto' }));
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;Posto');
    // Nem dentro dos dados estruturados.
    expect(html).not.toMatch(/"name":"<\/script>/);
  });

  it('mostra preço com a origem, igual ao app', () => {
    const html = page(station());
    expect(html).toContain('R$ 6,29');
    expect(html).toContain('Atualizado pelo posto · há 15 min');
  });

  it('preços ocultos: sem bloco de preços e com o aviso', () => {
    const html = page(station({ mode: 'precos_ocultos', prices: [] }));
    expect(html).not.toContain('id="precos"');
    expect(html).toContain('Os preços deste posto não são exibidos no Tankei.');
  });

  it('sempre mostra o IQP e o rodapé com a origem dos dados', () => {
    const html = page(station());
    expect(html).toContain('id="iqp"');
    expect(html).toContain('Dados de preço e avaliação: Tankei.');
  });

  it('fora do ar no Google enquanto não houver indexação', () => {
    expect(page(station())).toContain(
      '<meta name="robots" content="noindex"/>',
    );
  });

  it('prévia do WhatsApp com a primeira foto', () => {
    const html = page(station(), [
      {
        id: '0a7c2d4e-5b6f-4a8b-9c0d-1e2f3a4b5c6d',
        url: 'https://img.test/capa.webp',
        width: 1200,
        height: 800,
        caption: null,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ]);
    expect(html).toContain(
      '<meta property="og:image" content="https://img.test/capa.webp"/>',
    );
    expect(html).toContain(
      '<meta property="og:title" content="Posto Zulu · Curitibanos-SC"/>',
    );
  });
});

describe('SEO e mapa', () => {
  it('escapa "<" no JSON-LD', () => {
    expect(safeJson({ name: '</script>' })).toBe('{"name":"\\u003c/script>"}');
  });

  it('converte o horário para o schema.org', () => {
    const spec = openingHoursSpecification({
      dias_uteis: {
        mode: 'horario',
        intervals: [{ open: '06:00', close: '22:00' }],
      },
      sabado: { mode: '24h', intervals: [] },
      domingo: { mode: 'fechado', intervals: [] },
      feriado: { mode: 'fechado', intervals: [] },
    });
    expect(spec).toEqual([
      expect.objectContaining({
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '06:00',
        closes: '22:00',
      }),
      expect.objectContaining({
        dayOfWeek: ['Saturday'],
        opens: '00:00',
        closes: '23:59',
      }),
    ]);
  });

  it('põe o posto dentro do bloco central da grade 3×3', () => {
    const map = mapTiles(-27.28, -50.58);
    expect(map.tiles).toHaveLength(9);
    expect(map.pointX).toBeGreaterThanOrEqual(256);
    expect(map.pointX).toBeLessThan(512);
    expect(map.pointY).toBeGreaterThanOrEqual(256);
    expect(map.pointY).toBeLessThan(512);
  });

  it('mostra o fim da promoção na hora do posto, não do servidor', () => {
    expect(formatLocalDateTime('2026-11-15T21:00:00.000Z', 'SC')).toContain(
      '18:00',
    );
    expect(formatLocalDateTime('2026-11-15T21:00:00.000Z', 'AM')).toContain(
      '17:00',
    );
  });
});
