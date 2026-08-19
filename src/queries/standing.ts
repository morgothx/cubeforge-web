import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchStanding } from '../api/endpoints';
import type { ApiError } from '../api/refusal';
import type { CallerStanding } from '../api/types';
import { useSession } from '../session/useSession';
import { keys } from './keys';

/**
 * Who the caller is, where they may act, and the role they hold in each place.
 *
 * The answer is taken exactly as it arrives. The backend already excludes every
 * membership that no longer grants access — revoked ones, and ones in a tenant
 * that is no longer active — so any filter here would be a second answer to a
 * question already answered, and the only tenants it could ever remove are ones
 * the person really can reach (9.3).
 */
export function useStanding(): UseQueryResult<CallerStanding, ApiError> {
  const { status } = useSession();

  return useQuery<CallerStanding, ApiError>({
    queryKey: keys.standing,
    queryFn: fetchStanding,

    /**
     * Not while there is no session. Without a credential this route answers
     * the same wordless `404` as a refusal, so the sign-in screen would sit
     * behind an error about nothing.
     *
     * While it is off the result is `pending` with an `idle` fetch status,
     * which is React Query's way of saying nobody asked. A caller that reads
     * `isPending` alone would show a spinner to somebody who is signed out —
     * which is why every consumer of this sits behind a signed-in route.
     */
    enabled: status.state === 'signed-in',

    /**
     * Read once per session.
     *
     * Nothing about who the caller is changes on its own, and the two things
     * that can change it from here — their own role, their own membership —
     * invalidate this key explicitly (4.5). Leaving it stale by default would
     * ask the backend who the caller is every time a layout remounted, and a
     * time-based window would only make that arbitrary rather than rare.
     */
    staleTime: Infinity,
  });
}
