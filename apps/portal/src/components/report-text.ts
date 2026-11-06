import type { PriceHistoryEntry } from '@tankei/shared';

/** Onde o consumidor estava ao informar (ADR 0020): só sim, não ou sem dado. */
export function atStationText(entry: PriceHistoryEntry): string {
  if (entry.atStation === true) return 'no posto';
  if (entry.atStation === false) return 'longe do posto';
  return 'sem localização';
}
