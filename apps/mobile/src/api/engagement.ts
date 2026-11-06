import {
  contributionSchema,
  priceAlertSchema,
  stationSchema,
  type CreatePriceAlert,
} from '@tankei/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthProvider';
import { authorizedRequest } from '@/auth/session';

/**
 * Favoritos, alertas de preço e contribuição (ADR 0029). Exigem conta: sem
 * login, as consultas ficam desligadas.
 */
function useSignedIn() {
  return useAuth().state.status === 'signedIn';
}

export function useFavorites() {
  return useQuery({
    queryKey: ['me', 'favorites'],
    enabled: useSignedIn(),
    queryFn: () => authorizedRequest('/me/favorites', z.array(stationSchema)),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stationId, favorite }: { stationId: string; favorite: boolean }) =>
      authorizedRequest(`/me/favorites/${stationId}`, z.undefined(), {
        method: favorite ? 'PUT' : 'DELETE',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['me', 'favorites'] }),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['me', 'alerts'],
    enabled: useSignedIn(),
    queryFn: () => authorizedRequest('/me/alerts', z.array(priceAlertSchema)),
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePriceAlert) =>
      authorizedRequest('/me/alerts', priceAlertSchema, {
        method: 'POST',
        body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['me', 'alerts'] }),
  });
}

export function useRemoveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      authorizedRequest(`/me/alerts/${alertId}`, z.undefined(), {
        method: 'DELETE',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['me', 'alerts'] }),
  });
}

export function useContribution() {
  return useQuery({
    queryKey: ['me', 'contribution'],
    enabled: useSignedIn(),
    queryFn: () => authorizedRequest('/me/contribution', contributionSchema),
  });
}
