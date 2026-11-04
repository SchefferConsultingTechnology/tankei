import type { FuelType } from '@tankei/shared';
import { priceFor, type LocatedStation } from './stations';

/** Tamanho aproximado do marcador de preço na tela, em pontos. */
export const MARKER_SIZE = { width: 84, height: 28 };

/** Espaço entre marcadores empilhados, em alturas de marcador. */
const STACK_STEP = 1.15;

const METERS_PER_DEGREE = 111_320;

export interface MarkerPlacement {
  /**
   * Deslocamento da etiqueta em relação ao ponto do próprio posto, em pontos de
   * tela (x para a direita, y para cima). Zero fora de uma pilha.
   */
  offset: { x: number; y: number };
  /** Ordem de desenho: o mais barato fica por cima. */
  zIndex: number;
}

/**
 * Empilha os marcadores que se sobreporiam na tela no zoom atual: o mais
 * barato fica no ponto do posto, e os demais do grupo logo acima dele, em
 * coluna. Ao aproximar o mapa, `metersPerPoint` diminui e cada posto volta à
 * posição exata.
 */
export function placeMarkers(
  stations: LocatedStation[],
  fuel: FuelType,
  metersPerPoint: number,
): Map<string, MarkerPlacement> {
  const byPrice = [...stations].sort(
    (a, b) =>
      (priceFor(a, fuel)?.price ?? Infinity) -
      (priceFor(b, fuel)?.price ?? Infinity),
  );

  const groups: { anchor: LocatedStation; size: number }[] = [];
  const placements = new Map<string, MarkerPlacement>();

  byPrice.forEach((station, rank) => {
    const zIndex = byPrice.length - rank;
    const group = groups.find(({ anchor }) => {
      const { right, up } = screenDistance(station, anchor, metersPerPoint);
      return (
        Math.abs(right) < MARKER_SIZE.width && Math.abs(up) < MARKER_SIZE.height
      );
    });
    if (!group) {
      groups.push({ anchor: station, size: 1 });
      placements.set(station.id, { offset: { x: 0, y: 0 }, zIndex });
      return;
    }

    // Leva a etiqueta para a coluna do posto mais barato do grupo, e sobe.
    const { right, up } = screenDistance(station, group.anchor, metersPerPoint);
    const lift = group.size * STACK_STEP * MARKER_SIZE.height;
    placements.set(station.id, {
      offset: { x: -right, y: lift - up },
      zIndex,
    });
    group.size++;
  });
  return placements;
}

/** Posição de `station` em relação a `anchor`, em pontos de tela. */
function screenDistance(
  station: LocatedStation,
  anchor: LocatedStation,
  metersPerPoint: number,
): { right: number; up: number } {
  const cos = Math.cos((anchor.location.lat * Math.PI) / 180);
  return {
    right:
      ((station.location.lng - anchor.location.lng) * cos * METERS_PER_DEGREE) /
      metersPerPoint,
    up:
      ((station.location.lat - anchor.location.lat) * METERS_PER_DEGREE) /
      metersPerPoint,
  };
}

/** Metros por ponto de tela, a partir da altura visível do mapa. */
export function metersPerPoint(
  latitudeDelta: number,
  mapHeight: number,
): number {
  return (latitudeDelta * METERS_PER_DEGREE) / Math.max(mapHeight, 1);
}
