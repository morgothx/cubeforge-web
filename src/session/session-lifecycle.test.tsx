import { StrictMode } from 'react';
import { backend, refusals } from '../../test/handlers';
import { renderAt, screen, waitFor } from '../../test/render';
import { countRequests, server } from '../../test/server';
import { createQueryClient } from '../queries/client';
import { REFRESH_STORAGE_KEY, session } from '../api/session';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

/**
 * The session as the application sees it, which is three states and two verbs.
 *
 * Restoring is a state of its own for one reason: a person who is about to be
 * signed in must not watch a sign-in form appear and vanish (2.2). That is a
 * claim about a moment rather than about an outcome, so most of these tests
 * record every state the subject passed through and assert the *sequence*. An
 * implementation that flashed the form would end in exactly the same place.
 */

/** Records each state the provider reported, ignoring repeats. */
function Subject({ seen }: { seen: string[] }) {
  const { status, signIn, signOut } = useSession();

  if (seen[seen.length - 1] !== status.state) {
    seen.push(status.state);
  }

  return (
    <div>
      <p>{status.state}</p>
      {status.state === 'signed-out' && (
        <button
          onClick={() => {
            void signIn({ email: 'caller@example.com', password: 'secret' });
          }}
        >
          sign in
        </button>
      )}
      {status.state === 'signed-in' && (
        <button
          onClick={() => {
            void signOut();
          }}
        >
          sign out
        </button>
      )}
    </div>
  );
}

function mount(seen: string[] = [], client = createQueryClient()) {
  renderAt(
    <StrictMode>
      <SessionProvider>
        <Subject seen={seen} />
      </SessionProvider>
    </StrictMode>,
    { client },
  );
  return { seen, client };
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('a session that outlives the page', () => {
  it('shows the form at once when nothing was stored, without restoring first', async () => {
    const { seen } = mount();

    await screen.findByRole('button', { name: 'sign in' });
    // Not `['restoring', 'signed-out']`: there is nothing to restore, and a
    // restoring state here would delay the form for no reason.
    expect(seen).toEqual(['signed-out']);
  });

  it('restores a stored session without the form ever entering the document', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');

    const { seen } = mount();

    await screen.findByRole('button', { name: 'sign out' });
    expect(seen).toEqual(['restoring', 'signed-in']);
    expect(screen.queryByRole('button', { name: 'sign in' })).toBeNull();
  });

  it('exchanges the stored credential once, not once per effect', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');

    mount();

    await screen.findByRole('button', { name: 'sign out' });
    // The backend rotates refresh tokens and invalidates the whole family when
    // a used one is presented, so a second exchange would end the session the
    // first one restored. StrictMode is mounted here because React runs every
    // effect twice under it, which is the shape of that hazard.
    //
    // Read what this does and does not prove. Removing *both* guards in the
    // provider fails it. Removing only the ref does not: in this environment
    // React's second invocation arrives after the exchange has resolved, so
    // the state check catches it on its own. A real browser interleaves them
    // the other way, and there the ref is the only thing standing in the way.
    // See the Implementation Notes — that guard is reasoned, not tested.
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
  });

  it('discards a stored credential the backend will not exchange', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-stale');
    server.use(refusals.wordless('post', '/api/auth/refresh'));

    const { seen } = mount();

    await screen.findByRole('button', { name: 'sign in' });
    expect(seen).toEqual(['restoring', 'signed-out']);
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull();
  });

  it('keeps a stored credential the backend never answered about', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');
    server.use(refusals.unreachable('post', '/api/auth/refresh'));

    mount();

    await screen.findByRole('button', { name: 'sign in' });
    // An unreachable backend has said nothing about this credential. Throwing
    // it away would cost a password for a dropped connection; keeping it means
    // the next reload restores.
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBe('refresh-1');
  });
});

describe('signing in and out', () => {
  it('establishes a session and shows the application', async () => {
    const { seen } = mount();

    (await screen.findByRole('button', { name: 'sign in' })).click();

    await screen.findByRole('button', { name: 'sign out' });
    expect(seen).toEqual(['signed-out', 'signed-in']);
    expect(session.accessToken()).toBe('access-1');
  });

  it('stays signed out when the credentials are refused', async () => {
    server.use(refusals.wordless('post', '/api/auth/sign-in'));
    const { seen } = mount();

    (await screen.findByRole('button', { name: 'sign in' })).click();

    await waitFor(() => {
      expect(countRequests('POST', '/api/auth/sign-in')).toBe(1);
    });
    expect(seen).toEqual(['signed-out']);
    expect(session.accessToken()).toBeNull();
  });

  it('ends the session with the backend and discards what it kept', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');
    mount();

    (await screen.findByRole('button', { name: 'sign out' })).click();

    await screen.findByRole('button', { name: 'sign in' });
    expect(countRequests('POST', '/api/auth/sign-out')).toBe(1);
    expect(session.accessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull();
  });

  it("leaves the next person none of the previous one's answers", async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');
    const { client } = mount();
    await screen.findByRole('button', { name: 'sign out' });
    client.setQueryData(['standing'], backend.caller);

    screen.getByRole('button', { name: 'sign out' }).click();

    await screen.findByRole('button', { name: 'sign in' });
    // 4.4: the next person's standing is read afresh. A cache surviving a
    // sign-out would show them the previous person's tenants and role.
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('discards everything even when the backend cannot be told', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');
    server.use(refusals.unreachable('post', '/api/auth/sign-out'));
    const { client } = mount();
    await screen.findByRole('button', { name: 'sign out' });
    client.setQueryData(['standing'], backend.caller);

    screen.getByRole('button', { name: 'sign out' }).click();

    // Signing out is not allowed to fail. Leaving somebody signed in because
    // the network dropped is the one outcome this must never produce.
    await screen.findByRole('button', { name: 'sign in' });
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('clears the cache on the way in as well as on the way out', async () => {
    const { client } = mount();
    client.setQueryData(['standing'], backend.caller);

    (await screen.findByRole('button', { name: 'sign in' })).click();

    await screen.findByRole('button', { name: 'sign out' });
    // A session can end without anyone signing out — an expired credential
    // that could not be renewed ends it too, and leaves the cache behind.
    // Clearing on the way in is what makes 4.4 hold however the last one ended.
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('the hook', () => {
  it('refuses to answer outside a provider', () => {
    function Orphan() {
      useSession();
      return null;
    }

    expect(() => renderAt(<Orphan />)).toThrow(/SessionProvider/);
  });
});
