import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listMembers } from '../api/endpoints';
import type { ApiError } from '../api/refusal';
import type { Member } from '../api/types';
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
     * and the failure mode is a request whose tenant segment is empty, which
     * the backend answers with the wordless refusal — and the request layer
     * then tries to rescue it by renewing a perfectly good credential.
     */
    enabled: tenantId !== '',
  });
}
