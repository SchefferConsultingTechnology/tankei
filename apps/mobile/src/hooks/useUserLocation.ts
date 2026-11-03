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
 * Localização atual, pedindo permissão uma vez. Sem permissão ou com erro,
 * usa o centro da cidade-piloto. A localização não é enviada à API além da
 * busca (ADR 0009).
 */
export function useUserLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    status: 'loading',
    coords: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) throw new Error('sem permissão');
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setState({
            status: 'granted',
            coords: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          });
        }
      } catch {
        if (!cancelled)
          setState({ status: 'denied', coords: PILOT_CITY_CENTER });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
