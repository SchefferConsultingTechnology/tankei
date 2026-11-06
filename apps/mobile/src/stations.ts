import type { CurrentPrice, FuelType, Station } from '@tankei/shared';
import type { Coordinates } from '@/api/queries';

/**
 * Posto exibido nas listas e no mapa: com distância na busca por proximidade,
 * sem ela na busca por cidade.
 */
export type ListedStation = Station & { distanceMeters?: number };

/** Posto com coordenada, o único que pode ir para o mapa. */
export type LocatedStation = ListedStation & {
  location: NonNullable<Station['location']>;
};

export function isLocated(station: ListedStation): station is LocatedStation {
  return station.location !== null;
}

export function priceFor(
  station: { prices: CurrentPrice[] },
  fuel: FuelType,
): CurrentPrice | undefined {
  return station.prices.find((p) => p.fuelType === fuel);
}

/**
 * Menor preço primeiro; postos sem preço do combustível vão para o fim, por
 * distância (ou nome, sem distância). Ordem só por preço: anúncio pago não
 * altera a ordem (regra do produto).
 */
export function sortByPrice<T extends ListedStation>(
  stations: T[],
  fuel: FuelType,
): T[] {
  return [...stations].sort((a, b) => {
    const pa = priceFor(a, fuel)?.price;
    const pb = priceFor(b, fuel)?.price;
    if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
    if (pa !== undefined && pb === undefined) return -1;
    if (pa === undefined && pb !== undefined) return 1;
    if (a.distanceMeters !== undefined && b.distanceMeters !== undefined) {
      return a.distanceMeters - b.distanceMeters;
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/** Combustíveis vendidos pelos postos encontrados, na ordem padrão. */
export function availableFuels(
  stations: ListedStation[],
  order: readonly FuelType[],
): FuelType[] {
  const sold = new Set(stations.flatMap((s) => s.fuels));
  return order.filter((fuel) => sold.has(fuel));
}

const EARTH_RADIUS_M = 6_371_000;

/** Distância em linha reta (fórmula de haversine), em metros. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Distâncias até a posição atual: a busca é refeita só de tempos em tempos,
 * mas a distância exibida acompanha o deslocamento.
 */
export function withDistanceFrom(
  stations: ListedStation[],
  origin: Coordinates,
): ListedStation[] {
  return stations.map((station) =>
    station.location
      ? { ...station, distanceMeters: distanceMeters(origin, station.location) }
      : station,
  );
}

/**
 * Promoção em destaque no cartão (ADR 0026): a cadastrada que termina antes;
 * sem ela, o preço promocional do combustível escolhido (caminho antigo).
 */
export function promotionHighlight(
  station: Station,
  fuel: FuelType,
): { title: string; endsAt: string; others: number } | null {
  const [first, ...rest] = station.activePromotions;
  if (first) {
    return { title: first.title, endsAt: first.endsAt, others: rest.length };
  }
  const promo = priceFor(station, fuel)?.promotion;
  return promo ? { title: promo.label, endsAt: promo.endsAt, others: 0 } : null;
}

/** Posto com promoção vigente (filtro "Só promoções"). */
export function hasPromotion(station: Station): boolean {
  return (
    station.activePromotions.length > 0 ||
    station.prices.some((p) => p.promotion !== null)
  );
}
