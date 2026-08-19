import { ApiError, classify } from './refusal';
import { session } from './session';
import type { Session } from './types';

/**
 * The one function that talks to the backend, and the only place that knows
 * access expires.
 *
 * Requirements 3.1 to 3.4 look like four behaviours and are one capability:
 * attach the credential, renew it when it runs out, hold everyone else while
 * that happens, and retry nothing else. Split across callers they become four
 * rules to remember; here they are one function's business, and nothing above
 * it has to know that a token has a lifetime at all.
 */

/**
 * The dev server proxies this prefix to the backend and strips it, and
 * CloudFront does the same in production. Written once, here, so no caller ever
 * holds a URL.
 */
const API_BASE = '/api';

/**
 * How long a freshly renewed credential is trusted before another refusal is
 * allowed to look like expiry.
 *
 * Exported because a test has to be able to step past it. This is the only
 * place in the design where a clock decides anything, and it is a cost control
 * rather than a correctness mechanism — see `renewalWouldBeWasted`.
 */
export const RENEWAL_COOLDOWN_MS = 5_000;

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

/** The renewal in flight, if any. One at a time, for everybody. */
let renewal: Promise<void> | null = null;
let renewedAt: number | null = null;

/**
 * An expired credential and a genuine refusal are the same `404` from this
 * backend, deliberately, so the only way to tell them apart is to renew and ask
 * again. That costs one round trip on a real refusal — and both alternative
 * readings are worse: never renewing signs people out every fifteen minutes,
 * and treating every `404` as expiry signs them out on every legitimate
 * refusal.
 *
 * What this guards against is the third failure: a screen holding several
 * genuinely refused resources rotating the credential once per resource,
 * because each refusal looks exactly like expiry to a layer that cannot see the
 * others. Being wrong here costs one request reported as unavailable that a
 * renewal would have rescued — and the next request renews anyway.
 */
function renewalWouldBeWasted(): boolean {
  return renewedAt !== null && Date.now() - renewedAt < RENEWAL_COOLDOWN_MS;
}

/**
 * Issued outside the authorized path, carrying no access token. That is what
 * makes "the renewal cannot itself be renewed" structural rather than a rule
 * somebody has to keep.
 */
async function performRenewal(): Promise<void> {
  const presented = session.refreshToken();
  if (presented === null) {
    throw new ApiError({ kind: 'session-ended' });
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: presented }),
  });

  if (!response.ok) {
    // Whatever the reason, this session cannot continue. Ending it here rather
    // than leaving a dead credential behind means the next request cannot spend
    // another round trip discovering the same thing.
    session.end();
    throw new ApiError({ kind: 'session-ended' });
  }

  session.adopt((await response.json()) as Session);
  renewedAt = Date.now();
}

/**
 * One renewal for everybody who needs it.
 *
 * Without this, three requests expiring together would each renew — and since
 * the backend rotates refresh tokens and invalidates the whole family when a
 * used one is presented, the second renewal would end the very session the
 * first was rescuing.
 */
function renewOnce(): Promise<void> {
  renewal ??= performRenewal().finally(() => {
    renewal = null;
  });
  return renewal;
}

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    // A refusal with no body is still a refusal; `classify` reads the status.
    return null;
  }
}

interface Sent {
  readonly response: Response;
  /** The credential this attempt actually presented, or `null` if it had none. */
  readonly presented: string | null;
}

async function send(path: string, options: RequestOptions): Promise<Sent> {
  const access = session.accessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(access === null ? {} : { Authorization: `Bearer ${access}` }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  return { response, presented: access };
}

async function answerOf<T>(response: Response): Promise<T> {
  // `204`, which most of this backend's mutations answer with.
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Sends a request with whatever access is current, renewing and retrying once
 * if the answer could mean the credential ran out.
 *
 * Resolves to the parsed body, or to nothing for a route that answers nothing.
 * Throws `ApiError` carrying one of the refusal vocabulary's outcomes — never a
 * status code, and never a raw body.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let attempt: Sent;
  try {
    attempt = await send(path, options);
  } catch {
    // No answer at all: a dropped connection, a blocked request, an aborted
    // one. Not a refusal, and it must not read as one (8.3).
    throw new ApiError({ kind: 'unreachable' });
  }

  if (attempt.response.ok) {
    return answerOf<T>(attempt.response);
  }

  const refusal = classify(
    attempt.response.status,
    await bodyOf(attempt.response),
  );

  // Only the wordless refusal can mean expiry. A rejection, a conflict and a
  // throttled attempt all say what they are, and retrying any of them would
  // repeat something that will never succeed (3.4).
  const couldBeExpiry =
    refusal.kind === 'unavailable' && session.refreshToken() !== null;
  if (!couldBeExpiry) {
    throw new ApiError(refusal);
  }

  // Somebody renewed while this request was in flight, so the credential in
  // hand is already newer than the one that was refused. Retry with it and
  // renew nothing — without this the request is told the thing is unavailable,
  // refused for no reason beyond having been unlucky with its timing.
  const alreadyRenewed = session.accessToken() !== attempt.presented;

  if (!alreadyRenewed) {
    // A renewal under way is worth waiting for even inside the cooldown:
    // somebody else found the expiry first, and this request should get the
    // credential they are fetching rather than be told the thing is gone.
    if (renewal === null && renewalWouldBeWasted()) {
      throw new ApiError(refusal);
    }
    await renewOnce();
  }

  let retry: Sent;
  try {
    retry = await send(path, options);
  } catch {
    throw new ApiError({ kind: 'unreachable' });
  }

  if (retry.response.ok) {
    return answerOf<T>(retry.response);
  }
  // Renewed, asked again, refused again: it was never expiry.
  throw new ApiError(
    classify(retry.response.status, await bodyOf(retry.response)),
  );
}
