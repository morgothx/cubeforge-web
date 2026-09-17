import { http, HttpResponse } from 'msw';
import { backend, answers, refusals } from '../../../test/handlers';
import { renderAt, screen, waitFor } from '../../../test/render';
import { countRequests, held, server } from '../../../test/server';
import { dayFrom, type Day } from '../../analytics/calendar';
import { checkComposition, type Checked } from '../../analytics/composition';
import { holdQuestions } from '../../analytics/hold';
import {
  cumulativeNote,
  describeProblem,
  describeProvenance,
  neverExported,
  nothingRecorded,
  unreadableAnswer,
} from '../../analytics/wording';
import { session } from '../../api/session';
import type { ModelledAnswer, RowValue } from '../../api/types';
import { AnswerView } from './AnswerView';

/**
 * One composition, in every state it can reach.
 *
 * The sentences are asserted **through `wording.ts`** rather than as literals.
 * This component's claim is that it says what that module says; whether the
 * sentence itself is right is that module's own claim, tested in its own file.
 * Spelling the words out here would make one wording change fail in two places
 * and tempt somebody to keep a stale copy alive in the test.
 */

const vocabulary = backend.analytics.vocabulary;
const TENANT = 't-acme';
const QUESTIONS = `/api/tenants/${TENANT}/analytics/questions`;
const ROUTE = '/api/tenants/:tenantId/analytics/questions';

const FROM = '2026-08-12';
const TO = '2026-09-10';

function checkedOf(measures: string[], groupings: string[] = []): Checked {
  return checkComposition(
    { measures, groupings, from: FROM, to: TO, by: 'recorded' },
    vocabulary,
  );
}

/** A day, made the way the application makes one — never cast into being. */
function day(text: string): Day {
  const parsed = dayFrom(text);
  if (parsed === null) throw new Error(`${text} is not a day`);
  return parsed;
}

function answered(rows: readonly Readonly<Record<string, RowValue>>[]) {
  return {
    state: 'answered',
    completeThrough: backend.analytics.completeThrough,
    servedFrom: 'prepared',
    rows,
  } satisfies ModelledAnswer;
}

function view(checked: Checked) {
  return renderAt(
    <AnswerView
      title="Movements"
      tenantId={TENANT}
      vocabulary={vocabulary}
      checked={checked}
    />,
  );
}

const asked = () => countRequests('POST', QUESTIONS);

beforeEach(() => {
  localStorage.clear();
  session.adopt(backend.session);
});

describe('one composition, rendered in every state it can reach', () => {
  it('says every problem the composition has, and asks nothing', () => {
    // Two problems at once: no measure, and a period running backwards. Both
    // are shown, rather than one fixed to be told of the next.
    const unaskable = checkComposition(
      { measures: [], groupings: [], from: TO, to: FROM, by: 'recorded' },
      vocabulary,
    );

    view(unaskable);

    expect(
      screen.getByText(describeProblem({ kind: 'no-measure' })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(describeProblem({ kind: 'reversed' })),
    ).toBeInTheDocument();
    expect(asked()).toBe(0);
  });

  /**
   * 7.3: the platform said to wait, so the view says how long and asks nothing.
   * A question sent now would only be refused and spend another of the ten a
   * minute the platform allows.
   */
  it('says how long to wait while the platform holds it, and asks nothing', () => {
    holdQuestions(42);

    view(checkedOf(['net_quantity'], ['kind']));

    expect(screen.getByText(/42 seconds/)).toBeInTheDocument();
    expect(asked()).toBe(0);
  });

  /** 6.1: waiting is said out loud, and then it is gone. */
  it('waits out loud, then gives way to the answer', async () => {
    const gate = held();
    server.use(
      http.post(ROUTE, async () => {
        await gate.until;
        return HttpResponse.json(answered(backend.analytics.movements));
      }),
    );

    view(
      checkedOf(['net_quantity', 'movement_count'], ['recorded_day', 'kind']),
    );

    expect(await screen.findByRole('status')).toBeInTheDocument();

    gate.release();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders an answer as a table, a chart and its currency', async () => {
    const { container } = view(checkedOf(['net_quantity'], ['kind']));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(
      screen.getByText(describeProvenance('prepared')),
    ).toBeInTheDocument();
  });

  /** 2.4: the same misreading is available wherever a cumulative measure is. */
  it('notes what a cumulative measure counts', async () => {
    view(checkedOf(['on_hand_quantity'], ['product']));

    expect(
      await screen.findByText(cumulativeNote('on_hand_quantity')),
    ).toBeInTheDocument();
  });

  /**
   * 5.4. Not "an empty table": a tenant whose data has never arrived has no
   * rows to show and no axis to draw, and a frame around nothing reads as a
   * quiet period, which is a claim about their inventory nobody made.
   */
  it('draws neither table nor chart for a tenant nothing was exported for', async () => {
    server.use(answers.neverExported());

    const { container } = view(checkedOf(['net_quantity'], ['kind']));

    expect(await screen.findByText(neverExported())).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  /** 5.2: an answer that was nothing is still an answer, and says its currency. */
  it('says nothing was recorded, with the currency, for an answer with no rows', async () => {
    server.use(answers.answering(answered([])));

    view(checkedOf(['net_quantity'], ['kind']));

    expect(
      await screen.findByText(
        nothingRecorded(
          day(FROM),
          day(TO),
          backend.analytics.completeThrough,
          vocabulary.calendar,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(describeProvenance('prepared')),
    ).toBeInTheDocument();
  });

  /**
   * A figure the reader could not make sense of is a fault, not a fact: showing
   * it as "nothing was recorded" would turn the dashboard's failure into a
   * statement about the tenant's stock.
   */
  it('says an unreadable answer could not be read, and draws none of it', async () => {
    server.use(
      answers.answering(
        answered([{ kind: 'receipt', net_quantity: 'quite a lot' }]),
      ),
    );

    const { container } = view(checkedOf(['net_quantity'], ['kind']));

    expect(await screen.findByText(unreadableAnswer())).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  /**
   * 7.4: the retry belongs beside the thing that failed, inside the view, so
   * the rest of the page stays usable and the offer is attached to what it
   * would retry.
   */
  it('puts a retry inside the view when the service could not be reached', async () => {
    server.use(refusals.unanswerable('post', ROUTE));

    const { container } = view(checkedOf(['net_quantity'], ['kind']));

    const notice = await screen.findByRole('alert');
    expect(notice).toBeInTheDocument();
    expect(container).toContainElement(notice);
    expect(
      await screen.findByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });

  /** A refusal that named no remedy offers no button that could not work. */
  it('offers no retry for a refusal that would answer the same way again', async () => {
    server.use(refusals.wordless('post', ROUTE));

    view(checkedOf(['net_quantity'], ['kind']));

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  /**
   * 7.5. The `503` body carries a `reason` the platform wrote for itself, and a
   * refused question carries names. Neither is the person's, and neither may
   * reach the screen — nor may any status code or raw body.
   */
  it('shows no status, no body and no refused name', async () => {
    server.use(refusals.unanswerable('post', ROUTE));

    const { container } = view(checkedOf(['net_quantity'], ['kind']));
    await screen.findByRole('alert');

    const shown = container.textContent ?? '';
    expect(shown).not.toContain('503');
    expect(shown).not.toContain('model-unreachable');
    expect(shown).not.toContain('unavailable');
  });

  it('names nothing the platform refused, when it refuses a name', async () => {
    // A composition the local check would never produce: only the platform can
    // tell this dashboard that a name it was offered is gone.
    const stale: Checked = {
      ok: true,
      composition: {
        measures: ['revenue'],
        groupings: [],
        from: day(FROM),
        to: day(TO),
        by: 'recorded',
      },
    };

    const { container } = view(stale);

    await screen.findByRole('alert');
    await waitFor(() => {
      expect(container.textContent ?? '').not.toContain('revenue');
    });
  });
});
