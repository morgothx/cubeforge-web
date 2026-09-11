import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  CallerStanding,
  Member,
  ModelledAnswer,
  QuestionBody,
  RowValue,
  Session,
  Vocabulary,
} from '../src/api/types';

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

  /**
   * The analytics routes, answered in the platform's own forms.
   *
   * Read out of `cubeforge-api` rather than written to be convenient. Measures
   * are decimal strings, because the engine reports every column as text; a day
   * is the engine's timestamp for that day, not a plain date; and absence is
   * `null`. A fixture answering numbers and dates would let a reader that
   * mishandles the real forms pass here and fail against the running platform.
   */
  analytics: {
    /** The body `cubeforge-api` publishes, as its literal contract test pins it. */
    vocabulary: {
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
    } satisfies Vocabulary,

    completeThrough: '2026-09-10T03:00:00.000Z',

    /** The overview's first question: on hand, by product. */
    onHand: [
      {
        product_code: 'W-1',
        product_name: 'the W-1 widget',
        on_hand_quantity: '6',
      },
      {
        product_code: 'W-2',
        product_name: 'the W-2 widget',
        on_hand_quantity: '14',
      },
    ],

    /** The overview's second: net quantity and count, by recorded day and kind. */
    movements: [
      {
        recorded_day: '2026-09-08T00:00:00.000',
        kind: 'receipt',
        net_quantity: '10',
        movement_count: '2',
      },
      {
        recorded_day: '2026-09-08T00:00:00.000',
        kind: 'issue',
        net_quantity: '-4',
        movement_count: '1',
      },
      {
        recorded_day: '2026-09-09T00:00:00.000',
        kind: 'receipt',
        net_quantity: '6',
        movement_count: '1',
      },
    ],
  },
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

  /**
   * Too many questions: refused, saying how long to wait in the plain header
   * the platform sets deliberately beside the library's per-bucket one.
   */
  paced: (method: Method, path: string, seconds: number): HttpHandler =>
    http[method](path, () =>
      HttpResponse.json(
        { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
        { status: 429, headers: { 'Retry-After': String(seconds) } },
      ),
    ),

  /**
   * The answer is unavailable right now. The `reason` is one of a closed set
   * of words the platform wrote itself; it travels, and must never be shown.
   */
  unanswerable: (method: Method, path: string): HttpHandler =>
    http[method](path, () =>
      HttpResponse.json(
        {
          statusCode: 503,
          message: 'the answer is unavailable',
          reason: 'model-unreachable',
        },
        { status: 503 },
      ),
    ),
};

const QUESTIONS = '/api/tenants/:tenantId/analytics/questions';

/**
 * A question answered as told, for the tests whose subject is one answer.
 * Refuses a caller with no credential exactly as the route does.
 */
export const answers = {
  answering: (answer: ModelledAnswer): HttpHandler =>
    http.post(
      QUESTIONS,
      authorized(() => HttpResponse.json(answer)),
    ),

  /** Nothing has ever been carried out of the store for this tenant. */
  neverExported: (): HttpHandler =>
    answers.answering({ state: 'never-exported' }),
};

/**
 * Refuses unknown names as the platform does: every one at once, both offered
 * lists in the message, and the side it was wrong on as the field.
 */
function refusedNames(body: QuestionBody): Response | null {
  const { measures, groupings } = backend.analytics.vocabulary;
  const measureNames = measures.map(({ name }) => name);
  const groupingNames = groupings.map(({ name }) => name);

  const wrongMeasures = body.measures.filter(
    (name) => !measureNames.includes(name),
  );
  const wrongGroupings = body.groupings.filter(
    (name) => !groupingNames.includes(name),
  );
  const unknown = [...wrongMeasures, ...wrongGroupings];
  if (unknown.length === 0) return null;

  const field = [
    ...(wrongMeasures.length > 0 ? ['measures'] : []),
    ...(wrongGroupings.length > 0 ? ['groupings'] : []),
  ].join(' and ');

  return HttpResponse.json(
    {
      statusCode: 400,
      message:
        `${field} does not offer ${unknown.map((name) => `"${name}"`).join(', ')}; ` +
        `measures are ${measureNames.join(', ')} ` +
        `and groupings are ${groupingNames.join(', ')}`,
      field,
    },
    { status: 400 },
  );
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join() === [...b].sort().join();
}

/**
 * Rows for any composition the fixtures do not spell out: two of them, in the
 * platform's forms, filling exactly the columns the vocabulary says each asked
 * grouping fills.
 *
 * When a cumulative measure is asked beside one the period bounds, the second
 * row carries `null` for the bounded ones — a product that moved only before
 * the period, which is what the platform answers for it.
 */
function rowsFor(body: QuestionBody): Record<string, RowValue>[] {
  const { measures, groupings } = backend.analytics.vocabulary;
  const cumulative = body.measures.some(
    (name) => measures.find((measure) => measure.name === name)?.cumulative,
  );

  return [0, 1].map((index) => {
    const row: Record<string, RowValue> = {};
    for (const name of body.groupings) {
      const grouping = groupings.find((candidate) => candidate.name === name);
      if (grouping === undefined) continue;
      if (grouping.shape === 'day') {
        row[grouping.column] = `2026-09-0${index + 1}T00:00:00.000`;
      } else if (grouping.shape === 'category') {
        row[grouping.column] = index === 0 ? 'receipt' : 'issue';
      } else {
        row[grouping.codeColumn] = `W-${index + 1}`;
        row[grouping.nameColumn] = `the W-${index + 1} widget`;
      }
    }
    for (const name of body.measures) {
      const isCumulative = measures.find(
        (measure) => measure.name === name,
      )?.cumulative;
      row[name] =
        index === 1 && cumulative && !isCumulative ? null : String(index + 1);
    }
    return row;
  });
}

/** The rows the route answers a composition with. */
function answerRows(body: QuestionBody): readonly Record<string, RowValue>[] {
  if (
    sameNames(body.measures, ['on_hand_quantity']) &&
    sameNames(body.groupings, ['product'])
  ) {
    return backend.analytics.onHand;
  }
  if (
    sameNames(body.measures, ['net_quantity', 'movement_count']) &&
    sameNames(body.groupings, ['recorded_day', 'kind'])
  ) {
    return backend.analytics.movements;
  }
  return rowsFor(body);
}

/**
 * Refuses anything arriving without a credential, exactly as the guard does.
 *
 * The backend's guard answers a caller it does not recognise with the same
 * wordless `404` as a caller it will not admit. A harness that answered these
 * routes regardless would hide a whole class of mistake — a read fired before
 * the session exists looks perfectly healthy until production, where it is
 * refused and sends the request layer off to renew a credential nobody has.
 */
function authorized(
  answer: () => Response,
): (info: { request: Request }) => Response {
  return ({ request }) =>
    request.headers.get('Authorization') === null
      ? HttpResponse.json(REFUSED, { status: 404 })
      : answer();
}

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

    http.get(
      '/api/me',
      authorized(() => HttpResponse.json(backend.caller)),
    ),

    // The backend excludes revoked memberships unless asked for them, so the
    // harness does too: a listing that always included them would let a client
    // that forgot the query still show a meaningful active flag (7.1).
    http.get('/api/tenants/:tenantId/members', ({ request }) => {
      if (request.headers.get('Authorization') === null) {
        return HttpResponse.json(REFUSED, { status: 404 });
      }
      const all =
        new URL(request.url).searchParams.get('includeInactive') === 'true';
      return HttpResponse.json(
        all ? backend.members : backend.members.filter(({ active }) => active),
      );
    }),
    http.post(
      '/api/tenants/:tenantId/members',
      authorized(() =>
        HttpResponse.json(
          { membershipId: 'm-new', personId: 'person-new', role: 'viewer' },
          { status: 201 },
        ),
      ),
    ),
    http.patch(
      '/api/tenants/:tenantId/members/:membershipId',
      authorized(() => new HttpResponse(null, { status: 204 })),
    ),
    http.delete(
      '/api/tenants/:tenantId/members/:membershipId',
      authorized(() => new HttpResponse(null, { status: 204 })),
    ),

    http.get(
      '/api/tenants/:tenantId/analytics/vocabulary',
      authorized(() => HttpResponse.json(backend.analytics.vocabulary)),
    ),

    http.post(QUESTIONS, async ({ request }) => {
      if (request.headers.get('Authorization') === null) {
        return HttpResponse.json(REFUSED, { status: 404 });
      }
      const sent = (await request.json()) as Partial<QuestionBody>;
      const body: QuestionBody = {
        measures: sent.measures ?? [],
        groupings: sent.groupings ?? [],
        from: sent.from ?? '',
        to: sent.to ?? '',
        by: sent.by ?? 'recorded',
      };

      return (
        refusedNames(body) ??
        HttpResponse.json({
          state: 'answered',
          completeThrough: backend.analytics.completeThrough,
          servedFrom: 'prepared',
          rows: answerRows(body),
        } satisfies ModelledAnswer)
      );
    }),
  ];
}
