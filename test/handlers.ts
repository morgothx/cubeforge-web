import { http, HttpResponse, type HttpHandler } from 'msw';
import type { CallerStanding, Member, Session } from '../src/api/types';

/**
 * The backend, as the tests will meet it.
 *
 * Written from the contracts recorded in `research.md`, read out of
 * `cubeforge-api`'s source rather than from a summary of it. Two details are
 * load-bearing and are easy to get subtly wrong:
 *
 * - a member's address is **omitted** for a caller who may not see it, never
 *   sent as an empty value;
 * - a refusal that carries no cause is a `404` with one exact body, and making
 *   it friendlier here would make authorization and absence distinguishable in
 *   tests while they stay indistinguishable in production.
 */

const REFUSED = {
  statusCode: 404,
  message: 'the requested record does not exist',
} as const;

export const backend = {
  session: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    sessionExpiresAt: '2026-08-18T00:15:00.000Z',
  } satisfies Session,

  caller: {
    personId: 'person-caller',
    email: 'caller@example.com',
    isOperator: false,
    memberships: [
      { tenantId: 't-acme', tenantName: 'Acme', role: 'admin' },
      { tenantId: 't-globex', tenantName: 'Globex', role: 'viewer' },
    ],
  } satisfies CallerStanding,

  /** Acme's members, as an administrator of Acme sees them. */
  members: [
    {
      membershipId: 'm-1',
      personId: 'person-caller',
      email: 'caller@example.com',
      role: 'admin',
      active: true,
    },
    {
      membershipId: 'm-2',
      personId: 'person-editor',
      email: 'editor@example.com',
      role: 'editor',
      active: true,
    },
    {
      membershipId: 'm-3',
      personId: 'person-gone',
      email: 'gone@example.com',
      role: 'viewer',
      active: false,
    },
  ] satisfies Member[],
};

/** The same members with every address withheld, as anyone else sees them. */
export function withoutAddresses(members: readonly Member[]): Member[] {
  return members.map(({ email, ...rest }) => rest);
}

type Method = 'get' | 'post' | 'patch' | 'delete';

/**
 * Each refusal the backend can produce, as a handler that overrides one route.
 *
 * Exposed as builders rather than as fixed handlers because which route refuses
 * is the interesting part of most tests, and a test that had to hand-write the
 * body would eventually write a slightly different one.
 */
export const refusals = {
  /** Authorization and absence, indistinguishable. Carries no cause at all. */
  wordless: (method: Method, path: string): HttpHandler =>
    http[method](path, () => HttpResponse.json(REFUSED, { status: 404 })),

  /** Rejected input: a cause meant to be shown, and the field at fault. */
  rejected: (
    method: Method,
    path: string,
    message: string,
    field?: string,
  ): HttpHandler =>
    http[method](path, () =>
      HttpResponse.json({ statusCode: 400, message, field }, { status: 400 }),
    ),

  /** A conflict: also a cause meant to be shown, sometimes with a field. */
  conflict: (
    method: Method,
    path: string,
    message: string,
    field?: string,
  ): HttpHandler =>
    http[method](path, () =>
      HttpResponse.json({ statusCode: 409, message, field }, { status: 409 }),
    ),

  /** Too many credential attempts. */
  throttled: (method: Method, path: string): HttpHandler =>
    http[method](path, () =>
      HttpResponse.json(
        { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
        { status: 429 },
      ),
    ),

  /** No answer at all, which is not a refusal and must not read as one. */
  unreachable: (method: Method, path: string): HttpHandler =>
    http[method](path, () => HttpResponse.error()),
};

/**
 * One handler per route the feature uses. A test that needs a different answer
 * overrides the single route it cares about rather than restating the rest.
 */
export function handlers(): HttpHandler[] {
  return [
    http.post('/api/auth/sign-in', () => HttpResponse.json(backend.session)),
    http.post('/api/auth/refresh', () => HttpResponse.json(backend.session)),
    http.post(
      '/api/auth/sign-out',
      () => new HttpResponse(null, { status: 204 }),
    ),

    http.get('/api/me', () => HttpResponse.json(backend.caller)),

    http.get('/api/tenants/:tenantId/members', () =>
      HttpResponse.json(backend.members),
    ),
    http.post('/api/tenants/:tenantId/members', () =>
      HttpResponse.json(
        { membershipId: 'm-new', personId: 'person-new', role: 'viewer' },
        { status: 201 },
      ),
    ),
    http.patch(
      '/api/tenants/:tenantId/members/:membershipId',
      () => new HttpResponse(null, { status: 204 }),
    ),
    http.delete(
      '/api/tenants/:tenantId/members/:membershipId',
      () => new HttpResponse(null, { status: 204 }),
    ),
  ];
}
