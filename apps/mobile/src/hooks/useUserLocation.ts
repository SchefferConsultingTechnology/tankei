import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Coordinates } from '@/api/queries';
import { bearingDegrees, type Motion } from '@/driving';
import { distanceMeters } from '@/stations';

/** Centro de Curitibanos (SC), cidade-piloto (ADR 0002). */
export const PILOT_CITY_CENTER: Coordinates = { lat: -27.2828, lng: -50.5843 };

export type LocationState =
  | { status: 'loading'; coords: null }
  | { status: 'granted'; coords: Coordinates; motion: Motion }
  | { status: 'denied'; coords: Coordinates };

/**
 * Localização atual, pedindo permissão uma vez, e acompanhada enquanto a tela
 * está aberta (a cada segundo, com velocidade e rumo). Sem permissão, sem posição
 * em 10 s ou com erro, usa o centro da cidade-piloto. A localização só é
 * usada na busca e não é guardada pela API (ADR 0009).
 */
export function useUserLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    status: 'loading',
    coords: null,
  });

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let previous: { coords: Coordinates; time: number } | null = null;
    let motion: Motion = { speedKmh: null, heading: null };
    /** Última posição repassada às telas. */
    let shown: Coordinates | null = null;
    const update = (position: Location.LocationObject) => {
      if (cancelled) return;
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const before = motion;
      motion = nextMotion(motion, previous, coords, position);
      previous = { coords, time: position.timestamp };
      // Parado, o GPS oscila alguns metros: mantém a posição anterior (o mapa
      // não treme e a lista não é recalculada) e só avisa se o movimento mudou.
      const jitter = shown !== null && distanceMeters(shown, coords) < JITTER_M;
      if (
        jitter &&
        before.heading === motion.heading &&
        Math.abs((before.speedKmh ?? 0) - (motion.speedKmh ?? 0)) < 1
      ) {
        return;
      }
      if (!jitter || shown === null) shown = coords;
      setState({ status: 'granted', coords: shown, motion });
    };
    void (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) throw new Error('sem permissão');
        // Sem sinal de GPS, a posição atual pode nunca chegar: depois do
        // prazo, vale a última posição conhecida.
        const position =
          (await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            POSITION_TIMEOUT_MS,
          ).catch(() => null)) ?? (await Location.getLastKnownPositionAsync());
        if (!position) throw new Error('sem posição');
        update(position);

        // Acompanha o deslocamento. Falha aqui não apaga a posição já obtida.
        const watch = await Location.watchPositionAsync(
          {
            // GPS: com a precisão da rede, o ponto pula dezenas de metros.
            accuracy: Location.Accuracy.High,
            // Uma leitura por segundo, mesmo parado: a velocidade do GPS cai
            // a zero e o modo direção desliga (ADR 0032).
            timeInterval: WATCH_INTERVAL_MS,
            distanceInterval: 0,
          },
          update,
        ).catch(() => null);
        if (cancelled) watch?.remove();
        else subscription = watch;
      } catch {
        if (!cancelled)
          setState({ status: 'denied', coords: PILOT_CITY_CENTER });
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return state;
}

const POSITION_TIMEOUT_MS = 10_000;

/** Peso da leitura nova na velocidade suavizada (0 a 1). */
const SPEED_SMOOTHING = 0.5;
/** Abaixo disto (km/h), o rumo do GPS não é confiável. */
const HEADING_MIN_KMH = 5;
/** Deslocamento mínimo para calcular o rumo entre dois pontos. */
const HEADING_MIN_MOVE_M = 15;

/**
 * Velocidade (suavizada) e rumo. Usa os do GPS quando válidos; senão, calcula
 * pela distância e pelo tempo entre as duas últimas posições.
 */
function nextMotion(
  current: Motion,
  previous: { coords: Coordinates; time: number } | null,
  coords: Coordinates,
  position: Location.LocationObject,
): Motion {
  const moved = previous ? distanceMeters(previous.coords, coords) : 0;
  const seconds = previous ? (position.timestamp - previous.time) / 1000 : 0;

  const gpsSpeed = position.coords.speed;
  const rawKmh =
    gpsSpeed !== null && gpsSpeed >= 0
      ? gpsSpeed * 3.6
      : seconds > 0
        ? (moved / seconds) * 3.6
        : null;
  const speedKmh =
    rawKmh === null
      ? current.speedKmh
      : current.speedKmh === null
        ? rawKmh
        : SPEED_SMOOTHING * rawKmh + (1 - SPEED_SMOOTHING) * current.speedKmh;

  const gpsHeading = position.coords.heading;
  let heading = current.heading;
  if (speedKmh !== null && speedKmh >= HEADING_MIN_KMH) {
    if (gpsHeading !== null && gpsHeading >= 0) heading = gpsHeading;
    else if (previous && moved >= HEADING_MIN_MOVE_M) {
      heading = bearingDegrees(previous.coords, coords);
    }
  }
  return { speedKmh, heading };
}

/** Intervalo entre leituras do GPS. */
const WATCH_INTERVAL_MS = 1_000;
/** Deslocamento abaixo disto é oscilação do GPS, não movimento. */
const JITTER_M = 8;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tempo esgotado')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
