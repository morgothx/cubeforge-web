import { http, HttpResponse } from 'msw';
import { backend, refusals, withoutAddresses } from '../../test/handlers';
import { countRequests, server } from '../../test/server';
import * as endpoints from './endpoints';
import { session } from './session';

/**
 * One function per route, and the three that carry no credential.
 *
 * Most of this is transcription, and transcription is exactly where a wrong
 * verb or a wrong path survives every type-check. What is not transcription is
 * the boundary: signing in, renewing and signing out must not travel the
 * authorized path, because a renewal that could be renewed is an unbounded
 * recursion and a sign-in that renewed would try to rescue a session nobody
 * has yet.
 */

interface Seen {
  readonly authorization: string | null;
  readonly body: unknown;
}

/**
 * Overrides one route and hands back what it was actually sent.
 *
 * The credential and the body are read off the request itself rather than off
 * the harness's counter, because the two properties that matter here — that a
 * route carries the caller, and that it carries none — are invisible in a
 * response.
 */
function watch(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  answer: () => Response,
): () => Seen {
  let seen: Seen = { authorization: null, body: null };
  server.use(
    http[method](path, async ({ request }) => {
      seen = {
        authorization: request.headers.get('Authorization'),
        body:
          request.method === 'GET' || request.method === 'DELETE'
            ? null
            : ((await request.json()) as unknown),
      };
      return answer();
    }),
  );
  return () => seen;
}

const nothing = () => new HttpResponse(null, { status: 204 });

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('the routes that carry no credential', () => {
  it('signs in and answers the session the backend issued', async () => {
    await expect(
      endpoints.signIn({ email: 'caller@example.com', password: 'secret' }),
    ).resolves.toEqual(backend.session);
  });

  it('presents no credential when signing in, even holding one', async () => {
    session.adopt(backend.session);
    const seen = watch('post', '/api/auth/sign-in', () =>
      HttpResponse.json(backend.session),
    );

    await endpoints.signIn({ email: 'caller@example.com', password: 'pw' });

    expect(seen().authorization).toBeNull();
    expect(seen().body).toEqual({
      email: 'caller@example.com',
      password: 'pw',
    });
  });

  it('never renews the renewal, however it fails', async () => {
    session.adopt(backend.session);
    server.use(refusals.wordless('post', '/api/auth/refresh'));

    await expect(endpoints.refresh('refresh-1')).rejects.toMatchObject({
      refusal: { kind: 'unavailable' },
    });

    // The whole reason this route bypasses the authorized path: a renewal that
    // could be renewed would ask again, and again.
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
  });

  it('never renews a refused sign-in either', async () => {
    session.adopt(backend.session);
    server.use(refusals.throttled('post', '/api/auth/sign-in'));

    await expect(
      endpoints.signIn({ email: 'caller@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ refusal: { kind: 'throttled' } });

    expect(countRequests('POST', '/api/auth/sign-in')).toBe(1);
    expect(countRequests('POST', '/api/auth/refresh')).toBe(0);
  });

  it('signs out with the token it was given, and answers nothing', async () => {
    session.adopt(backend.session);
    const seen = watch('post', '/api/auth/sign-out', nothing);

    await expect(endpoints.signOut('refresh-1')).resolves.toBeUndefined();

    expect(seen().body).toEqual({ refreshToken: 'refresh-1' });
    expect(seen().authorization).toBeNull();
  });
});

describe('the routes that carry the caller', () => {
  beforeEach(() => {
    session.adopt(backend.session);
  });

  it('asks for the standing with the access token attached', async () => {
    const seen = watch('get', '/api/me', () =>
      HttpResponse.json(backend.caller),
    );

    await expect(endpoints.fetchStanding()).resolves.toEqual(backend.caller);

    expect(seen().authorization).toBe('Bearer access-1');
  });

  it("lists a tenant's revoked members too, so the flag means something", async () => {
    // 7.1 asks the screen to show whether a membership is currently active, and
    // the backend leaves revoked ones out unless asked. Without the query the
    // column would be `true` for every row it ever rendered.
    await expect(endpoints.listMembers('t-acme')).resolves.toEqual(
      backend.members,
    );
  });

  it('lists the members of one tenant, addresses omitted as they arrive', async () => {
    const withheld = withoutAddresses(backend.members);
    server.use(
      http.get('/api/tenants/t-acme/members', () =>
        HttpResponse.json(withheld),
      ),
    );

    await expect(endpoints.listMembers('t-acme')).resolves.toEqual(withheld);
  });

  it('invites by address and role', async () => {
    const seen = watch('post', '/api/tenants/t-acme/members', nothing);

    await expect(
      endpoints.inviteMember('t-acme', {
        email: 'new@example.com',
        role: 'editor',
      }),
    ).resolves.toBeUndefined();

    expect(seen().body).toEqual({ email: 'new@example.com', role: 'editor' });
  });

  it('changes a role with the verb the backend answers to', async () => {
    const seen = watch('patch', '/api/tenants/t-acme/members/m-2', nothing);

    await expect(
      endpoints.changeMemberRole('t-acme', 'm-2', 'viewer'),
    ).resolves.toBeUndefined();

    expect(seen().body).toEqual({ role: 'viewer' });
    expect(countRequests('PATCH', '/api/tenants/t-acme/members/m-2')).toBe(1);
  });

  it('revokes a membership', async () => {
    await expect(
      endpoints.revokeMembership('t-acme', 'm-3'),
    ).resolves.toBeUndefined();

    expect(countRequests('DELETE', '/api/tenants/t-acme/members/m-3')).toBe(1);
  });

  it('renews and retries, because it travels the authorized path', async () => {
    let renewed = false;
    server.use(
      http.post('/api/auth/refresh', () => {
        renewed = true;
        return HttpResponse.json(backend.session);
      }),
      http.get('/api/me', () =>
        renewed
          ? HttpResponse.json(backend.caller)
          : HttpResponse.json(
              {
                statusCode: 404,
                message: 'the requested record does not exist',
              },
              { status: 404 },
            ),
      ),
    );

    await expect(endpoints.fetchStanding()).resolves.toEqual(backend.caller);
    expect(countRequests('POST', '/api/auth/refresh')).toBe(1);
  });

  it('reports the refusal vocabulary rather than a status', async () => {
    server.use(refusals.wordless('get', '/api/tenants/t-acme/members'));

    await expect(endpoints.listMembers('t-acme')).rejects.toMatchObject({
      refusal: { kind: 'unavailable' },
    });
  });
});

describe('a URL is written down once', () => {
  /**
   * The point of this module is that no other file names a route, and no test
   * of behaviour can see that: a component with its own `fetch('/api/me')`
   * would answer exactly the same. So this reads the source.
   *
   * `http.ts` is the one documented exception — it names the renewal, because
   * the dependency direction runs `http → endpoints` and it cannot import the
   * function that would otherwise own that path.
   */
  const sources = import.meta.glob('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('is named in this module alone, and in the renewal', () => {
    const naming = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => /['"`]\/(api\/)?(auth|me|tenants)\b/.test(source))
      .map(([path]) => path)
      .sort();

    expect(naming).toEqual(['./endpoints.ts', './http.ts']);
  });

  it('has one function for every route the backend offers', () => {
    expect(Object.keys(endpoints).sort()).toEqual([
      'changeMemberRole',
      'fetchStanding',
      'inviteMember',
      'listMembers',
      'refresh',
      'revokeMembership',
      'signIn',
      'signOut',
    ]);
  });
});
