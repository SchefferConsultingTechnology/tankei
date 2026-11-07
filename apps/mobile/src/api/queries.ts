import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  appConfigSchema,
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

/**
 * Lista do mapa: atualiza sozinha neste intervalo com o app aberto (e ao
 * voltar para o app), para preços e "aberto agora" não ficarem velhos.
 */
const LIST_REFRESH_MS = 2 * 60_000;

/** Postos perto do ponto, com preços e IQP. Recarrega ao voltar para o app. */
export function useNearbyStations(center: Coordinates | null) {
  return useQuery({
    queryKey: ['stations', 'nearby', center?.lat, center?.lng],
    enabled: center !== null,
    // Nova busca ao se deslocar: o mapa continua com os postos anteriores
    // enquanto ela carrega.
    placeholderData: keepPreviousData,
    refetchInterval: LIST_REFRESH_MS,
    queryFn: () =>
      apiGet(
        `/stations/nearby?lat=${center!.lat}&lng=${center!.lng}&radius=${SEARCH_RADIUS_M}`,
        nearbyListSchema,
      ),
  });
}

/**
 * Um posto, sempre conferido com a API ao abrir (mostra o que já tem e
 * atualiza): horário, serviços e preço mudam pelo portal a qualquer hora.
 */
export function useStation(id: string) {
  return useQuery({
    queryKey: ['stations', id],
    staleTime: 0,
    queryFn: () => apiGet(`/stations/${id}`, stationSchema),
  });
}

/** O posto tocado no mapa, buscado na hora (o cartão usa os dados atuais). */
export function useSelectedStation(id: string | null) {
  return useQuery({
    queryKey: ['stations', id],
    enabled: id !== null,
    staleTime: 0,
    queryFn: () => apiGet(`/stations/${id!}`, stationSchema),
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
    refetchInterval: LIST_REFRESH_MS,
    queryFn: () =>
      apiGet(
        `/stations?municipality=${municipality!}&fuel=${fuel}`,
        cityStationsSchema,
      ),
  });
}

/** WhatsApp da equipe e endereço do portal (ADR 0031). Muda raramente. */
export function useAppConfig() {
  return useQuery({
    queryKey: ['config'],
    staleTime: 60 * 60 * 1000,
    queryFn: () => apiGet('/config', appConfigSchema),
  });
}
