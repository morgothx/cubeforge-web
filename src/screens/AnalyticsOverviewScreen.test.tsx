import { focusManager } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useLocation } from 'react-router';
import { backend } from '../../test/handlers';
import {
  act,
  renderSignedIn,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { countRequests, server } from '../../test/server';
import { defaultPeriod } from '../analytics/composition';
import { cumulativeNote } from '../analytics/wording';
import { session } from '../api/session';
import type { QuestionBody } from '../api/types';
import { AppRoutes } from '../routes/AppRoutes';

/**
 * The overview: two answers nobody had to ask for.
 *
 * Most of what this screen owes is a count rather than a render (2.7). An
 * overview that asked again on every re-render, every refocus or every
 * re-choice of the same period would look exactly the same on screen, and
 * spend the ten questions a minute the platform allows before anybody noticed.
 * So the requests are counted, and every count is taken only after the answers
 * are on screen — a request that failed would be counted too, and an answer on
 * screen is the proof it did not.
 */

const vocabulary = backend.analytics.vocabulary;
const QUESTIONS = '/api/tenants/t-acme/analytics/questions';

/** The moment the default period is measured from: 12 August to 10 September. */
const NOW = new Date('2026-09-10T01:00:00.000Z');

/** Every question body the overview sent, in order. */
let sent: QuestionBody[] = [];

/** The address the screen is served at, path and query apart. */
function Where() {
  const { pathname, search } = useLocation();
  return (
    <>
      <p>at {pathname}</p>
      <p>asking {search}</p>
    </>
  );
}

function show(at = '/t/t-acme/analytics') {
  return renderSignedIn(
    <>
      <AppRoutes />
      <Where />
    </>,
    { at },
  );
}

const asked = () => countRequests('POST', QUESTIONS);

/** Both answers on screen: a product by its name, and a kind of movement. */
async function bothAnswered() {
  expect(await screen.findByText(/the W-1 widget/)).toBeInTheDocument();
  expect(await screen.findAllByText('receipt')).not.toHaveLength(0);
}

beforeEach(() => {
  localStorage.clear();
  session.end();
  sent = [];
  // Only the clock is faked. React Query and the request harness keep real
  // timers, so nothing here waits on a timer being advanced by hand.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  server.use(
    // Records the body and answers nothing, so the route's own handler still
    // answers: this observes the request rather than replacing it.
    http.post(
      '/api/tenants/:tenantId/analytics/questions',
      async ({ request }) => {
        sent.push((await request.clone().json()) as QuestionBody);
        return undefined;
      },
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the analytics overview', () => {
  it('shows both answers without anybody composing anything (2.1–2.3)', async () => {
    show();

    await bothAnswered();
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });

  it('notes what on hand counts, wherever on hand is shown (2.4)', async () => {
    show();

    await bothAnswered();
    expect(
      screen.getByText(cumulativeNote('on_hand_quantity')),
    ).toBeInTheDocument();
  });

  it('covers the thirty days ending today, in the platform’s calendar (2.5)', async () => {
    show();

    await bothAnswered();
    const { from, to } = defaultPeriod(vocabulary, NOW);
    expect(from).toBe('2026-08-12');
    expect(sent).toHaveLength(2);
    for (const body of sent) {
      expect({ from: body.from, to: body.to }).toEqual({ from, to });
    }
  });

  it('asks each question once per showing (2.7)', async () => {
    show();

    await bothAnswered();
    expect(asked()).toBe(2);

    // A window losing and regaining focus is not a new showing.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    // Choosing the period already shown writes it into the address and
    // re-renders the screen; the questions are the same questions.
    act(() => {
      screen.getByRole('button', { name: /show/i }).click();
    });
    expect(
      await screen.findByText('asking ?from=2026-08-12&to=2026-09-10'),
    ).toBeInTheDocument();
    await bothAnswered();

    expect(asked()).toBe(2);
  });

  it('asks both again when the person leaves and comes back (2.7)', async () => {
    show();
    await bothAnswered();
    expect(asked()).toBe(2);

    const sections = screen.getByRole('navigation', { name: /section/i });
    act(() => {
      within(sections)
        .getByRole('link', { name: /members/i })
        .click();
    });
    expect(await screen.findByText('at /t/t-acme/members')).toBeInTheDocument();

    act(() => {
      within(screen.getByRole('navigation', { name: /section/i }))
        .getByRole('link', { name: /analytics/i })
        .click();
    });
    await bothAnswered();

    await waitFor(() => {
      expect(asked()).toBe(4);
    });
  });

  it('takes a chosen period into the address and into both questions (2.6)', async () => {
    show();
    await bothAnswered();

    const from = screen.getByLabelText(/from/i);
    await userEvent.clear(from);
    await userEvent.type(from, '2026-09-01');
    await userEvent.click(screen.getByRole('button', { name: /show/i }));

    expect(
      await screen.findByText('asking ?from=2026-09-01&to=2026-09-10'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(sent).toHaveLength(4);
    });
    for (const body of sent.slice(2)) {
      expect({ from: body.from, to: body.to }).toEqual({
        from: '2026-09-01',
        to: '2026-09-10',
      });
    }
    await bothAnswered();
  });

  it('reads the period from an address that names one', async () => {
    show('/t/t-acme/analytics?from=2026-09-01&to=2026-09-05');

    await bothAnswered();
    // Two, or the loop below proves nothing about bodies that were never sent.
    expect(sent).toHaveLength(2);
    for (const body of sent) {
      expect({ from: body.from, to: body.to }).toEqual({
        from: '2026-09-01',
        to: '2026-09-05',
      });
    }
  });
});
