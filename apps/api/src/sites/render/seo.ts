import type { DayType, OpeningHours, Station } from '@tankei/shared';

/** Dias da semana do schema.org para cada tipo de dia do horário (ADR 0033). */
const SCHEMA_DAYS: Partial<Record<DayType, string[]>> = {
  dias_uteis: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  sabado: ['Saturday'],
  domingo: ['Sunday'],
};

interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

/**
 * Horário no formato do schema.org. Feriados ficam de fora (dependem da
 * data). Fechamento antes da abertura passa da meia-noite, como o Google lê.
 */
export function openingHoursSpecification(
  hours: OpeningHours | null,
): OpeningHoursSpecification[] {
  if (!hours) return [];
  return Object.entries(SCHEMA_DAYS).flatMap(([type, dayOfWeek]) => {
    const schedule = hours[type as DayType];
    if (schedule.mode === 'fechado') return [];
    if (schedule.mode === '24h') {
      return [spec(dayOfWeek, '00:00', '23:59')];
    }
    return schedule.intervals.map((i) => spec(dayOfWeek, i.open, i.close));
  });
}

function spec(
  dayOfWeek: string[],
  opens: string,
  closes: string,
): OpeningHoursSpecification {
  return { '@type': 'OpeningHoursSpecification', dayOfWeek, opens, closes };
}

/** Dados estruturados schema.org GasStation (spec 0004). */
export function gasStationJsonLd(
  station: Station,
  url: string,
  image: string | null,
): Record<string, unknown> {
  const hours = openingHoursSpecification(station.hours);
  return {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    name: station.name,
    url,
    ...(image ? { image } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.address,
      addressLocality: station.city,
      addressRegion: station.state,
      addressCountry: 'BR',
    },
    ...(station.location
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: station.location.lat,
            longitude: station.location.lng,
          },
        }
      : {}),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
  };
}

/**
 * JSON para um <script type="application/ld+json">: escapa "<" para um
 * texto do posto (ex.: "</script>") não fechar a tag.
 */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

// ---------- Mapa estático ----------

export const MAP_ZOOM = 16;
const TILE = 256;

export interface MapTiles {
  /** Imagens 5×3 em volta do posto, linha a linha. */
  tiles: { url: string; left: number; top: number }[];
  /** Posição do posto dentro da grade de 1280×768 px. */
  pointX: number;
  pointY: number;
}

/**
 * Mapa sem JavaScript (spec 0004: página leve, sem mapa interativo): uma
 * grade de 5×3 blocos do OpenStreetMap em volta do posto, deslocada por CSS
 * para o posto ficar no centro. Cinco colunas cobrem ao menos 512 px de cada
 * lado do posto (o quadro tem até ~730 px de largura e 220 px de altura).
 */
export function mapTiles(lat: number, lng: number, zoom = MAP_ZOOM): MapTiles {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const tiles: MapTiles['tiles'] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = (((cx + dx) % n) + n) % n;
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${tx}/${cy + dy}.png`,
        left: (dx + 2) * TILE,
        top: (dy + 1) * TILE,
      });
    }
  }
  return {
    tiles,
    pointX: Math.round((x - (cx - 2)) * TILE),
    pointY: Math.round((y - (cy - 1)) * TILE),
  };
}

/** Rotas no Google Maps e no Waze, com o destino nas coordenadas do posto. */
export function routeLinks(lat: number, lng: number) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}
