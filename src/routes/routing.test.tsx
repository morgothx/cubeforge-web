import { Route, Routes, useLocation } from 'react-router';
import { AppRoutes } from './AppRoutes';
import { ReturnAfterSignIn, RequireSession } from './RequireSession';
import { backend } from '../../test/handlers';
import { renderAt, renderSignedIn, screen } from '../../test/render';
import { session } from '../api/session';
import { useSession } from '../session/useSession';
import { SessionProvider } from '../session/SessionProvider';
import { StrictMode } from 'react';

/**
 * The gate in front of every address, and the two moments it exists for.
 *
 * Requirement 2.2 is about a moment rather than an outcome: while a session is
 * being restored the person must see neither the form nor the application, so
 * the assertion has to be made *before* the restore resolves. Requirements 2.5
 * and 2.6 are one property split in two — the address someone was trying to
 * reach is the address they arrive at, and the only way to see it is to send
 * them somewhere else in between.
 */

/** Stands in for the form, which task 6.1 builds. */
function SignInStandIn() {
  const { signIn } = useSession();
  const state: unknown = useLocation().state;

  return (
    <div>
      <p>the form</p>
      <p>
        remembered:{' '}
        {typeof state === 'object' && state !== null && 'from' in state
          ? String(state.from)
          : 'nothing'}
      </p>
      <button
        onClick={() => {
          void signIn({ email: 'caller@example.com', password: 'secret' });
        }}
      >
        sign in
      </button>
    </div>
  );
}

function Where() {
  return <p>at {useLocation().pathname}</p>;
}

/** What a protected address renders once somebody is allowed through. */
function Protected() {
  return <p>the members</p>;
}

/** The gate over a tiny table, so the subject is the gate and not the screens. */
function gated() {
  return (
    <>
      {/* Outside the table: where somebody is, even when nothing renders. */}
      <Where />
      <Routes>
        <Route
          path="/sign-in"
          element={
            <ReturnAfterSignIn>
              <SignInStandIn />
            </ReturnAfterSignIn>
          }
        />
        <Route
          path="/t/:tenantId/members"
          element={
            <RequireSession>
              <Protected />
            </RequireSession>
          }
        />
        <Route
          path="/"
          element={
            <RequireSession>
              <p>the application</p>
            </RequireSession>
          }
        />
      </Routes>
    </>
  );
}

function renderSignedOut(subject: React.ReactElement, at: string) {
  return renderAt(
    <StrictMode>
      <SessionProvider>{subject}</SessionProvider>
    </StrictMode>,
    { at },
  );
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('the gate in front of the application', () => {
  it('shows neither the form nor the application while restoring', () => {
    renderSignedIn(gated(), { at: '/t/t-acme/members' });

    // Asserted before the exchange resolves, which is the only moment the claim
    // is about — a restored session that flashed the form ends up in exactly
    // the same place a second later.
    expect(screen.queryByText('the form')).toBeNull();
    expect(screen.queryByText('the members')).toBeNull();
    // And nobody has been sent anywhere. Redirecting to the form and rendering
    // nothing there looks identical on screen while the address flaps, and it
    // is the mirror, not the gate, that would be holding the line.
    expect(screen.getByText('at /t/t-acme/members')).toBeInTheDocument();
  });

  it('sends somebody signed out to the form', async () => {
    renderSignedOut(gated(), '/t/t-acme/members');

    expect(await screen.findByText('the form')).toBeInTheDocument();
  });

  it('remembers the address they were trying to reach', async () => {
    renderSignedOut(gated(), '/t/t-acme/members');

    expect(
      await screen.findByText('remembered: /t/t-acme/members'),
    ).toBeInTheDocument();
  });

  it('takes them there once they sign in, not to a default', async () => {
    renderSignedOut(gated(), '/t/t-acme/members');
    (await screen.findByRole('button', { name: 'sign in' })).click();

    // 2.5 and 2.6 are one property: the address reached while signed out is the
    // address reached after signing in. Split across two mechanisms it becomes
    // two chances to lose it.
    expect(await screen.findByText('the members')).toBeInTheDocument();
  });

  it('takes somebody who arrived at the form directly to the root', async () => {
    renderSignedOut(gated(), '/sign-in');
    await screen.findByText('remembered: nothing');

    (await screen.findByRole('button', { name: 'sign in' })).click();

    // Nothing was interrupted, so there is nothing to return to.
    expect(await screen.findByText('the application')).toBeInTheDocument();
  });

  it('lets somebody already signed in past the form', async () => {
    renderSignedIn(gated(), { at: '/sign-in' });

    // A signed-in person on the sign-in address has usually pressed Back. The
    // form would invite them to replace a session they already have.
    await screen.findByText('the application');
  });

  it('ignores a remembered address that is not one of ours', async () => {
    renderSignedIn(gated(), {
      at: '/sign-in',
      state: { from: '//example.com' },
    });

    // Router state is set by this module and by nothing else, so this cannot
    // happen today. It is guarded because "go wherever this string says" is a
    // sentence worth never writing, and `//host` is a different origin.
    expect(await screen.findByText('the application')).toBeInTheDocument();
  });
});

describe('the route table', () => {
  it('serves the two addresses that need no session', async () => {
    for (const [address, expected] of [
      ['/sign-in', /sign in/i],
      ['/nowhere-at-all', /not available/i],
    ] as const) {
      const view = renderSignedOut(<AppRoutes />, address);
      expect(await screen.findByText(expected)).toBeInTheDocument();
      view.unmount();
    }
  });

  it('serves the addresses that need one, behind the gate', async () => {
    for (const [address, expected] of [
      ['/', /choosing a tenant/i],
      ['/t/t-acme/members', /members/i],
      ['/no-tenants', /belong to no tenants/i],
    ] as const) {
      const view = renderSignedIn(<AppRoutes />, { at: address });
      expect(await screen.findByText(expected)).toBeInTheDocument();
      view.unmount();
      localStorage.clear();
      session.end();
    }
  });

  it('asks for a password before any of them', async () => {
    for (const address of ['/', '/t/t-acme/members', '/no-tenants']) {
      const view = renderSignedOut(<AppRoutes />, address);
      expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
      view.unmount();
    }
  });

  it('frames every gated address with the application layout', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    // The screens themselves arrive in 5.2, 5.3 and 6.2. What 5.1 owns is that
    // the frame is applied once, around the table, rather than remembered by
    // each screen in turn.
    expect(await screen.findByText(backend.caller.email)).toBeInTheDocument();
  });
});
