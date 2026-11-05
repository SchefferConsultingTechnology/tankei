import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  priceReportResponseSchema,
  stationCompetitionSchema,
  stationReputationSchema,
  stationSchema,
  type FuelType,
} from '@tankei/shared';
import { apiRequest } from './client';
import { authorizedRequest } from './session';

export function useStation(id: string) {
  return useQuery({
    queryKey: ['stations', id],
    queryFn: () => apiRequest(`/stations/${id}`, stationSchema),
  });
}

export function useCompetition(id: string) {
  return useQuery({
    queryKey: ['portal', id, 'competition'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${id}/competition`,
        stationCompetitionSchema,
      ),
  });
}

export function useReputation(id: string) {
  return useQuery({
    queryKey: ['portal', id, 'reputation'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${id}/reputation`,
        stationReputationSchema,
      ),
  });
}

export interface PriceUpdate {
  fuelType: FuelType;
  price: number;
  confirmed?: boolean;
  promotion?: { label: string; startsAt: string; endsAt: string };
}

/** Informe de preço do posto (selo "Atualizado pelo posto"). */
export function useReportPrice(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PriceUpdate) =>
      authorizedRequest(
        `/stations/${stationId}/prices`,
        priceReportResponseSchema,
        { method: 'POST', body },
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stations', stationId] }),
        queryClient.invalidateQueries({ queryKey: ['portal', stationId] }),
      ]),
  });
}
