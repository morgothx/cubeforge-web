import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { backend, refusals } from '../../test/handlers';
import {
  act,
  renderSignedIn,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { countRequests, held, server } from '../../test/server';
import { describeProblem } from '../analytics/wording';
import { session } from '../api/session';
import type { ModelledAnswer, QuestionBody, RowValue } from '../api/types';
import { AppRoutes } from '../routes/AppRoutes';

/**
 * The explorer: a composer and an address in front of the same machinery.
 *
 * Three of its claims are counts rather than renders (3.3, 3.4, 7.3). A
 * composition that cannot be asked must not be asked — and an empty screen is
 * not evidence of that, because a question asked and refused looks the same to
 * a reader. So the requests are counted.
 */

const vocabulary = backend.analytics.vocabulary;
const QUESTIONS = '/api/tenants/t-acme/analytics/questions';
const ROUTE = '/api/tenants/:tenantId/analytics/questions';
const EXPLORE = '/t/t-acme/analytics/explore';

/** Every question body the explorer sent, in order. */
let sent: QuestionBody[] = [];

/** The address being served, path and query apart. */
function Where() {
  const { pathname, search } = useLocation();
  return (
    <>
      <p>at {pathname}</p>
      <p>asking {search}</p>
    </>
  );
}

function explore(at = EXPLORE) {
  return renderSignedIn(
    <>
      <AppRoutes />
      <Where />
    </>,
    { at },
  );
}

const asked = () => countRequests('POST', QUESTIONS);

/** Records each body without answering, so the route's own handler still does. */
function recordBodies() {
  server.use(
    http.post(ROUTE, async ({ request }) => {
      sent.push((await request.clone().json()) as QuestionBody);
      return undefined;
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  session.end();
  sent = [];
  recordBodies();
});

describe('composing a question in the explorer', () => {
  /**
   * 3.2 at the screen's own level: a handler serving a different vocabulary
   * changes what is offered with no line of code changing, which is the check
   * that nothing here is written down.
   */
  it('offers exactly the vocabulary’s measures and groupings, in its order', async () => {
    explore();

    const measures = await screen.findByRole('group', { name: /measures/i });
    expect(
      Array.from(measures.querySelectorAll('input[type="checkbox"]')).map(
        (box) => box.getAttribute('value'),
      ),
    ).toEqual(vocabulary.measures.map(({ name }) => name));

    const groupings = screen.getByRole('group', { name: /groupings/i });
    expect(
      Array.from(groupings.querySelectorAll('input[type="checkbox"]')).map(
        (box) => box.getAttribute('value'),
      ),
    ).toEqual(vocabulary.groupings.map(({ name }) => name));
  });

  it('follows a platform that publishes something else', async () => {
    server.use(
      http.get('/api/tenants/:tenantId/analytics/vocabulary', () =>
        HttpResponse.json({
          ...vocabulary,
          measures: [{ name: 'revenue', cumulative: false }],
        }),
      ),
    );

    explore();

    expect(
      await screen.findByRole('checkbox', { name: 'revenue' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'net_quantity' })).toBeNull();
  });

  it('asks nothing while no measure is chosen, and says one is needed (3.3)', async () => {
    explore();

    expect(
      await screen.findByText(describeProblem({ kind: 'no-measure' })),
    ).toBeInTheDocument();
    expect(asked()).toBe(0);
  });

  it('asks nothing for a period the platform does not answer (3.4)', async () => {
    explore(`${EXPLORE}?measures=net_quantity&from=2025-09-09&to=2026-09-10`);

    expect(
      await screen.findByText(
        describeProblem({
          kind: 'too-long',
          longestDays: vocabulary.longestPeriodDays,
        }),
      ),
    ).toBeInTheDocument();
    expect(asked()).toBe(0);
  });

  /** 3.9: an address naming what the platform does not offer says so. */
  it('reports an address the platform cannot be asked, and asks nothing', async () => {
    explore(`${EXPLORE}?measures=revenue&from=2026-08-12&to=2026-09-10`);

    expect(
      await screen.findByText(
        describeProblem({ kind: 'not-offered', names: ['revenue'] }),
      ),
    ).toBeInTheDocument();
    expect(asked()).toBe(0);
  });

  it('writes the asked composition into the address, and asks it (3.8)', async () => {
    explore();

    await screen.findByRole('group', { name: /measures/i });
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'net_quantity' }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'kind' }));
    await userEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(
      await screen.findByText(/asking .*measures=net_quantity/),
    ).toBeInTheDocument();
    expect(screen.getByText(/asking .*groupings=kind/)).toBeInTheDocument();

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({
      measures: ['net_quantity'],
      groupings: ['kind'],
      by: 'recorded',
    });
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('asks the same question when that address is opened fresh (3.8)', async () => {
    explore(
      `${EXPLORE}?measures=net_quantity&groupings=kind&from=2026-08-12&to=2026-09-10&by=recorded`,
    );

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(asked()).toBe(1);
    expect(sent[0]).toEqual({
      measures: ['net_quantity'],
      groupings: ['kind'],
      from: '2026-08-12',
      to: '2026-09-10',
      by: 'recorded',
    });
  });
});

describe('a composition changed while an earlier one is still being answered', () => {
  /**
   * 6.3. The first answer is held open, a second composition is asked, and then
   * the first is released. The first answer must never be on screen — it is
   * the answer to a question nobody is asking any more, and it would be read
   * as the answer to the one they are.
   */
  it('shows only the latest composition’s answer', async () => {
    const first = held();
    server.use(
      http.post(ROUTE, async ({ request }) => {
        const body = (await request.clone().json()) as QuestionBody;
        sent.push(body);

        const rows: Record<string, RowValue>[] = body.groupings.includes(
          'product',
        )
          ? [
              {
                product_code: 'W-9',
                product_name: 'the stale widget',
                net_quantity: '99',
              },
            ]
          : [{ kind: 'receipt', net_quantity: '7' }];

        if (body.groupings.includes('product')) await first.until;

        return HttpResponse.json({
          state: 'answered',
          completeThrough: backend.analytics.completeThrough,
          servedFrom: 'prepared',
          rows,
        } satisfies ModelledAnswer);
      }),
    );

    explore(
      `${EXPLORE}?measures=net_quantity&groupings=product&from=2026-08-12&to=2026-09-10&by=recorded`,
    );

    // The composer first: `role="status"` is worn by two different waits here —
    // the vocabulary's and the answer's — and awaiting the role alone resolved
    // on the vocabulary, before the composer existed.
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'product' }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'kind' }));
    // The first question is still open at this point: its answer is waiting.
    expect(screen.getByRole('status')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^ask$/i }));

    first.release();

    // Twice over, in a drawn answer: the table's cell and the chart's axis.
    expect(await screen.findAllByText('receipt')).not.toHaveLength(0);
    expect(screen.queryByText(/the stale widget/)).toBeNull();
    expect(screen.queryByText('99')).toBeNull();
  });
});

describe('a question refused because too many were asked', () => {
  /**
   * 7.3, with the clock under the test's control. The wait is honoured by
   * issuing nothing at all — not by asking and being refused again, which is
   * what spends the next of the ten a minute the platform allows.
   */
  it('issues nothing while held, and asks once when the wait passes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      server.use(refusals.paced('post', ROUTE, 3));

      explore(
        `${EXPLORE}?measures=net_quantity&groupings=kind&from=2026-08-12&to=2026-09-10&by=recorded`,
      );

      expect((await screen.findAllByText(/3 seconds/)).length).toBeGreaterThan(
        0,
      );
      expect(asked()).toBe(1);
      // Asking is refused at the button too, not only by the query. Without
      // this the hold could stop reaching the composer and nothing would
      // notice: the answer view says the wait on its own account, so the
      // sentence would still be on screen and the count still right — while
      // the button invited a press that did nothing at all.
      expect(screen.getByRole('button', { name: /^ask$/i })).toBeDisabled();

      // The route would refuse for the whole test otherwise, and each refusal
      // renews the hold — the countdown would restart rather than run out.
      server.resetHandlers();
      recordBodies();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_100);
      });

      expect(await screen.findByRole('table')).toBeInTheDocument();
      expect(asked()).toBe(2);
      expect(screen.getByRole('button', { name: /^ask$/i })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the analytics sub-navigation on the screens', () => {
  it('is offered on both the overview and the explorer', async () => {
    explore();
    const onExplorer = await screen.findByRole('navigation', {
      name: /analytics/i,
    });
    expect(
      within(onExplorer).getByRole('link', { name: 'Overview' }),
    ).toBeInTheDocument();

    act(() => {
      within(onExplorer).getByRole('link', { name: 'Overview' }).click();
    });

    expect(
      await screen.findByText('at /t/t-acme/analytics'),
    ).toBeInTheDocument();
    expect(
      within(
        await screen.findByRole('navigation', { name: /analytics/i }),
      ).getByRole('link', { name: 'Explore' }),
    ).toBeInTheDocument();
  });
});
