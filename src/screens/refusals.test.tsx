import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from '../routes/AppRoutes';
import { refusals } from '../../test/handlers';
import { renderSignedIn, screen, waitFor, within } from '../../test/render';
import { countRequests, server } from '../../test/server';
import { session } from '../api/session';

/**
 * One voice for every outcome, which is why this crosses the screens instead of
 * living inside one.
 *
 * Four screens each rendering their own version of "that did not work" would be
 * four voices agreeing by coincidence, and the coincidence ends the first time
 * somebody edits one of them. The test for that is not a rendering — it is a
 * scan: nothing above the request layer may read a status code, and only one
 * component turns a refusal into words.
 */

const user = userEvent.setup();

async function openListing() {
  renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });
  await screen.findByText('editor@example.com');
}

async function invite(address: string) {
  await user.type(screen.getByRole('textbox', { name: /invite/i }), address);
  await user.click(screen.getByRole('button', { name: /^invite$/i }));
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('a refusal that names a cause', () => {
  it('shows it against the field the backend named', async () => {
    server.use(
      refusals.conflict(
        'post',
        '/api/tenants/:tenantId/members',
        'that person is already a member of this tenant',
        'email',
      ),
    );
    await openListing();

    await invite('editor@example.com');

    // Against the field, in the way that actually reaches somebody using a
    // screen reader: the input describes itself with the reason.
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /invite/i }),
      ).toHaveAccessibleDescription(/already a member/i);
    });
  });

  it('repeats the backend’s words rather than inventing better ones', async () => {
    server.use(
      refusals.conflict(
        'patch',
        '/api/tenants/:tenantId/members/:membershipId',
        'a tenant must retain at least one active administrator',
      ),
    );
    await openListing();

    await user.selectOptions(
      within(screen.getByRole('row', { name: /caller@example.com/ })).getByRole(
        'combobox',
      ),
      'viewer',
    );

    // 8.2: shown as written. Rewording it would either lose the rule it refers
    // to or quietly disagree with the platform that enforced it.
    expect(
      await screen.findByText(
        'a tenant must retain at least one active administrator',
      ),
    ).toBeInTheDocument();
  });
});

describe('a refusal that names none', () => {
  /** The causes an unexplained refusal must never be dressed up as. */
  const GUESSES =
    /session|expired|permission|permitted|not found|does not exist|forbidden|unauthori[sz]ed|access denied/i;

  it('says only that it is unavailable', async () => {
    server.use(
      refusals.wordless(
        'delete',
        '/api/tenants/:tenantId/members/:membershipId',
      ),
    );
    await openListing();

    await user.click(
      within(screen.getByRole('row', { name: /gone@example.com/ })).getByRole(
        'button',
        { name: /revoke/i },
      ),
    );

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent(/not available/i);
    // 8.1. Every one of these is a guess, and by the time it is shown the
    // request layer has already renewed the credential and asked again.
    expect(said.textContent ?? '').not.toMatch(GUESSES);
  });

  it('leaves the listing there to try something else', async () => {
    server.use(
      refusals.wordless(
        'delete',
        '/api/tenants/:tenantId/members/:membershipId',
      ),
    );
    await openListing();

    await user.click(
      within(screen.getByRole('row', { name: /gone@example.com/ })).getByRole(
        'button',
        { name: /revoke/i },
      ),
    );

    await screen.findByRole('alert');
    // 6.3: an ordinary outcome. A role can change between drawing a control and
    // pressing it, so being refused is not an impossible state to recover from.
    expect(screen.getByText('editor@example.com')).toBeInTheDocument();
  });

  it('shows no status, no body, and no identifier', async () => {
    server.use(refusals.wordless('post', '/api/tenants/:tenantId/members'));
    await openListing();

    await invite('new@example.com');

    const said = await screen.findByRole('alert');
    // 8.5, asserted against the backend's actual body: the wordless refusal
    // carries a status and a sentence, and neither is the person's business.
    expect(said.textContent ?? '').not.toMatch(
      /404|statusCode|requested record/i,
    );
  });
});

describe('a service that could not be reached', () => {
  it('says so, and offers to try again', async () => {
    server.use(refusals.unreachable('post', '/api/tenants/:tenantId/members'));
    await openListing();

    await invite('new@example.com');

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent(/could not be reached/i);

    server.use(
      http.post(
        '/api/tenants/:tenantId/members',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await user.click(within(said).getByRole('button', { name: /try again/i }));

    // 8.3: distinct from a refusal because it is worth repeating. A wordless
    // refusal is not, and offers no such button.
    await waitFor(() => {
      expect(countRequests('POST', '/api/tenants/t-acme/members')).toBe(2);
    });
  });

  it('offers no such button for a refusal', async () => {
    server.use(refusals.wordless('post', '/api/tenants/:tenantId/members'));
    await openListing();

    await invite('new@example.com');

    const said = await screen.findByRole('alert');
    expect(within(said).queryByRole('button')).toBeNull();
  });
});

describe('one voice', () => {
  const sources = import.meta.glob('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  function above(path: string): boolean {
    return !path.startsWith('../api/') && !/\.test\.tsx?$/.test(path);
  }

  /**
   * The source with its comments removed.
   *
   * Prose about a route or a status reads exactly like one, and the scan
   * introduced in task 3.3 had already been tripped by a doc block describing
   * a path. What these tests are about is what the code does, so the comments
   * come out before the question is asked.
   */
  function code(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  it('lets nothing above the request layer read a status', () => {
    const reading = Object.entries(sources)
      .filter(([path]) => above(path))
      // `.status` and `statusCode` are the HTTP ones; `status.state` is the
      // session's and is nobody's business here.
      .filter(([, source]) =>
        /\bstatusCode\b|\.status\b|\b(400|404|409|429)\b/.test(code(source)),
      )
      .map(([path]) => path);

    // A component that branched on `404` would have re-created the guess the
    // whole refusal vocabulary exists to prevent — and no rendering test can
    // see the difference, because today it would branch the same way.
    expect(reading).toEqual([]);
  });

  it('turns a refusal into words in one place', () => {
    const describing = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => /describeRefusal/.test(code(source)))
      .map(([path]) => path)
      .sort();

    // The definition and the single component that renders it. A second caller
    // is a second voice, and the two agree until somebody edits one.
    expect(describing).toEqual([
      '../api/refusal.ts',
      '../components/RefusalNotice.tsx',
    ]);
  });
});
