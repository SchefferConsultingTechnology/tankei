import { useState } from 'react';
import type { Coordinates } from '@/api/queries';
import { distanceMeters } from '@/stations';

/**
 * Modo direção (ADR 0032): com o carro em movimento, o mapa gira no sentido
 * do deslocamento, ajusta o zoom pela velocidade e mostra os postos à frente.
 * Tudo calculado no aparelho; a posição não vai para o servidor (ADR 0009).
 */

/** Acima desta velocidade (km/h), entra no modo direção. */
export const DRIVING_ENTER_KMH = 15;
/** Abaixo desta, sai (folga para não alternar em semáforo e lombada). */
export const DRIVING_EXIT_KMH = 5;

/** Postos mais perto que isto contam como "à frente" em qualquer direção. */
const AHEAD_NEAR_M = 300;
/** Diferença máxima entre o rumo e a direção do posto para estar "à frente". */
const AHEAD_MAX_ANGLE = 100;

/** Em movimento, a busca é feita este tanto à frente da posição. */
export const SEARCH_AHEAD_M = 4_000;

/** Zoom do mapa por faixa de velocidade: cidade, avenida, estrada. */
const ZOOM_BANDS = [
  { maxKmh: 45, zoom: 15 },
  { maxKmh: 80, zoom: 14 },
  { maxKmh: Infinity, zoom: 13 },
] as const;
/** Folga (km/h) para trocar de faixa, para o zoom não ficar pulando. */
const ZOOM_HYSTERESIS_KMH = 5;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Rumo de `from` para `to`, em graus a partir do norte (0 a 360). */
export function bearingDegrees(from: Coordinates, to: Coordinates): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Menor ângulo entre dois rumos (0 a 180). */
export function angleBetween(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Ponto a `meters` de `from`, no rumo `heading`. */
export function projectPoint(
  from: Coordinates,
  heading: number,
  meters: number,
): Coordinates {
  const R = 6_371_000;
  const δ = meters / R;
  const θ = toRad(heading);
  const φ1 = toRad(from.lat);
  const λ1 = toRad(from.lng);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

/** O posto está à frente de quem dirige (ou bem perto)? */
export function isAhead(
  user: Coordinates,
  heading: number,
  station: Coordinates,
): boolean {
  if (distanceMeters(user, station) <= AHEAD_NEAR_M) return true;
  return angleBetween(bearingDegrees(user, station), heading) <= AHEAD_MAX_ANGLE;
}

/** Zoom para a velocidade, mantendo a faixa atual dentro da folga. */
export function zoomForSpeed(kmh: number, current: number | null): number {
  const index = ZOOM_BANDS.findIndex((band) => kmh <= band.maxKmh);
  const target = ZOOM_BANDS[index].zoom;
  if (current === null || current === target) return target;
  const currentIndex = ZOOM_BANDS.findIndex((band) => band.zoom === current);
  if (currentIndex < 0) return target;
  // Só troca de faixa passando a borda com folga.
  if (index > currentIndex) {
    const edge = ZOOM_BANDS[currentIndex].maxKmh;
    return kmh > edge + ZOOM_HYSTERESIS_KMH ? target : current;
  }
  const edge = ZOOM_BANDS[index].maxKmh;
  return kmh < edge - ZOOM_HYSTERESIS_KMH ? target : current;
}

export interface Motion {
  /** Velocidade suavizada, em km/h; nula enquanto não se sabe. */
  speedKmh: number | null;
  /** Rumo em graus a partir do norte; nulo parado ou sem sinal. */
  heading: number | null;
}

/** Está dirigindo? Entra acima de 15 km/h e só sai abaixo de 5 km/h. */
export function useDriving(motion: Motion | null): boolean {
  const [driving, setDriving] = useState(false);
  const speed = motion?.speedKmh ?? null;
  const next =
    speed === null
      ? false
      : speed >= DRIVING_ENTER_KMH
        ? true
        : speed < DRIVING_EXIT_KMH
          ? false
          : driving;
  // Estado derivado na renderização (sem efeito): só muda com nova posição.
  if (next !== driving) setDriving(next);
  return next;
}
