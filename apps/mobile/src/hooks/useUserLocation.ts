import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Coordinates } from '@/api/queries';

/** Centro de Curitibanos (SC), cidade-piloto (ADR 0002). */
export const PILOT_CITY_CENTER: Coordinates = { lat: -27.2828, lng: -50.5843 };

export type LocationState =
  | { status: 'loading'; coords: null }
  | { status: 'granted'; coords: Coordinates }
  | { status: 'denied'; coords: Coordinates };

/**
 * Localização atual, pedindo permissão uma vez, e acompanhada enquanto a tela
 * está aberta (a cada WATCH_DISTANCE_M metros). Sem permissão, sem posição
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
    const update = (position: Location.LocationObject) => {
      if (cancelled) return;
      setState({
        status: 'granted',
        coords: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
      });
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
            distanceInterval: WATCH_DISTANCE_M,
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

/** Deslocamento mínimo, em metros, para uma nova posição. */
const WATCH_DISTANCE_M = 25;

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
