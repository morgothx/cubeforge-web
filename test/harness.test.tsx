import { useLocation } from 'react-router';
import { answers, backend, refusals } from './handlers';
import { countRequests, server } from './server';
import { renderAt, screen } from './render';
import type { CallerStanding, ModelledAnswer } from '../src/api/types';

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
    const response = await fetch('/api/me', {
      headers: { Authorization: 'Bearer access-1' },
    });

    // Not "it did not throw" — the fixture came back, so the interception is
    // real and the body is the shape the backend answers with.
    expect(response.status).toBe(200);
    const standing = (await response.json()) as CallerStanding;
    expect(standing.email).toBe(backend.caller.email);
    expect(standing.memberships).toHaveLength(2);
  });

  it('refuses a read that arrives without a credential', async () => {
    const response = await fetch('/api/me');

    // The guard answers a caller it does not recognise with the same wordless
    // 404 as one it will not admit. A harness that answered anyway would hide
    // every read fired before the session exists — they would look healthy
    // here and be refused in production.
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      statusCode: 404,
      message: 'the requested record does not exist',
    });
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

/**
 * The analytics routes, as the platform answers them.
 *
 * The forms below are the platform's, not a convenience: measures arrive as
 * decimal strings because the engine reports every column as text, days arrive
 * as the engine's timestamp for that day, and absence arrives as `null`. A
 * harness that answered numbers and plain dates would let a reader that
 * mishandles the real forms pass every test here and fail against the running
 * platform.
 */
describe('the analytics harness', () => {
  const asMember = { Authorization: 'Bearer access-1' };

  const ask = (body: Record<string, unknown>) =>
    fetch('/api/tenants/t-acme/analytics/questions', {
      method: 'POST',
      headers: asMember,
      body: JSON.stringify(body),
    });

  it('answers the vocabulary the platform publishes, field for field', async () => {
    const response = await fetch('/api/tenants/t-acme/analytics/vocabulary', {
      headers: asMember,
    });

    // Copied from `cubeforge-api`'s literal contract test for this body
    // (`published-vocabulary.spec.ts`). The two are the same contract written
    // down on both sides; a change on one side that is not made on the other
    // is exactly the drift this pair exists to show.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      measures: [
        { name: 'net_quantity', cumulative: false },
        { name: 'movement_count', cumulative: false },
        { name: 'on_hand_quantity', cumulative: true },
      ],
      groupings: [
        { name: 'recorded_day', shape: 'day', column: 'recorded_day' },
        { name: 'occurred_day', shape: 'day', column: 'occurred_day' },
        { name: 'kind', shape: 'category', column: 'kind' },
        {
          name: 'product',
          shape: 'labelled',
          codeColumn: 'product_code',
          nameColumn: 'product_name',
        },
        {
          name: 'location',
          shape: 'labelled',
          codeColumn: 'location_code',
          nameColumn: 'location_name',
        },
      ],
      readBy: ['recorded', 'occurred'],
      longestPeriodDays: 366,
      calendar: 'UTC',
    });
  });

  it('refuses both analytics routes to a caller with no credential, wordlessly', async () => {
    const vocabulary = await fetch('/api/tenants/t-acme/analytics/vocabulary');
    const question = await fetch('/api/tenants/t-acme/analytics/questions', {
      method: 'POST',
      body: JSON.stringify({ measures: ['net_quantity'] }),
    });

    expect(vocabulary.status).toBe(404);
    expect(question.status).toBe(404);
  });

  it('answers a question in the forms the platform sends', async () => {
    const response = await ask({
      measures: ['net_quantity', 'movement_count'],
      groupings: ['recorded_day', 'kind'],
      from: '2026-08-12',
      to: '2026-09-10',
      by: 'recorded',
    });
    const answer = (await response.json()) as ModelledAnswer;

    expect(response.status).toBe(200);
    if (answer.state !== 'answered') throw new Error('expected an answer');
    expect(answer.completeThrough).toBe(backend.analytics.completeThrough);
    expect(answer.rows.length).toBeGreaterThan(0);
    for (const row of answer.rows) {
      expect(Object.keys(row).sort()).toEqual(
        ['kind', 'movement_count', 'net_quantity', 'recorded_day'].sort(),
      );
      expect(row.recorded_day).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000$/);
      expect(typeof row.net_quantity).toBe('string');
    }
  });

  it('labels a product by code and name, and spells an absent figure as null', async () => {
    // What the platform does when a cumulative measure is asked beside one the
    // period bounds: a product that moved only before the period still has an
    // on-hand, and no net quantity at all.
    const response = await ask({
      measures: ['net_quantity', 'on_hand_quantity'],
      groupings: ['product'],
      from: '2026-08-12',
      to: '2026-09-10',
    });
    const answer = (await response.json()) as ModelledAnswer;

    if (answer.state !== 'answered') throw new Error('expected an answer');
    expect(Object.keys(answer.rows[0] ?? {}).sort()).toEqual(
      [
        'net_quantity',
        'on_hand_quantity',
        'product_code',
        'product_name',
      ].sort(),
    );
    expect(answer.rows.some((row) => row.net_quantity === null)).toBe(true);
  });

  it('refuses a name nobody offers exactly as the platform does', async () => {
    const response = await ask({
      measures: ['revenue'],
      from: '2026-08-12',
      to: '2026-09-10',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      statusCode: 400,
      message:
        'measures does not offer "revenue"; measures are net_quantity, ' +
        'movement_count, on_hand_quantity and groupings are recorded_day, ' +
        'occurred_day, kind, product, location',
      field: 'measures',
    });
  });

  it('counts the analytics requests, route by route', async () => {
    const answered = [
      await fetch('/api/tenants/t-acme/analytics/vocabulary', {
        headers: asMember,
      }),
      await ask({
        measures: ['net_quantity'],
        from: '2026-08-12',
        to: '2026-09-10',
      }),
      await ask({
        measures: ['net_quantity'],
        from: '2026-08-12',
        to: '2026-09-10',
      }),
    ].map((response) => response.status);

    // Answered, not merely seen: the counter records a request whether or not
    // a handler took it, so without this the count would pass against routes
    // that do not exist — which it did, before they did.
    expect(answered).toEqual([200, 200, 200]);

    expect(
      countRequests('GET', '/api/tenants/t-acme/analytics/vocabulary'),
    ).toBe(1);
    expect(
      countRequests('POST', '/api/tenants/t-acme/analytics/questions'),
    ).toBe(2);
  });

  it('can answer that a tenant was never exported', async () => {
    server.use(answers.neverExported());

    const answer = (await (
      await ask({
        measures: ['net_quantity'],
        from: '2026-08-12',
        to: '2026-09-10',
      })
    ).json()) as ModelledAnswer;

    expect(answer).toEqual({ state: 'never-exported' });
  });

  it('can pace a caller, saying how long to wait in the plain header', async () => {
    server.use(
      refusals.paced('post', '/api/tenants/:tenantId/analytics/questions', 42),
    );

    const response = await ask({ measures: ['net_quantity'] });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
  });

  it('can say the answer is unavailable, with the reason the platform attaches', async () => {
    server.use(
      refusals.unanswerable(
        'post',
        '/api/tenants/:tenantId/analytics/questions',
      ),
    );

    const response = await ask({ measures: ['net_quantity'] });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      statusCode: 503,
      message: 'the answer is unavailable',
      reason: 'model-unreachable',
    });
  });
});
