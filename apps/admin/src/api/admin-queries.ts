import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  adminMediaSchema,
  adminModerationCaseSchema,
  adminNetworkSchema,
  adminNetworkSummarySchema,
  adminParameterSchema,
  adminStationSchema,
  adminStationSummarySchema,
  officialDivergenceSchema,
  parameterChangeSchema,
  stationInfoSchema,
  adminAgreementSchema,
  adhesionDashboardSchema,
  engagementDashboardSchema,
  type EngagementDashboardQuery,
  type AdhesionDashboardQuery,
  type CreateAgreement,
  type UpdateAgreement,
  type UpdateStationInfo,
  type AdminUpdateMember,
  type ModerationDecision,
  type ParameterKey,
  type SetStationMode,
} from '@tankei/shared';
import {
  chargingAdminSchema,
  type DismissChargerSuggestions,
  type SetChargers,
  stationFeaturesSchema,
  type SetStationFeature,
  type StationFeature,
} from '@tankei/shared';
import { z } from 'zod';
import { authorizedRequest } from './session';

/** Resposta sem corpo (204). */
const empty = z.undefined();

// ---------- Dashboard de adesão (ADR 0037) ----------

export function useAdhesionDashboard(query: AdhesionDashboardQuery) {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.state) params.set('state', query.state);
  if (query.municipality) params.set('municipality', query.municipality);
  return useQuery({
    queryKey: ['admin', 'dashboard', 'adhesion', params.toString()],
    placeholderData: keepPreviousData,
    queryFn: () =>
      authorizedRequest(
        `/admin/dashboard/adhesion?${params.toString()}`,
        adhesionDashboardSchema,
      ),
  });
}

export function useEngagementDashboard(query: EngagementDashboardQuery) {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.state) params.set('state', query.state);
  return useQuery({
    queryKey: ['admin', 'dashboard', 'engagement', params.toString()],
    placeholderData: keepPreviousData,
    queryFn: () =>
      authorizedRequest(
        `/admin/dashboard/engagement?${params.toString()}`,
        engagementDashboardSchema,
      ),
  });
}

// ---------- Convênios (ADR 0034) ----------

export function useAgreements() {
  return useQuery({
    queryKey: ['admin', 'agreements'],
    queryFn: () =>
      authorizedRequest('/admin/agreements', z.array(adminAgreementSchema)),
  });
}

function useInvalidateAgreements() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'agreements'] });
}

export function useCreateAgreement() {
  const invalidate = useInvalidateAgreements();
  return useMutation({
    mutationFn: (body: CreateAgreement) =>
      authorizedRequest('/admin/agreements', adminAgreementSchema, {
        method: 'POST',
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateAgreement() {
  const invalidate = useInvalidateAgreements();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAgreement }) =>
      authorizedRequest(`/admin/agreements/${id}`, adminAgreementSchema, {
        method: 'PATCH',
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useRemoveAgreement() {
  const invalidate = useInvalidateAgreements();
  return useMutation({
    mutationFn: (id: string) =>
      authorizedRequest(`/admin/agreements/${id}`, empty, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ---------- Horário e serviços do posto (ADR 0033) ----------

export function useAdminStationInfo(stationId: string) {
  return useQuery({
    queryKey: ['admin', 'stations', stationId, 'info'],
    queryFn: () =>
      authorizedRequest(`/admin/stations/${stationId}/info`, stationInfoSchema),
  });
}

export function useUpdateAdminStationInfo(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStationInfo) =>
      authorizedRequest(`/admin/stations/${stationId}/info`, stationInfoSchema, {
        method: 'PUT',
        body,
      }),
    onSuccess: (data) =>
      queryClient.setQueryData(['admin', 'stations', stationId, 'info'], data),
  });
}

/** Recursos do plano do posto (spec 0003), liberados pela equipe. */
export function useStationFeatures(stationId: string) {
  return useQuery({
    queryKey: ['admin', 'stations', stationId, 'features'],
    queryFn: () =>
      authorizedRequest(
        `/admin/stations/${stationId}/features`,
        stationFeaturesSchema,
      ),
  });
}

export function useSetStationFeature(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      feature,
      ...body
    }: SetStationFeature & { feature: StationFeature }) =>
      authorizedRequest(
        `/admin/stations/${stationId}/features/${feature}`,
        stationFeaturesSchema,
        { method: 'PUT', body },
      ),
    onSuccess: (data) =>
      queryClient.setQueryData(
        ['admin', 'stations', stationId, 'features'],
        data,
      ),
  });
}

/** Recarga elétrica do posto (ADR 0041): cadastro e sugestões. */
export function useAdminCharging(stationId: string) {
  return useQuery({
    queryKey: ['admin', 'stations', stationId, 'charging'],
    queryFn: () =>
      authorizedRequest(
        `/admin/stations/${stationId}/charging`,
        chargingAdminSchema,
      ),
  });
}

export function useSetAdminCharging(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetChargers) =>
      authorizedRequest(
        `/admin/stations/${stationId}/charging`,
        chargingAdminSchema,
        { method: 'PUT', body },
      ),
    onSuccess: (data) =>
      queryClient.setQueryData(['admin', 'stations', stationId, 'charging'], data),
  });
}

export function useDismissChargerSuggestions(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DismissChargerSuggestions) =>
      authorizedRequest(
        `/admin/stations/${stationId}/charging/dismiss`,
        chargingAdminSchema,
        { method: 'POST', body },
      ),
    onSuccess: (data) =>
      queryClient.setQueryData(['admin', 'stations', stationId, 'charging'], data),
  });
}

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

// ---------- Moderação (ADR 0020 e 0024) ----------

export function useModeration(status: 'em_analise' | 'decididos') {
  return useQuery({
    queryKey: ['moderation', status],
    queryFn: () =>
      authorizedRequest(
        `/admin/moderation?status=${status}`,
        z.array(adminModerationCaseSchema),
      ),
  });
}

export function useDecideModeration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      ...body
    }: {
      caseId: string;
      decision: ModerationDecision;
      reason: string;
    }) =>
      authorizedRequest(
        `/admin/moderation/${caseId}/decide`,
        adminModerationCaseSchema,
        { method: 'POST', body },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['moderation'] }),
  });
}

// ---------- Imagens (ADR 0026) ----------

export function useMedia(days: number) {
  return useQuery({
    queryKey: ['media', days],
    queryFn: () =>
      authorizedRequest(
        `/admin/media?days=${days}`,
        z.array(adminMediaSchema),
      ),
  });
}

export function useRemoveMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      id,
      reason,
    }: {
      kind: 'foto' | 'arte';
      id: string;
      reason: string;
    }) =>
      authorizedRequest(
        kind === 'foto'
          ? `/admin/media/photos/${id}/remove`
          : `/admin/media/promotions/${id}/remove-image`,
        empty,
        { method: 'POST', body: { reason } },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });
}

/** Tira o posto da rede (null) ou move para outra (ADR 0027). */
export function useSetStationNetwork(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { networkId: string | null; reason: string }) =>
      authorizedRequest(`/admin/stations/${stationId}/network`, empty, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stations'] }),
        queryClient.invalidateQueries({ queryKey: ['networks'] }),
      ]),
  });
}

// ---------- Modo de exibição (ADR 0028) ----------

export function useSetStationMode(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetStationMode) =>
      authorizedRequest(`/admin/stations/${stationId}/mode`, adminStationSchema, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['stations'] }),
  });
}

export function useOfficialDivergences() {
  return useQuery({
    queryKey: ['official-divergences'],
    queryFn: () =>
      authorizedRequest(
        '/admin/official-divergences',
        z.array(officialDivergenceSchema),
      ),
  });
}
