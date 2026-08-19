import { useLocation } from 'react-router';
import { backend, refusals } from './handlers';
import { countRequests, server } from './server';
import { renderAt, screen } from './render';
import type { CallerStanding } from '../src/api/types';

/**
 * The harness testing itself, which is not ceremony.
 *
 * Every later test in this repository is evidence only if requests really are
 * intercepted. An interceptor that silently patched nothing would let a test
 * assert against a fixture it never received, or pass because a request quietly
 * failed and the assertion happened not to notice. So the first thing built is
 * the thing that proves the rest can be believed.
 */
describe('the request harness', () => {
  it('intercepts the request function this environment actually provides', async () => {
    const response = await fetch('/api/me');

    // Not "it did not throw" — the fixture came back, so the interception is
    // real and the body is the shape the backend answers with.
    expect(response.status).toBe(200);
    const standing = (await response.json()) as CallerStanding;
    expect(standing.email).toBe(backend.caller.email);
    expect(standing.memberships).toHaveLength(2);
  });

  it('counts how many times a route was asked', async () => {
    await fetch('/api/me');
    await fetch('/api/me');

    // Two of this feature's properties — one renewal for several expiring
    // requests, and not renewing what was just renewed — are only expressible
    // as a count. If this does not work, neither can be asserted.
    expect(countRequests('GET', '/api/me')).toBe(2);
  });

  it('answers the wordless refusal byte for byte as the backend does', async () => {
    server.use(refusals.wordless('get', '/api/me'));

    const response = await fetch('/api/me');

    // The exact body matters: the whole reason the client may not explain a
    // refusal is that authorization and absence are indistinguishable here, and
    // a handler that answered a friendlier 404 would quietly make them
    // distinguishable in tests only.
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      statusCode: 404,
      message: 'the requested record does not exist',
    });
  });

  it('answers a rejection with the cause and the field the backend names', async () => {
    server.use(
      refusals.conflict(
        'post',
        '/api/tenants/:tenantId/members',
        'this person is already a member of this tenant',
        'email',
      ),
    );

    const response = await fetch('/api/tenants/t-acme/members', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@example.com', role: 'viewer' }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ field: 'email' });
  });

  it('fails a request nobody wrote a handler for, rather than letting it out', async () => {
    // Asserting the *reason*, not merely that something went wrong. Nothing is
    // listening on this address in a test environment, so an unhandled request
    // fails whether or not the harness has a policy — a bare
    // `rejects.toThrow()` passed with the policy switched off, which a probe
    // caught. The policy surfaces as a distinctive answer instead.
    const response = await fetch('/api/nothing-here');

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).toContain(
      'no handler for GET /api/nothing-here',
    );
  });

  it('renders a subject inside the real providers at a given address', () => {
    function Probe() {
      return <p>at {useLocation().pathname}</p>;
    }

    renderAt(<Probe />, { at: '/t/acme/members' });

    expect(screen.getByText('at /t/acme/members')).toBeInTheDocument();
  });
});
