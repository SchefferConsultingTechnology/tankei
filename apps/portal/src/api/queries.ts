import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  bulkPriceResultSchema,
  invitationSchema,
  myInvitationSchema,
  organizationOverviewSchema,
  teamSchema,
  cityComparisonSchema,
  cityWithStationsSchema,
  claimableStationSchema,
  priceHistorySchema,
  claimSchema,
  priceReportResponseSchema,
  stationCompetitionSchema,
  stationReputationSchema,
  stationSchema,
  stationModerationCaseSchema,
  stationClaimNoticeSchema,
  promotionSchema,
  stationPhotoSchema,
  stationPhotosSchema,
  stationPromotionSchema,
  type BulkPrice,
  type CreateClaim,
  type CreateInvitation,
  type UpdateMember,
  type FuelType,
} from '@tankei/shared';
import { z } from 'zod';
import { apiRequest } from './client';
import { authorizedRequest } from './session';

export function useStation(id: string) {
  return useQuery({
    queryKey: ['stations', id],
    enabled: id !== '',
    queryFn: () => apiRequest(`/stations/${id}`, stationSchema),
  });
}

/** Sem raio: o máximo permitido (parâmetro). */
export function useCompetition(id: string, radius?: number) {
  return useQuery({
    queryKey: ['portal', id, 'competition', radius ?? 'max'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${id}/competition${radius ? `?radius=${radius}` : ''}`,
        stationCompetitionSchema,
      ),
    placeholderData: keepPreviousData,
  });
}

export function usePriceHistory(
  id: string,
  fuel: FuelType | null,
  days: number,
) {
  return useQuery({
    queryKey: ['portal', id, 'history', fuel ?? 'todos', days],
    queryFn: () => {
      const params = new URLSearchParams({ days: String(days) });
      if (fuel) params.set('fuel', fuel);
      return authorizedRequest(
        `/portal/stations/${id}/price-history?${params.toString()}`,
        priceHistorySchema,
      );
    },
    placeholderData: keepPreviousData,
  });
}

/** Cidades da UF com postos (rota pública do app). */
export function useCities(state: string) {
  return useQuery({
    queryKey: ['cities', state],
    enabled: state !== '',
    queryFn: () =>
      apiRequest(
        `/stations/cities?state=${state}`,
        z.array(cityWithStationsSchema),
      ),
    staleTime: 60 * 60_000,
  });
}

export function useCityComparison(id: string, municipality: string) {
  return useQuery({
    queryKey: ['portal', id, 'city', municipality],
    enabled: municipality !== '',
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${id}/city-comparison?municipality=${municipality}`,
        cityComparisonSchema,
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

export function useMyClaims() {
  return useQuery({
    queryKey: ['claims', 'mine'],
    queryFn: () => authorizedRequest('/claims/mine', z.array(claimSchema)),
  });
}

/** Busca por CNPJ ou nome; só a partir de 3 caracteres. */
export function useClaimSearch(q: string, state: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['claims', 'stations', term, state],
    enabled: term.length >= 3,
    queryFn: () => {
      const params = new URLSearchParams({ q: term });
      if (state) params.set('state', state);
      return authorizedRequest(
        `/claims/stations?${params.toString()}`,
        z.array(claimableStationSchema),
      );
    },
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<CreateClaim, 'phone'> & { phone: string }) =>
      authorizedRequest('/claims', claimSchema, { method: 'POST', body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['claims', 'mine'] }),
  });
}

// ---------- Rede (ADR 0021) ----------

export function useOverview(orgId: string) {
  return useQuery({
    queryKey: ['org', orgId, 'overview'],
    queryFn: () =>
      authorizedRequest(
        `/portal/organizations/${orgId}`,
        organizationOverviewSchema,
      ),
  });
}

export function useBulkPrice(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: Omit<BulkPrice, 'confirmed'> & { confirmed?: boolean },
    ) =>
      authorizedRequest(
        `/portal/organizations/${orgId}/prices`,
        bulkPriceResultSchema,
        { method: 'POST', body },
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org', orgId] }),
        queryClient.invalidateQueries({ queryKey: ['stations'] }),
        queryClient.invalidateQueries({ queryKey: ['portal'] }),
      ]),
  });
}

export function useTeam(orgId: string) {
  return useQuery({
    queryKey: ['org', orgId, 'team'],
    queryFn: () =>
      authorizedRequest(`/portal/organizations/${orgId}/team`, teamSchema),
  });
}

/** Ações da equipe; todas recarregam a tela da equipe. */
export function useTeamActions(orgId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['org', orgId] });
  const base = `/portal/organizations/${orgId}`;
  return {
    invite: useMutation({
      mutationFn: (
        body: Omit<CreateInvitation, 'stationIds'> & { stationIds: string[] },
      ) =>
        authorizedRequest(`${base}/invitations`, invitationSchema, {
          method: 'POST',
          body,
        }),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (invitationId: string) =>
        authorizedRequest(`${base}/invitations/${invitationId}`, z.unknown(), {
          method: 'DELETE',
        }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ userId, ...body }: UpdateMember & { userId: string }) =>
        authorizedRequest(`${base}/members/${userId}`, z.unknown(), {
          method: 'PATCH',
          body,
        }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) =>
        authorizedRequest(`${base}/members/${userId}`, z.unknown(), {
          method: 'DELETE',
        }),
      onSuccess: refresh,
    }),
  };
}

export function useMyInvitations() {
  return useQuery({
    queryKey: ['invitations', 'mine'],
    queryFn: () =>
      authorizedRequest('/portal/invitations', z.array(myInvitationSchema)),
  });
}

export function useAnswerInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      authorizedRequest(
        `/portal/invitations/${id}/${accept ? 'accept' : 'decline'}`,
        z.unknown(),
        { method: 'POST' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });
}

// ---------- Contestação (ADR 0020) ----------

export function useStationModeration(stationId: string) {
  return useQuery({
    queryKey: ['portal', stationId, 'moderation'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${stationId}/moderation`,
        z.array(stationModerationCaseSchema),
      ),
  });
}

/** Contesta informes: eles saem do preço exibido até a equipe Tankei decidir. */
export function useContest(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { reportIds: string[]; reason: string }) =>
      authorizedRequest(
        `/portal/stations/${stationId}/moderation/contests`,
        stationModerationCaseSchema,
        { method: 'POST', body },
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stations', stationId] }),
        queryClient.invalidateQueries({ queryKey: ['portal', stationId] }),
      ]),
  });
}

// ---------- Vitrine: promoções e fotos (ADR 0026) ----------

export function useStationPromotions(stationId: string) {
  return useQuery({
    queryKey: ['portal', stationId, 'promotions'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${stationId}/promotions`,
        z.array(stationPromotionSchema),
      ),
  });
}

export interface NewPromotion {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  prices: { fuelType: FuelType; price: number }[];
  confirmed?: boolean;
}

function useInvalidateStation(stationId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stations', stationId] }),
      queryClient.invalidateQueries({ queryKey: ['portal', stationId] }),
    ]);
}

export function useCreatePromotion(stationId: string) {
  const invalidate = useInvalidateStation(stationId);
  return useMutation({
    mutationFn: (body: NewPromotion) =>
      authorizedRequest(
        `/portal/stations/${stationId}/promotions`,
        promotionSchema,
        { method: 'POST', body },
      ),
    onSuccess: invalidate,
  });
}

export function usePromotionImage(stationId: string) {
  const invalidate = useInvalidateStation(stationId);
  return useMutation({
    mutationFn: ({ promotionId, file }: { promotionId: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return authorizedRequest(
        `/portal/stations/${stationId}/promotions/${promotionId}/image`,
        promotionSchema,
        { method: 'PUT', body: form },
      );
    },
    onSuccess: invalidate,
  });
}

export function useEndPromotion(stationId: string) {
  const invalidate = useInvalidateStation(stationId);
  return useMutation({
    mutationFn: (promotionId: string) =>
      authorizedRequest(
        `/portal/stations/${stationId}/promotions/${promotionId}/end`,
        promotionSchema,
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  });
}

export function useStationPhotos(stationId: string) {
  return useQuery({
    queryKey: ['portal', stationId, 'photos'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${stationId}/photos`,
        stationPhotosSchema,
      ),
  });
}

export function useAddPhoto(stationId: string) {
  const invalidate = useInvalidateStation(stationId);
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (caption.trim()) form.append('caption', caption.trim());
      return authorizedRequest(
        `/portal/stations/${stationId}/photos`,
        stationPhotoSchema,
        { method: 'POST', body: form },
      );
    },
    onSuccess: invalidate,
  });
}

export function useRemovePhoto(stationId: string) {
  const invalidate = useInvalidateStation(stationId);
  return useMutation({
    mutationFn: (photoId: string) =>
      authorizedRequest(
        `/portal/stations/${stationId}/photos/${photoId}`,
        z.undefined(),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  });
}

// ---------- Pedidos de acesso ao posto (ADR 0027) ----------

export function useStationClaims(stationId: string) {
  return useQuery({
    queryKey: ['portal', stationId, 'claims'],
    queryFn: () =>
      authorizedRequest(
        `/portal/stations/${stationId}/claims`,
        z.array(stationClaimNoticeSchema),
      ),
  });
}

export function useDisputeClaim(stationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      authorizedRequest(
        `/portal/stations/${stationId}/claims/${claimId}/dispute`,
        z.undefined(),
        { method: 'POST', body: { reason } },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['portal', stationId, 'claims'],
      }),
  });
}
