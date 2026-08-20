import {
  useMutation,
  useQueryClient,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  changeMemberRole,
  inviteMember,
  listMembers,
  revokeMembership,
} from '../api/endpoints';
import type { ApiError } from '../api/refusal';
import type { Member, Role } from '../api/types';
import { keys } from './keys';

/**
 * Everybody in one tenant, revoked memberships included.
 *
 * Keyed on the tenant rather than held in one place, which is what stops the
 * answer for one tenant from ever being shown for another — the cache mistake
 * that puts somebody else's people on the screen. The key is built by
 * `keys.members` so the invalidations in task 6.3 cannot name it differently.
 */
export function useMembers(
  tenantId: string,
): UseQueryResult<readonly Member[], ApiError> {
  return useQuery<readonly Member[], ApiError>({
    queryKey: keys.members(tenantId),
    queryFn: () => listMembers(tenantId),

    /**
     * No tenant, no question. The route table never renders this without one,
     * but "never" is a property of today's routes rather than of this hook —
     * and the failure mode is a request to `/tenants//members`, answered with
     * the wordless refusal — which the request layer then tries to rescue by
     * renewing a perfectly good credential.
     */
    enabled: tenantId !== '',
  });
}

/**
 * What the three changes have in common.
 *
 * Every one of them ends with the listing being **read again** rather than
 * patched here. The backend decides more than the caller asked for — an
 * invitation may attach to a person who already exists, a revocation changes a
 * membership's status rather than removing a row — and a cache edited locally
 * is a second opinion about all of it that is right until the day it is not.
 */
function useMembersChange<TVariables>(
  tenantId: string,
  change: (variables: TVariables) => Promise<void>,
  alsoStanding: boolean,
): UseMutationResult<void, ApiError, TVariables> {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, TVariables>({
    mutationFn: change,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: keys.members(tenantId),
      });
      if (alsoStanding) {
        // 4.5: these two can change what the caller themselves may do, and the
        // navigation must stop offering what the new role does not permit. The
        // credential is unchanged — only the answer to "who are you here" is.
        await queryClient.invalidateQueries({ queryKey: keys.standing });
      }
    },
  });
}

export function useInviteMember(
  tenantId: string,
): UseMutationResult<void, ApiError, { email: string; role: Role }> {
  return useMembersChange(
    tenantId,
    (invitation) => inviteMember(tenantId, invitation),
    // Inviting somebody else cannot change the caller's own standing.
    false,
  );
}

export function useChangeMemberRole(
  tenantId: string,
): UseMutationResult<void, ApiError, { membershipId: string; role: Role }> {
  return useMembersChange(
    tenantId,
    ({ membershipId, role }) => changeMemberRole(tenantId, membershipId, role),
    true,
  );
}

export function useRevokeMembership(
  tenantId: string,
): UseMutationResult<void, ApiError, { membershipId: string }> {
  return useMembersChange(
    tenantId,
    ({ membershipId }) => revokeMembership(tenantId, membershipId),
    true,
  );
}
