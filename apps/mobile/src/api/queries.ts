import { useQuery } from '@tanstack/react-query';
import {
  nearbyStationSchema,
  stationIqpSchema,
  stationSchema,
} from '@tankei/shared';
import { z } from 'zod';
import { apiGet } from './client';

const nearbyListSchema = z.array(nearbyStationSchema);

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Raio da busca na tela inicial, em metros. */
const SEARCH_RADIUS_M = 15_000;

/** Postos perto do ponto, com preços e IQP. Recarrega ao voltar para o app. */
export function useNearbyStations(center: Coordinates | null) {
  return useQuery({
    queryKey: ['stations', 'nearby', center?.lat, center?.lng],
    enabled: center !== null,
    queryFn: () =>
      apiGet(
        `/stations/nearby?lat=${center!.lat}&lng=${center!.lng}&radius=${SEARCH_RADIUS_M}`,
        nearbyListSchema,
      ),
  });
}

export function useStation(id: string) {
  return useQuery({
    queryKey: ['stations', id],
    queryFn: () => apiGet(`/stations/${id}`, stationSchema),
  });
}

export function useStationIqp(id: string) {
  return useQuery({
    queryKey: ['stations', id, 'iqp'],
    queryFn: () => apiGet(`/stations/${id}/iqp`, stationIqpSchema),
  });
}
