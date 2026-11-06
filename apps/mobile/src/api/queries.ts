import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  cityStationsSchema,
  cityWithStationsSchema,
  nearbyStationSchema,
  stationIqpSchema,
  stationSchema,
  type FuelType,
  stationShowcaseSchema,
} from '@tankei/shared';
import { z } from 'zod';
import { apiGet } from './client';

const nearbyListSchema = z.array(nearbyStationSchema);
const citiesSchema = z.array(cityWithStationsSchema);

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
    // Nova busca ao se deslocar: o mapa continua com os postos anteriores
    // enquanto ela carrega.
    placeholderData: keepPreviousData,
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

/** Fotos e promoções vigentes do posto, para a ficha (ADR 0026). */
export function useStationShowcase(id: string) {
  return useQuery({
    queryKey: ['stations', id, 'showcase'],
    queryFn: () => apiGet(`/stations/${id}/showcase`, stationShowcaseSchema),
  });
}

export function useStationIqp(id: string) {
  return useQuery({
    queryKey: ['stations', id, 'iqp'],
    queryFn: () => apiGet(`/stations/${id}/iqp`, stationIqpSchema),
  });
}

/** Cidades da UF que têm postos (escolha de cidade). */
export function useCities(state: string | null) {
  return useQuery({
    queryKey: ['cities', state],
    enabled: state !== null,
    // A lista de cidades muda raramente.
    staleTime: 60 * 60 * 1000,
    queryFn: () => apiGet(`/stations/cities?state=${state!}`, citiesSchema),
  });
}

/** Postos de uma cidade, os mais baratos do combustível primeiro. */
export function useCityStations(municipality: string | null, fuel: FuelType) {
  return useQuery({
    queryKey: ['stations', 'city', municipality, fuel],
    enabled: municipality !== null,
    queryFn: () =>
      apiGet(
        `/stations?municipality=${municipality!}&fuel=${fuel}`,
        cityStationsSchema,
      ),
  });
}
