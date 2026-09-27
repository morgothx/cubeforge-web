import { http, HttpResponse } from 'msw';
import { backend, refusals } from '../../test/handlers';
import {
  findActingIn,
  renderSignedIn,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { countRequests, held, server } from '../../test/server';
import { session } from '../api/session';
import type { CallerStanding, ModelledAnswer, Role } from '../api/types';
import { AppRoutes } from './AppRoutes';

/**
 * The analytics belong to one tenant at a time, and to no other.
 *
 * This is the suite for the failure the whole feature is arranged around: an
 * answer for the tenant somebody **just left** arriving after they left, and
 * being drawn as though it were the answer for the tenant they are now in.
 * Nothing about that is visible on screen — the figures are real, the labels
 * are real, and they belong to somebody else's tenant.
 */

const QUESTIONS = (tenant: string) =>
  `/api/tenants/${tenant}/analytics/questions`;
const VOCABULARY = (tenant: string) =>
  `/api/tenants/${tenant}/analytics/vocabulary`;
const ROUTE = '/api/tenants/:tenantId/analytics/questions';

const COMPOSED =
  '?measures=net_quantity&groupings=kind&from=2026-08-12&to=2026-09-10&by=recorded';
const EXPLORE = `/t/t-acme/analytics/explore${COMPOSED}`;

/** Acme's figures, which must never be read as Globex's. */
const ACME_LABEL = 'the Acme-only widget';
const ACME_FIGURE = '4242';

function standingOf(overrides: Partial<CallerStanding>) {
  server.use(
    http.get('/api/me', () =>
      HttpResponse.json({ ...backend.caller, ...overrides }),
    ),
  );
}

function answerFor(tenantId: string | readonly string[]): ModelledAnswer {
  const acme = tenantId === 't-acme';
  return {
    state: 'answered',
    completeThrough: backend.analytics.completeThrough,
    servedFrom: 'prepared',
    rows: acme
      ? [{ kind: ACME_LABEL, net_quantity: ACME_FIGURE }]
      : [{ kind: 'receipt', net_quantity: '7' }],
  };
}

/**
 * Whether a piece of text was **ever** in the document, not merely whether it
 * is there now.
 *
 * 1.3 is a claim about every moment, and an assertion taken at the end would
 * pass just as happily on an answer that appeared, was read, and was replaced
 * a tick later — which is the whole of the bug.
 */
function everSeen(text: string) {
  const state = { ever: false };
  const look = () => {
    if (document.body.textContent?.includes(text) === true) state.ever = true;
  };
  const observer = new MutationObserver(look);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  look();
  return {
    state,
    stop: () => {
      observer.disconnect();
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('reaching a tenant’s analytics', () => {
  it.each(['admin', 'editor', 'viewer'] as const)(
    'serves the analytics to an %s of the tenant (1.1)',
    async (role: Role) => {
      standingOf({
        memberships: [{ tenantId: 't-acme', tenantName: 'Acme', role }],
      });

      renderSignedIn(<AppRoutes />, { at: '/t/t-acme/analytics' });

      // `findAllBy` resolves on the first match, and the overview draws two
      // answers: awaiting it alone would assert against whichever arrived
      // first. Both, or the role reaches only half the analytics.
      await waitFor(() => {
        expect(screen.getAllByRole('table')).toHaveLength(2);
      });
    },
  );

  /**
   * 3.10: a tenant the person cannot reach is answered by the shell's notice,
   * and nothing is asked about it — not the question, not even the vocabulary.
   */
  it('asks nothing at all for a tenant the person may not see', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-nobody/analytics/explore' });

    expect(
      await screen.findByRole('heading', { name: /no longer available/i }),
    ).toBeInTheDocument();
    expect(countRequests('POST', QUESTIONS('t-nobody'))).toBe(0);
    expect(countRequests('GET', VOCABULARY('t-nobody'))).toBe(0);
  });
});

describe('switching tenant while looking at an answer', () => {
  it('asks the same question of the other tenant (1.2)', async () => {
    renderSignedIn(<AppRoutes />, { at: EXPLORE });

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(countRequests('POST', QUESTIONS('t-acme'))).toBe(1);

    within(screen.getByRole('navigation', { name: /tenant/i }))
      .getByRole('link', { name: /^Globex/ })
      .click();

    expect(await findActingIn('Globex')).toBeInTheDocument();
    await waitFor(() => {
      expect(countRequests('POST', QUESTIONS('t-globex'))).toBe(1);
    });
  });

  /**
   * 1.3, the failure this feature is arranged around. Acme's answer is held
   * open, the person moves to Globex, and only then is Acme's released. It
   * lands under a key nothing on screen is reading, and so it is never drawn.
   */
  it('never shows an answer that arrives after the person has left (1.3)', async () => {
    const acme = held();
    server.use(
      http.post(ROUTE, async ({ params }) => {
        const tenantId = params['tenantId'];
        if (tenantId === 't-acme') await acme.until;
        return HttpResponse.json(answerFor(tenantId ?? ''));
      }),
    );

    const label = everSeen(ACME_LABEL);
    const figure = everSeen(ACME_FIGURE);

    try {
      renderSignedIn(<AppRoutes />, { at: EXPLORE });

      // Acme's question is in flight and will not be answered yet.
      expect(
        await screen.findByText(/Loading this question/i),
      ).toBeInTheDocument();

      within(screen.getByRole('navigation', { name: /tenant/i }))
        .getByRole('link', { name: /^Globex/ })
        .click();
      expect(await findActingIn('Globex')).toBeInTheDocument();

      acme.release();

      // Globex's answer arrives and is shown.
      expect(await screen.findAllByText('receipt')).not.toHaveLength(0);
      // And Acme's, released after the move, was never drawn at any moment.
      expect(label.state.ever).toBe(false);
      expect(figure.state.ever).toBe(false);
    } finally {
      label.stop();
      figure.stop();
    }
  });
});

describe('a question the platform refuses', () => {
  it('reports a refused tenant in the shell’s own words (1.4)', async () => {
    server.use(refusals.wordless('post', ROUTE));

    renderSignedIn(<AppRoutes />, { at: EXPLORE });

    expect(
      await screen.findByText('This is not available.'),
    ).toBeInTheDocument();
  });

  /**
   * 7.4: the notice belongs inside the analytics, and everything else goes on
   * working — the frame is not the thing that failed.
   */
  it('leaves the switcher, the navigation and the members screen usable on a 503', async () => {
    server.use(refusals.unanswerable('post', ROUTE));

    renderSignedIn(<AppRoutes />, { at: EXPLORE });

    const notice = await screen.findByRole('alert');
    expect(
      within(notice).getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
    // Inside the page, not in the frame around it.
    expect(screen.getByRole('main')).toContainElement(notice);

    within(screen.getByRole('navigation', { name: /section/i }))
      .getByRole('link', { name: /members/i })
      .click();

    expect(await screen.findAllByRole('row')).not.toHaveLength(0);
    expect(await findActingIn('Acme')).toBeInTheDocument();
  });
});

describe('while a question is still being answered', () => {
  /** A question that never comes back, which is the worst case 6.2 describes. */
  function neverAnswers() {
    server.use(http.post(ROUTE, () => new Promise<never>(() => undefined)));
  }

  it('lets the person switch tenant (6.2)', async () => {
    neverAnswers();
    renderSignedIn(<AppRoutes />, { at: EXPLORE });

    await findActingIn('Acme');
    within(screen.getByRole('navigation', { name: /tenant/i }))
      .getByRole('link', { name: /^Globex/ })
      .click();

    expect(await findActingIn('Globex')).toBeInTheDocument();
  });

  it('lets the person sign out (6.2)', async () => {
    neverAnswers();
    renderSignedIn(<AppRoutes />, { at: EXPLORE });

    await findActingIn('Acme');
    screen.getByRole('button', { name: /sign out/i }).click();

    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
