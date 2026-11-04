import type { FuelType, NearbyStation } from '@tankei/shared';
import { priceFor } from './stations';

/** Tamanho aproximado do marcador de preço na tela, em pontos. */
export const MARKER_SIZE = { width: 84, height: 28 };

const METERS_PER_DEGREE = 111_320;

export interface MarkerPlacement {
  /** Posição na pilha: 0 fica no ponto do posto; 1, logo acima; e assim por diante. */
  stack: number;
  /** Ordem de desenho: o mais barato fica por cima. */
  zIndex: number;
}

/**
 * Empilha os marcadores que se sobreporiam na tela no zoom atual, do mais
 * barato (no ponto do posto) para o mais caro (acima). Ao aproximar o mapa,
 * `metersPerPoint` diminui e os postos voltam às posições exatas.
 */
export function placeMarkers(
  stations: NearbyStation[],
  fuel: FuelType,
  metersPerPoint: number,
): Map<string, MarkerPlacement> {
  const byPrice = [...stations].sort(
    (a, b) =>
      (priceFor(a, fuel)?.price ?? Infinity) -
      (priceFor(b, fuel)?.price ?? Infinity),
  );
  const minDx = MARKER_SIZE.width * metersPerPoint;
  const minDy = MARKER_SIZE.height * metersPerPoint;

  const groups: { anchor: NearbyStation; size: number }[] = [];
  const placements = new Map<string, MarkerPlacement>();

  byPrice.forEach((station, rank) => {
    const group = groups.find(({ anchor }) => {
      const dy = Math.abs(station.location.lat - anchor.location.lat);
      const dx =
        Math.abs(station.location.lng - anchor.location.lng) *
        Math.cos((anchor.location.lat * Math.PI) / 180);
      return dx * METERS_PER_DEGREE < minDx && dy * METERS_PER_DEGREE < minDy;
    });
    const stack = group ? group.size : 0;
    if (group) group.size++;
    else groups.push({ anchor: station, size: 1 });
    placements.set(station.id, { stack, zIndex: byPrice.length - rank });
  });
  return placements;
}

/** Metros por ponto de tela, a partir da altura visível do mapa. */
export function metersPerPoint(
  latitudeDelta: number,
  mapHeight: number,
): number {
  return (latitudeDelta * METERS_PER_DEGREE) / Math.max(mapHeight, 1);
}
