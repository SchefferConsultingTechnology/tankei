import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  adminNetworkSchema,
  adminNetworkSummarySchema,
  adminParameterSchema,
  adminStationSchema,
  adminStationSummarySchema,
  parameterChangeSchema,
  type AdminUpdateMember,
  type ParameterKey,
} from '@tankei/shared';
import { z } from 'zod';
import { authorizedRequest } from './session';

/** Resposta sem corpo (204). */
const empty = z.undefined();

// ---------- Parâmetros ----------

export function useParameters() {
  return useQuery({
    queryKey: ['parameters'],
    queryFn: () =>
      authorizedRequest('/admin/parameters', z.array(adminParameterSchema)),
  });
}

export function useParameterHistory(key: ParameterKey | null) {
  return useQuery({
    queryKey: ['parameters', key, 'history'],
    enabled: key !== null,
    queryFn: () =>
      authorizedRequest(
        `/admin/parameters/${key}/history`,
        z.array(parameterChangeSchema),
      ),
  });
}

export function useUpdateParameter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      ...body
    }: {
      key: ParameterKey;
      value: number;
      reason: string;
    }) =>
      authorizedRequest(`/admin/parameters/${key}`, adminParameterSchema, {
        method: 'PUT',
        body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['parameters'] }),
  });
}

// ---------- Postos ----------

export function useStationSearch(q: string) {
  return useQuery({
    queryKey: ['stations', 'search', q],
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    queryFn: () =>
      authorizedRequest(
        `/admin/stations?q=${encodeURIComponent(q)}`,
        z.array(adminStationSummarySchema),
      ),
  });
}

export function useStation(stationId: string) {
  return useQuery({
    queryKey: ['stations', stationId],
    queryFn: () =>
      authorizedRequest(`/admin/stations/${stationId}`, adminStationSchema),
  });
}

/** Mudanças em postos e redes afetam as duas telas. */
function useInvalidateSupport() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stations'] }),
      queryClient.invalidateQueries({ queryKey: ['networks'] }),
    ]);
}

export function useAddManager(stationId: string) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (email: string) =>
      authorizedRequest(`/admin/stations/${stationId}/managers`, empty, {
        method: 'POST',
        body: { email },
      }),
    onSuccess: invalidate,
  });
}

// ---------- Redes ----------

export function useNetworks(q: string) {
  return useQuery({
    queryKey: ['networks', 'list', q],
    placeholderData: keepPreviousData,
    queryFn: () =>
      authorizedRequest(
        `/admin/networks${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        z.array(adminNetworkSummarySchema),
      ),
  });
}

export function useNetwork(networkId: string) {
  return useQuery({
    queryKey: ['networks', networkId],
    queryFn: () =>
      authorizedRequest(`/admin/networks/${networkId}`, adminNetworkSchema),
  });
}

export function useRenameNetwork(networkId: string) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (name: string) =>
      authorizedRequest(`/admin/networks/${networkId}`, empty, {
        method: 'PATCH',
        body: { name },
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateMember(networkId: string) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: ({
      userId,
      ...body
    }: AdminUpdateMember & { userId: string }) =>
      authorizedRequest(
        `/admin/networks/${networkId}/members/${userId}`,
        empty,
        { method: 'PATCH', body },
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(networkId: string) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      authorizedRequest(
        `/admin/networks/${networkId}/members/${userId}/remove`,
        empty,
        { method: 'POST', body: { reason } },
      ),
    onSuccess: invalidate,
  });
}
