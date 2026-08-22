import { http, HttpResponse } from 'msw';
import { AppRoutes } from './AppRoutes';
import { backend } from '../../test/handlers';
import {
  fireEvent,
  renderAt,
  renderSignedIn,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { countRequests, server } from '../../test/server';
import { session } from '../api/session';
import { SessionProvider } from '../session/SessionProvider';
import type { CallerStanding, TenantMembership } from '../api/types';

/**
 * The three addresses that lead nowhere, and the one rule they share.
 *
 * A tenant that is gone, an address that never existed, and a person who
 * belongs nowhere are three ordinary answers, not three failures. Each gets its
 * own words — "the same thing went wrong" is exactly the flattening this
 * feature refuses everywhere else — and none of them is allowed to read as a
 * page that failed to load, because a person told something broke waits, and
 * there is nothing to wait for.
 */

function standingOf(memberships: readonly TenantMembership[]) {
  const standing: CallerStanding = { ...backend.caller, memberships };
  server.use(http.get('/api/me', () => HttpResponse.json(standing)));
}

/**
 * The words a broken page uses. None of these three views may use them.
 *
 * Same mechanism as the refusal vocabulary in `refusal.ts`: a well-meant edit
 * that makes one of these sound like a crash fails here.
 */
const BROKEN =
  /error|failed|failure|went wrong|unexpected|try again|reload|refresh the page|problem/i;

function saysNothingBroke() {
  expect(document.body.textContent ?? '').not.toMatch(BROKEN);
  expect(screen.queryByRole('alert')).toBeNull();
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('a tenant the caller can no longer reach', () => {
  it('says the previous selection is gone', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-gone/members' });

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });

  it('offers the tenants that remain', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-gone/members' });

    const notice = await screen.findByRole('region', {
      name: /no longer available/i,
    });
    expect(
      within(notice)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Acme', 'Globex']);
  });

  it('does not render the tenant page behind the notice', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-gone/members' });

    await screen.findByText(/no longer available/i);
    expect(screen.queryByText('Members')).toBeNull();
  });

  it('waits for the standing rather than accusing the address', () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    // Nothing is known yet. A notice rendered now would tell somebody their
    // tenant is gone every single time the page loaded, and be right about it
    // for a fraction of a second by accident.
    expect(screen.queryByText(/no longer available/i)).toBeNull();
  });

  it('reads as an answer rather than as a breakage', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-gone/members' });

    await screen.findByText(/no longer available/i);
    saysNothingBroke();
  });
});

describe('an address that does not exist', () => {
  it('says it is not available, inside the frame, to somebody signed in', async () => {
    renderSignedIn(<AppRoutes />, { at: '/somewhere-invented' });

    expect(await screen.findByText(/not available/i)).toBeInTheDocument();
    // Task 5.1: the panel is still there, and it still lists the tenants.
    // Somebody who mistyped an address has not left the application, and
    // taking the navigation away to tell them so makes a wrong turn look like
    // a wall. Awaited, because the panel arrives with the standing while the
    // card does not wait for anything.
    const tenants = await screen.findByRole('navigation', { name: /tenant/i });
    expect(
      within(tenants)
        .getAllByRole('link')
        .map((link) => link.firstChild?.textContent),
    ).toEqual(['Acme', 'Globex']);
    // Nothing is current, because the address names no tenant.
    expect(tenants.querySelector('[aria-current]')).toBeNull();
    expect(
      screen.getByRole('link', { name: /back to members/i }),
    ).toHaveAttribute('href', '/');
  });

  it('says the same to somebody with no session', async () => {
    renderAt(
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>,
      {
        at: '/somewhere-invented',
      },
    );

    // An address that does not exist is no reason to ask for a password, and
    // the answer does not depend on who is asking.
    expect(await screen.findByText(/not available/i)).toBeInTheDocument();
  });

  it('offers a signed-out visitor no frame and no dashboard', async () => {
    renderAt(
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>,
      { at: '/somewhere-invented' },
    );

    await screen.findByText(/not available/i);
    // Nothing to frame: there is no standing, no tenant and no identity, and a
    // panel drawn around those would be a panel of empty slots.
    //
    // Asserted on the `main` landmark, which the frame always renders, rather
    // than on the panel, which it renders only once the standing arrives. The
    // panel's absence is not evidence: a probe that wrapped this route in the
    // frame regardless of the session passed every other assertion here,
    // because signed out the standing query never runs and the panel never
    // appears anyway. Absent for the right reason, or it is absent by luck.
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
    // "Back to Members" names a room this person has never been in. The one
    // real exit is the door in.
    expect(screen.queryByText(/back to members/i)).toBeNull();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('reads as an answer rather than as a breakage', async () => {
    renderSignedIn(<AppRoutes />, { at: '/somewhere-invented' });

    await screen.findByText(/not available/i);
    saysNothingBroke();
  });
});

describe('a person who belongs nowhere', () => {
  it('offers asking again, and asks again', async () => {
    standingOf([]);

    renderSignedIn(<AppRoutes />, { at: '/no-tenants' });

    await screen.findByText(/belong to no tenants/i);
    expect(countRequests('GET', '/api/me')).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /check again/i }));

    // The only affordance the product can honestly offer here. There is no
    // "create a tenant" because the product does not do that, and a button
    // that re-reads the standing is the one thing that can change this screen
    // — somebody has been added while they were looking at it.
    await waitFor(() => {
      expect(countRequests('GET', '/api/me')).toBe(2);
    });
  });

  it('says so plainly and offers signing out', async () => {
    standingOf([]);

    renderSignedIn(<AppRoutes />, { at: '/no-tenants' });

    expect(
      await screen.findByText(/belong to no tenants/i),
    ).toBeInTheDocument();
    // 4.3: the one thing left to do. Without it this address is a room with no
    // door — the switcher is absent, and there is nothing else to reach.
    // Awaited, not read: the frame arrives with the standing, and asserting
    // the button's presence before then would pass on a page that never grows
    // one.
    expect(
      await screen.findByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it('reads as an answer rather than as a breakage', async () => {
    standingOf([]);

    renderSignedIn(<AppRoutes />, { at: '/no-tenants' });

    await screen.findByText(/belong to no tenants/i);
    saysNothingBroke();
  });
});
