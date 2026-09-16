import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { questionBodyOf, type Composition } from '../analytics/composition';
import { holdQuestions, secondsHeld, subscribe } from '../analytics/hold';
import { askQuestion, fetchVocabulary } from '../api/endpoints';
import { ApiError } from '../api/refusal';
import type { ModelledAnswer, Vocabulary } from '../api/types';
import { keys } from './keys';

/**
 * The platform's analytics as server state.
 *
 * Three of this feature's rules live here rather than in a screen, because all
 * three are about **when a question is asked** rather than about what it shows:
 * once per showing (2.7), once per tenant (1.2, 1.3), and never while the
 * platform has said to wait (7.3).
 *
 * Retries stay off, as everywhere: the request layer owns the one retry this
 * application allows, because it is the only layer that knows why it is
 * retrying.
 */

/**
 * What this tenant's platform offers.
 *
 * Held for the session once fetched. The vocabulary changes when the platform
 * is deployed, not while somebody is looking at it, and every view that needs
 * it shares one answer.
 */
export function useVocabulary(
  tenantId: string,
): UseQueryResult<Vocabulary, ApiError> {
  return useQuery<Vocabulary, ApiError>({
    queryKey: keys.vocabulary(tenantId),
    queryFn: () => fetchVocabulary(tenantId),
    staleTime: Infinity,
    // No tenant, no question. The route would answer the wordless refusal, and
    // the request layer would spend a renewal trying to rescue a good
    // credential from it.
    enabled: tenantId !== '',
  });
}

/**
 * One composition's answer, or nothing while there is no composition to ask.
 *
 * **Discarded when its last view leaves** (`gcTime: 0`), which is what makes
 * coming back a new showing rather than a look at whatever was on screen last
 * time. **Never asked again while it is on screen** (`staleTime: Infinity`, no
 * refetch on focus or reconnect): a window regaining focus is not a new
 * showing, and re-asking would spend one of the ten questions a minute the
 * platform allows.
 *
 * **Not asked at all while the platform has said to wait.** The hold is set
 * here, from the refusal that carries the wait, and it belongs to the caller:
 * another composition and another tenant are held by the same one, because the
 * platform counts a person rather than a screen.
 */
export function useAnswer(
  tenantId: string,
  composition: Composition | null,
): UseQueryResult<ModelledAnswer, ApiError> {
  const secondsLeft = useQuestionHold();
  const body = composition === null ? null : questionBodyOf(composition);

  return useQuery<ModelledAnswer, ApiError>({
    queryKey: keys.answer(tenantId, body),
    queryFn: async () => {
      if (body === null) throw new ApiError({ kind: 'unavailable' });
      try {
        return await askQuestion(tenantId, body);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.refusal.kind === 'throttled' &&
          error.refusal.retryAfterSeconds !== undefined
        ) {
          holdQuestions(error.refusal.retryAfterSeconds);
        }
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: body !== null && secondsLeft === 0,
  });
}

/**
 * The seconds left of the platform's wait, counting down while one is running.
 *
 * Re-renders once a second only while held: the ticker exists to move a
 * countdown a person is reading, and a view that is not waiting is not woken
 * for it.
 */
export function useQuestionHold(): number {
  return useSyncExternalStore(whileHeld, () => secondsHeld());
}

function whileHeld(onChange: () => void): () => void {
  const stopListening = subscribe(onChange);
  const ticking = setInterval(onChange, 1_000);

  return () => {
    stopListening();
    clearInterval(ticking);
  };
}
