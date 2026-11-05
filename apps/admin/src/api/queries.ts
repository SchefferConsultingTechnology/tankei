import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminClaimSchema,
  type ClaimStatus,
  type VerificationMethod,
} from '@tankei/shared';
import { z } from 'zod';
import { authorizedRequest } from './session';

export function useClaims(status: ClaimStatus) {
  return useQuery({
    queryKey: ['claims', status],
    queryFn: () =>
      authorizedRequest(
        `/admin/claims?status=${status}`,
        z.array(adminClaimSchema),
      ),
  });
}

type Decision =
  | {
      claimId: string;
      action: 'approve';
      verificationMethod: VerificationMethod;
    }
  | { claimId: string; action: 'reject'; reason: string };

export function useDecideClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, action, ...body }: Decision) =>
      authorizedRequest(
        `/admin/claims/${claimId}/${action}`,
        adminClaimSchema,
        {
          method: 'POST',
          body,
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['claims'] }),
  });
}
