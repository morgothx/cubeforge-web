import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { backend, refusals } from '../../test/handlers';
import { countRequests, server } from '../../test/server';
import {
  checkComposition,
  questionBodyOf,
  type Composition,
} from '../analytics/composition';
import { holdQuestions, secondsHeld } from '../analytics/hold';
import { session } from '../api/session';
import { useAnswer, useQuestionHold, useVocabulary } from './analytics';
import { createQueryClient } from './client';
import { keys } from './keys';

/**
 * The queries, at the level where their properties are visible.
 *
 * Three of this feature's rules are counts rather than renders — one request
 * per showing (2.7), one per tenant (1.2), and none at all while the platform
 * says to wait (7.3) — and a screen test can only see them indirectly. The
 * design left these to the screens; this file is the one addition to its plan,
 * because a property asserted where it is decided fails for the right reason.
 */

const vocabulary = backend.analytics.vocabulary;

const QUESTIONS = (tenant: string) =>
  `/api/tenants/${tenant}/analytics/questions`;
const VOCABULARY = (tenant: string) =>
  `/api/tenants/${tenant}/analytics/vocabulary`;

function composed(measures: string[], groupings: string[] = []): Composition {
  const checked = checkComposition(
    {
      measures,
      groupings,
      from: '2026-08-12',
      to: '2026-09-10',
      by: 'recorded',
    },
    vocabulary,
  );
  if (!checked.ok) throw new Error('expected a composition');
  return checked.composition;
}

/** One client per render, so no cache survives into the next test. */
function inAClient(client: QueryClient = createQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  session.adopt(backend.session);
});

describe('what may be asked, asked once', () => {
  it('asks a tenant’s vocabulary once, however many views want it', async () => {
    const { wrapper } = inAClient();

    const { result } = renderHook(
      () => [useVocabulary('t-acme'), useVocabulary('t-acme')] as const,
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[0].data).toEqual(vocabulary);
      expect(result.current[1].data).toEqual(vocabulary);
    });
    expect(countRequests('GET', VOCABULARY('t-acme'))).toBe(1);
  });

  it('asks each tenant its own', async () => {
    const { wrapper } = inAClient();

    const { result } = renderHook(
      () => [useVocabulary('t-acme'), useVocabulary('t-globex')] as const,
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[1].data).toEqual(vocabulary);
    });
    expect(countRequests('GET', VOCABULARY('t-acme'))).toBe(1);
    expect(countRequests('GET', VOCABULARY('t-globex'))).toBe(1);
  });

  it('asks nothing without a tenant to ask about', async () => {
    const { wrapper } = inAClient();

    renderHook(() => useVocabulary(''), { wrapper });

    await waitFor(() => {
      expect(countRequests('GET', VOCABULARY(''))).toBe(0);
    });
  });
});

describe('an answer, asked once per showing', () => {
  it('asks one question for two views of one composition', async () => {
    const { wrapper } = inAClient();
    const composition = composed(['net_quantity'], ['kind']);

    const { result } = renderHook(
      () =>
        [
          useAnswer('t-acme', composition),
          useAnswer('t-acme', composition),
        ] as const,
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[0].data?.state).toBe('answered');
      expect(result.current[1].data?.state).toBe('answered');
    });
    expect(countRequests('POST', QUESTIONS('t-acme'))).toBe(1);
  });

  /**
   * 1.2 and 1.3: the tenant is part of the key, so one tenant's answer can
   * never be read for another — and an answer that arrives after the person
   * has switched away is written under a key nothing on screen is reading.
   */
  it('asks the same composition again for another tenant', async () => {
    const { wrapper } = inAClient();
    const composition = composed(['net_quantity'], ['kind']);

    const { result } = renderHook(
      () =>
        [
          useAnswer('t-acme', composition),
          useAnswer('t-globex', composition),
        ] as const,
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[1].data?.state).toBe('answered');
    });
    expect(countRequests('POST', QUESTIONS('t-acme'))).toBe(1);
    expect(countRequests('POST', QUESTIONS('t-globex'))).toBe(1);
  });

  /**
   * 2.7: an answer is discarded when its view leaves, so coming back is a new
   * showing and asks again. Held instead, the overview would show figures from
   * whenever the person last looked, with nothing saying so.
   */
  it('asks again when a view returns, because the answer left with it', async () => {
    const { client, wrapper } = inAClient();
    const composition = composed(['net_quantity'], ['kind']);

    const first = renderHook(() => useAnswer('t-acme', composition), {
      wrapper,
    });
    await waitFor(() => {
      expect(first.result.current.data?.state).toBe('answered');
    });
    first.unmount();

    // The discard is the mechanism, so it is what gets asserted: an answer
    // whose last view left is collected rather than kept. Without this the
    // test would remount inside the same tick, find the entry still waiting to
    // be collected, and pass or fail on timing rather than on the rule.
    await waitFor(() => {
      expect(
        client.getQueryData(keys.answer('t-acme', questionBodyOf(composition))),
      ).toBeUndefined();
    });

    const again = renderHook(() => useAnswer('t-acme', composition), {
      wrapper,
    });
    await waitFor(() => {
      expect(again.result.current.data?.state).toBe('answered');
    });

    expect(countRequests('POST', QUESTIONS('t-acme'))).toBe(2);
  });

  it('asks nothing until there is a composition to ask', async () => {
    const { wrapper } = inAClient();

    renderHook(() => useAnswer('t-acme', null), { wrapper });

    await waitFor(() => {
      expect(countRequests('POST', QUESTIONS('t-acme'))).toBe(0);
    });
  });
});

describe('a platform that said to wait', () => {
  it('holds every question for as long as it was told', async () => {
    server.use(
      refusals.paced('post', '/api/tenants/:tenantId/analytics/questions', 42),
    );
    const { wrapper } = inAClient();

    const first = renderHook(
      () => useAnswer('t-acme', composed(['net_quantity'], ['kind'])),
      { wrapper },
    );
    await waitFor(() => {
      expect(first.result.current.error?.refusal).toEqual({
        kind: 'throttled',
        retryAfterSeconds: 42,
      });
    });

    // The refusal set the hold, which belongs to the caller rather than to a
    // view: another composition, and another tenant, are held by it too.
    expect(secondsHeld()).toBeGreaterThan(0);

    renderHook(
      () => useAnswer('t-globex', composed(['movement_count'], ['kind'])),
      { wrapper },
    );
    await waitFor(() => {
      expect(countRequests('POST', QUESTIONS('t-globex'))).toBe(0);
    });
    expect(countRequests('POST', QUESTIONS('t-acme'))).toBe(1);
  });

  /**
   * The countdown alone, with the hold set directly.
   *
   * Written this way after the first version mounted a paced question here
   * too: the route stays refused for the whole test, so when the wait ran out
   * the query asked again, was paced again, and the countdown restarted — the
   * hook was right and the test was asking two things at once. That the
   * refusal sets the hold is the previous test's claim.
   */
  it('reports the seconds left, and stops reporting when they run out', async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = inAClient();
      const { result } = renderHook(() => useQuestionHold(), { wrapper });

      expect(result.current).toBe(0);

      act(() => {
        holdQuestions(3);
      });
      expect(result.current).toBe(3);

      // Inside `act`, because the countdown's ticks are React state updates
      // arriving from an interval rather than from an event. Outside it the
      // hook's last rendered value is whatever the previous tick left, and the
      // assertion reads a stale number rather than the hold.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(result.current).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(result.current).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
