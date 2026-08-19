import { QueryClient } from '@tanstack/react-query';

/**
 * Server state, with retries off.
 *
 * Retrying here would be wrong rather than merely wasteful. This backend
 * answers an expired credential and a genuine refusal identically, so a retry
 * at this level cannot tell which it is repeating: it would hammer refusals
 * that will never succeed and delay every failure the person is waiting on.
 * The one retry this feature allows belongs to the request layer, which is the
 * only place that renews the credential and therefore the only place that knows
 * why it is trying again (3.4).
 *
 * A factory rather than a module singleton: each test needs a client whose
 * cache cannot leak into the next one, and signing out replaces the cache
 * rather than reaching into it.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
