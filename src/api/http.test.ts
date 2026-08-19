import { http, HttpResponse } from 'msw';
import { backend, refusals } from '../../test/handlers';
import { countRequests, server } from '../../test/server';
import type { ApiError } from './refusal';
import type { CallerStanding, Session } from './types';

/**
 * The one request function, and the four requirements that are really one
 * capability: attach access, renew it when it expires, hold everyone else while
 * that happens, and retry nothing else.
 *
 * Two of the properties here cannot be seen in a response body. An
 * implementation that renewed three times answers exactly the same as one that
 * renewed once — so those are asserted by counting requests, which is what the
 * harness's counter was built for.
 */

const RENEWED: Session = {
  accessToken: 'access-2',
  refreshToken: 'refresh-2',
  sessionExpiresAt: '2026-08-19T00:30:00.000Z',
};

const REFUSED = {
  statusCode: 404,
  message: 'the requested record does not exist',
};

/**
 * A fresh module graph per test.
 *
 * The request layer holds two pieces of module state — the renewal in flight,
 * and when access was last renewed — and both are the subject of tests here. A
 * reset function exported only for tests would be a seam in production code;
 * discarding the modules is the same thing without the seam.
 */
async function freshRequestLayer() {
  vi.resetModules();
  const { session } = await import('./session');
  const { request } = await import('./http');
  return { session, request };
}

/** Answers `404` until told otherwise, then answers the standing. */
function expiredUntilRenewed(path: string) {
  let renewed = false;
  server.use(
    http.post('/api/auth/refresh', () => {
      renewed = true;
      return HttpResponse.json(RENEWED);
    }),
    http.get(path, () =>
      renewed
        ? HttpResponse.json(backend.caller)
        : HttpResponse.json(REFUSED, { status: 404 }),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('an authorized request', () => {
  it('presents the access token it holds', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    let presented: string | null = null;
    server.use(
      http.get('/api/me', ({ request: sent }) => {
        presented = sent.headers.get('authorization');
        return HttpResponse.json(backend.caller);
      }),
    );

    await request<CallerStanding>('/me');

    expect(presented).toBe(`Bearer ${backend.session.accessToken}`);
  });

  it('answers with the parsed body', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);

    const standing = await request<CallerStanding>('/me');

    expect(standing.email).toBe(backend.caller.email);
  });

  it('answers nothing for a route that returns nothing', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);

    await expect(
      request<void>('/tenants/t-acme/members/m-2', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('reports a service it could not reach, and does not retry it', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(refusals.unreachable('get', '/api/me'));

    await expect(request('/me')).rejects.toMatchObject({
      refusal: { kind: 'unreachable' },
    });
    expect(countRequests('POST', '/api/auth/refresh')).toBe(0);
  });

  it('never retries a rejection, and keeps its cause', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(
      refusals.conflict(
        'post',
        '/api/tenants/:tenantId/members',
        'this person is already a member of this tenant',
        'email',
      ),
    );

    await expect(
      request('/tenants/t-acme/members', {
        method: 'POST',
        body: { email: 'a@example.com', role: 'viewer' },
      }),
    ).rejects.toMatchObject({
      refusal: { kind: 'rejected', field: 'email' },
    });
    expect(countRequests('POST', '/api/tenants/t-acme/members')).toBe(1);
    expect(countRequests('POST', '/api/auth/refresh')).toBe(0);
  });
});

describe('access that expires mid-session', () => {
  it('renews and retries, and the caller sees only the result', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    expiredUntilRenewed('/api/me');

    const standing = await request<CallerStanding>('/me');

    // Requirement 3.1. No refusal reached the caller at all.
    expect(standing.email).toBe(backend.caller.email);
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
    expect(countRequests('GET', '/api/me')).toBe(2);
  });

  it('adopts the renewed credential rather than reusing the old one', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    expiredUntilRenewed('/api/me');

    await request<CallerStanding>('/me');

    expect(session.accessToken()).toBe(RENEWED.accessToken);
  });

  it('renews once for several requests that expire together', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    expiredUntilRenewed('/api/me');

    await Promise.all([
      request<CallerStanding>('/me'),
      request<CallerStanding>('/me'),
      request<CallerStanding>('/me'),
    ]);

    // Requirement 3.3, and the only way it is observable: three renewals answer
    // exactly the same as one. Without serialization each of the three would
    // rotate the refresh token, and the backend invalidates a family when a
    // used token is presented — so the second renewal would end the session
    // this one is trying to keep.
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
  });

  it('ends the session when the credential cannot be renewed', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(
      refusals.wordless('get', '/api/me'),
      refusals.wordless('post', '/api/auth/refresh'),
    );

    await expect(request('/me')).rejects.toMatchObject({
      refusal: { kind: 'session-ended' },
    });
    expect(session.refreshToken()).toBeNull();
  });

  it('keeps the session when the renewal could not be reached', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(
      refusals.wordless('get', '/api/me'),
      refusals.unreachable('post', '/api/auth/refresh'),
    );

    await expect(request('/me')).rejects.toMatchObject({
      refusal: { kind: 'unreachable' },
    });
    // A backend that could not be reached says nothing about the credential.
    // Signing somebody out because their train entered a tunnel would be the
    // wrong reading, and they would have to type a password to undo it.
    expect(session.refreshToken()).toBe('refresh-1');
  });

  it('never renews the renewal, however it fails', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(
      refusals.wordless('get', '/api/me'),
      refusals.wordless('post', '/api/auth/refresh'),
    );

    await expect(request('/me')).rejects.toThrow();

    // The renewal is issued outside the authorized path, so a refused renewal
    // cannot look like expiry to itself. One call, not a recursion.
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
  });

  it('just retries when somebody else renewed while it was in flight', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    let asked = 0;
    server.use(
      http.get('/api/me', () => {
        asked += 1;
        if (asked === 1) {
          // While this request was travelling, another one discovered the
          // expiry and renewed. By the time the refusal arrives, the credential
          // in hand is already newer than the one that was sent.
          session.adopt(RENEWED);
          return HttpResponse.json(REFUSED, { status: 404 });
        }
        return HttpResponse.json(backend.caller);
      }),
    );

    const standing = await request<CallerStanding>('/me');

    // Retried with the credential that arrived meanwhile, and renewed nothing.
    // Without this the request would be told the thing is unavailable — refused
    // for no reason at all, because a renewal it did not need had just happened.
    expect(standing.email).toBe(backend.caller.email);
    expect(countRequests('POST', '/api/auth/refresh')).toBe(0);
  });

  it('reports unavailability without renewing when no session is held', async () => {
    const { request } = await freshRequestLayer();
    server.use(refusals.wordless('get', '/api/me'));

    await expect(request('/me')).rejects.toMatchObject({
      refusal: { kind: 'unavailable' },
    });
    expect(countRequests('POST', '/api/auth/refresh')).toBe(0);
  });
});

describe('a refusal that is not expiry', () => {
  it('is reported as unavailable once the renewal proves it was not expiry', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(refusals.wordless('get', '/api/me'));

    await expect(request('/me')).rejects.toMatchObject({
      refusal: { kind: 'unavailable' },
    });
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
    expect(countRequests('GET', '/api/me')).toBe(2);
  });

  it('renews once between several such refusals, not once for each', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(refusals.wordless('get', '/api/me'));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(request('/me')).rejects.toThrow();
    }

    // A screen holding several genuinely refused resources would otherwise
    // rotate the credential once per resource — each refusal looking exactly
    // like expiry to a layer that cannot see the others.
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
  });

  it('renews again once the credential is no longer freshly renewed', async () => {
    const { session, request } = await freshRequestLayer();
    const { RENEWAL_COOLDOWN_MS } = await import('./http');
    session.adopt(backend.session);
    server.use(refusals.wordless('get', '/api/me'));

    await expect(request('/me')).rejects.toThrow();

    // The window is a cost control, not a correctness mechanism: once it has
    // passed, an expiry that really happened must still be recovered from.
    const later = Date.now() + RENEWAL_COOLDOWN_MS + 1;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    await expect(request('/me')).rejects.toThrow();

    expect(countRequests('POST', '/api/auth/refresh')).toBe(2);
  });
});

describe('what the caller is handed', () => {
  it('throws the vocabulary, never a status code', async () => {
    const { session, request } = await freshRequestLayer();
    session.adopt(backend.session);
    server.use(refusals.throttled('post', '/api/auth/sign-in'));

    const error: unknown = await request('/auth/sign-in', {
      method: 'POST',
      body: { email: 'a@example.com', password: 'x' },
    }).catch((thrown: unknown) => thrown);

    const refusal = (error as ApiError).refusal;
    expect(refusal).toEqual({ kind: 'throttled' });
    expect(JSON.stringify(refusal)).not.toContain('429');
  });
});
