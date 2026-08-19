/**
 * Every answer this backend can give that is not the thing that was asked for,
 * as one closed set — and the only words the application ever puts them in.
 *
 * Seven requirements look like seven behaviours and are one question: *what
 * kind of answer was that?* Answering it in one place is what makes the rule
 * below enforceable, rather than a discipline every call site has to remember
 * and one of them eventually will not.
 */

export type Refusal =
  /** `400` or `409`: the backend named a cause meant to be shown. */
  | {
      readonly kind: 'rejected';
      readonly message: string;
      readonly field?: string;
    }
  /** `404`: refused or absent, indistinguishable by design. No cause exists. */
  | { readonly kind: 'unavailable' }
  /** `429`: too many attempts at a credential endpoint. */
  | { readonly kind: 'throttled' }
  /** No answer, or an answer that was the service failing. */
  | { readonly kind: 'unreachable' }
  /** Access expired and could not be renewed. */
  | { readonly kind: 'session-ended' };

export class ApiError extends Error {
  /**
   * Written out rather than declared as a constructor parameter property:
   * `erasableSyntaxOnly` is on, and a parameter property is syntax that has to
   * be compiled away rather than erased.
   */
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(describeRefusal(refusal));
    this.name = 'ApiError';
    this.refusal = refusal;
  }
}

interface RejectionBody {
  readonly message?: unknown;
  readonly field?: unknown;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function rejection(body: unknown): Refusal {
  const named = (body ?? {}) as RejectionBody;
  return {
    kind: 'rejected',
    // A rejection with nothing written in it should not occur; if it does, the
    // honest reading is still that the input was rejected. Calling it an
    // absence would tell the person their input was fine.
    message: stringOrUndefined(named.message) ?? 'That was not accepted.',
    ...(stringOrUndefined(named.field) === undefined
      ? {}
      : { field: stringOrUndefined(named.field) }),
  };
}

/**
 * The only function in the application that reads a status code.
 *
 * Nothing but the classification leaves here: not the status, not the raw body,
 * not a correlation identifier. Anything smuggled through is one careless
 * render away from being on screen (8.5).
 */
export function classify(status: number, body: unknown): Refusal {
  if (status === 400 || status === 409) {
    return rejection(body);
  }
  if (status === 429) {
    return { kind: 'throttled' };
  }
  if (status >= 500) {
    // Reached, and it failed to serve. Unavailability would offer the person
    // no way forward, when trying again is exactly the right offer.
    return { kind: 'unreachable' };
  }
  // `404` and anything else unrecognized. Failing closed here means an
  // unexpected status is reported as an absence rather than as a cause the
  // platform never gave.
  return { kind: 'unavailable' };
}

/**
 * The only function that turns a refusal into words.
 *
 * **`unavailable` must never grow an explanation.** This backend answers "you
 * may not act on this", "you presented no credential" and "there is no such
 * record" with byte-identical responses, deliberately, so that one customer
 * cannot confirm another's records by probing. Every plausible guess is
 * therefore wrong most of the time, and the most plausible one — that the
 * session expired — is the worst: by the time it would be shown, the session
 * has usually just been proven valid by a successful renewal. A test scans
 * these words for that vocabulary and fails if it appears.
 *
 * `session-ended` may say so, and it is not the same thing: a renewal was
 * attempted and refused, so the session is over as a matter of fact.
 */
export function describeRefusal(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'rejected':
      // As written. Rewording it would either lose the field it refers to or
      // quietly disagree with the platform that produced it (8.2).
      return refusal.message;
    case 'unavailable':
      return 'This is not available.';
    case 'throttled':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'unreachable':
      return 'The service could not be reached. Please try again.';
    case 'session-ended':
      return 'Your session has ended. Please sign in again.';
  }
}
