import type { CurrentPrice, FuelType, NearbyStation } from '@tankei/shared';

export function priceFor(
  station: { prices: CurrentPrice[] },
  fuel: FuelType,
): CurrentPrice | undefined {
  return station.prices.find((p) => p.fuelType === fuel);
}

/**
 * Menor preço primeiro; postos sem preço do combustível vão para o fim, por
 * distância. Ordem só por preço: anúncio pago não altera a ordem (regra do produto).
 */
export function sortByPrice(
  stations: NearbyStation[],
  fuel: FuelType,
): NearbyStation[] {
  return [...stations].sort((a, b) => {
    const pa = priceFor(a, fuel)?.price;
    const pb = priceFor(b, fuel)?.price;
    if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
    if (pa !== undefined && pb === undefined) return -1;
    if (pa === undefined && pb !== undefined) return 1;
    return a.distanceMeters - b.distanceMeters;
  });
}

/** Combustíveis vendidos pelos postos encontrados, na ordem padrão. */
export function availableFuels(
  stations: NearbyStation[],
  order: readonly FuelType[],
): FuelType[] {
  const sold = new Set(stations.flatMap((s) => s.fuels));
  return order.filter((fuel) => sold.has(fuel));
}
