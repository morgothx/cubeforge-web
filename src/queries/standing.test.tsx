import { HttpResponse, http } from 'msw';
import { StrictMode } from 'react';
import { backend, refusals } from '../../test/handlers';
import { renderAt, screen, waitFor } from '../../test/render';
import { countRequests, server } from '../../test/server';
import { REFRESH_STORAGE_KEY, session } from '../api/session';
import { SessionProvider } from '../session/SessionProvider';
import { createQueryClient } from './client';
import { keys } from './keys';
import { useStanding } from './standing';

/**
 * Who the caller is, read once and read from the backend.
 *
 * Two of this task's three claims are invisible in what the hook returns. "Once
 * per session" and "never from storage" are properties of *how many* requests
 * happen and of *what is written down*, and an implementation that asked four
 * times, or that cached the answer in `localStorage`, would render exactly the
 * same screen.
 */

function Standing({ label = 'standing' }: { label?: string }) {
  const { data, error, isPending, fetchStatus } = useStanding();

  // A query that is switched off is `pending` and `idle` at once — v5's way of
  // saying "nobody asked". A screen that read `isPending` alone would show a
  // spinner to a person who is not signed in.
  if (isPending && fetchStatus === 'idle') return <p>{label}: not asked</p>;
  if (isPending) return <p>{label}: reading</p>;
  if (error)
    return (
      <p>
        {label}: refused as {error.refusal.kind}
      </p>
    );

  return (
    <div>
      <p>
        {label}: {data.email}
      </p>
      <ul>
        {data.memberships.map((membership) => (
          <li key={membership.tenantId}>
            {membership.tenantName} as {membership.role}
          </li>
        ))}
      </ul>
    </div>
  );
}

function mount(subject = <Standing />, client = createQueryClient()) {
  const result = renderAt(
    <StrictMode>
      <SessionProvider>{subject}</SessionProvider>
    </StrictMode>,
    { client },
  );
  return { client, ...result };
}

/** Signed in before the first render, the way a restored page arrives. */
function withStoredSession() {
  localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe("the caller's standing", () => {
  it('reports the answer the backend gave, tenant for tenant', async () => {
    withStoredSession();

    mount();

    await screen.findByText('standing: caller@example.com');
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['Acme as admin', 'Globex as viewer']);
  });

  it('reports no tenants when the backend named none', async () => {
    withStoredSession();
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          ...backend.caller,
          isOperator: true,
          memberships: [],
        }),
      ),
    );

    mount();

    await screen.findByText('standing: caller@example.com');
    // An operator with no membership reaches no tenant, and the backend has
    // already excluded everything that no longer grants access (9.3). A client
    // that invented a destination here — or filtered one away — would be
    // answering a question the backend already answered.
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('asks once however many parts of the screen want it', async () => {
    withStoredSession();

    mount(
      <>
        <Standing label="header" />
        <Standing label="navigation" />
      </>,
    );

    await screen.findByText('header: caller@example.com');
    await screen.findByText('navigation: caller@example.com');
    expect(countRequests('GET', '/api/me')).toBe(1);
  });

  it('asks once per session, not once per mount', async () => {
    withStoredSession();
    const client = createQueryClient();

    const first = mount(<Standing />, client);
    await screen.findByText('standing: caller@example.com');
    first.unmount();
    mount(<Standing />, client);

    await screen.findByText('standing: caller@example.com');
    // Asserted as "nothing is in flight" rather than "the count is still one".
    // A stale answer is re-read in the background, so the second request would
    // be started but not finished by the time the cached answer has rendered —
    // and a count taken then would read `1` whether or not it was on its way.
    expect(client.isFetching()).toBe(0);
    expect(countRequests('GET', '/api/me')).toBe(1);
  });

  it('holds the answer as current until something says otherwise', async () => {
    withStoredSession();
    const { client } = mount();
    await screen.findByText('standing: caller@example.com');

    const cached = client.getQueryCache().find({ queryKey: keys.standing });

    // Every automatic re-read — on a remount, on the tab regaining focus, on a
    // reconnect — consults exactly this. Asserted here rather than by
    // triggering one, because **jsdom produces none of them**: a remount and a
    // dispatched focus event both leave the count at one whatever the staleness
    // rule is, so a test written that way would pass with the rule removed.
    // What it protects is the person's own role: refetching on focus is right
    // for data that moves, and who the caller is changes only when somebody
    // changes it — which invalidates this key explicitly (4.5).
    expect(cached?.isStale()).toBe(false);
  });

  it('asks again when something says the answer is stale', async () => {
    withStoredSession();
    const { client } = mount();
    await screen.findByText('standing: caller@example.com');

    await client.invalidateQueries({ queryKey: keys.standing });

    // 4.5 needs this: changing your own role has to be able to make the
    // Dashboard ask again. A cache that could never be told would freeze the
    // role the person held when they arrived.
    await waitFor(() => {
      expect(countRequests('GET', '/api/me')).toBe(2);
    });
  });

  it('waits for the restore rather than racing it', async () => {
    withStoredSession();

    mount();

    await screen.findByText('standing: caller@example.com');
    // Asking during the restore would go out with no access token at all, be
    // answered with the same wordless 404 as a refusal, and send the request
    // layer off to renew a credential the provider is already exchanging. Two
    // exchanges of one rotating refresh token invalidate the whole family —
    // the read would end the session it was reading for.
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
    expect(countRequests('GET', '/api/me')).toBe(1);
  });

  it('does not ask while nobody is signed in', async () => {
    mount();

    await screen.findByText('standing: not asked');
    // Asking without a credential produces the same wordless 404 as a refusal,
    // and the sign-in screen would be rendering an error about nothing.
    expect(countRequests('GET', '/api/me')).toBe(0);
  });

  it('keeps nothing about the caller where a script can read it', async () => {
    withStoredSession();

    mount();

    await screen.findByText('standing: caller@example.com');
    // The whole of storage, not just the keys this feature knows about: the
    // property worth having is that the caller's identity is nowhere on disk,
    // not that it is absent from one key.
    const stored = JSON.stringify({ ...localStorage });
    expect(stored).not.toContain(backend.caller.email);
    expect(stored).not.toContain(backend.caller.personId);
    expect(stored).not.toContain('Acme');
  });

  it('reports a refusal in the vocabulary, never a status', async () => {
    withStoredSession();
    server.use(refusals.wordless('get', '/api/me'));

    mount();

    // The renewal succeeds and the second ask is refused the same way, so what
    // reaches the screen is the wordless refusal — not a status, and not the
    // sentence the backend attached to it.
    await screen.findByText('standing: refused as unavailable');
  });
});
