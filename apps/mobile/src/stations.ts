import type { CurrentPrice, FuelType, Station } from '@tankei/shared';

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
