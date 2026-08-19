import { ApiError, classify, describeRefusal, type Refusal } from './refusal';

/**
 * The single place that reads a status code, and the single place that turns
 * the result into words.
 *
 * Seven requirements collapse into these two functions. What makes the collapse
 * worth it is that the rule "never explain a refusal that carries no cause"
 * then has one enforcement point instead of a call site's worth of discipline.
 */
describe('classifying an answer', () => {
  it('reads a rejection as a cause meant to be shown, with its field', () => {
    const refusal = classify(409, {
      statusCode: 409,
      message: 'this person is already a member of this tenant',
      field: 'email',
    });

    expect(refusal).toEqual({
      kind: 'rejected',
      message: 'this person is already a member of this tenant',
      field: 'email',
    });
  });

  it('reads a rejection with no field as one without a field', () => {
    const refusal = classify(409, {
      statusCode: 409,
      message: 'a tenant must retain at least one active administrator',
    });

    expect(refusal).toEqual({
      kind: 'rejected',
      message: 'a tenant must retain at least one active administrator',
    });
  });

  it('reads rejected input as a rejection too, not as an absence', () => {
    const refusal = classify(400, {
      statusCode: 400,
      message: 'role must be one of: admin, editor, viewer',
      field: 'role',
    });

    expect(refusal).toMatchObject({ kind: 'rejected', field: 'role' });
  });

  it('reads the wordless refusal as unavailability, carrying nothing', () => {
    const refusal = classify(404, {
      statusCode: 404,
      message: 'the requested record does not exist',
    });

    // The backend's message is discarded on purpose. It is the same sentence
    // for a caller who may not act, a caller with no credential, and a record
    // that genuinely never existed — so repeating it would dress an absence of
    // information up as information.
    expect(refusal).toEqual({ kind: 'unavailable' });
  });

  it('reads too many attempts as its own outcome', () => {
    expect(
      classify(429, { statusCode: 429, message: 'Too Many Requests' }),
    ).toEqual({
      kind: 'throttled',
    });
  });

  it.each([500, 502, 503])(
    'reads a service that failed to serve (%i) as unreachable',
    (status) => {
      // Reached, and it broke. Reporting this as unavailability would offer no
      // way forward, when trying again is exactly the right offer.
      expect(classify(status, null)).toEqual({ kind: 'unreachable' });
    },
  );

  it('reads a rejection whose cause is missing as a rejection all the same', () => {
    // A rejection with nothing written in it should not happen, and if it does
    // the honest reading is still "this input was rejected" — calling it an
    // absence would tell the person their input was fine.
    expect(classify(400, {})).toMatchObject({ kind: 'rejected' });
  });

  it('carries neither the status code nor the raw body into the outcome', () => {
    const refusal = classify(409, {
      statusCode: 409,
      message: 'already a member',
      field: 'email',
      correlationId: 'abc-123',
    });

    // Requirement 8.5. Anything smuggled through here is one careless render
    // away from being on screen.
    expect(JSON.stringify(refusal)).not.toContain('409');
    expect(JSON.stringify(refusal)).not.toContain('abc-123');
    expect(JSON.stringify(refusal)).not.toContain('statusCode');
  });
});

describe('putting a refusal into words', () => {
  /**
   * The words a wordless refusal must never contain.
   *
   * Each of these is a plausible, helpful-sounding guess, and each is wrong
   * most of the time: this backend answers "you may not", "you are not signed
   * in" and "it is not there" with the same bytes. The one that reads best —
   * "your session expired" — is the worst, because by the time it is shown the
   * session has usually just been proven valid by a successful renewal.
   */
  const FORBIDDEN =
    /session|expired|permission|permitted|not found|does not exist|forbidden|unauthori[sz]ed|sign in|log in|access denied/i;

  it('says a wordless refusal is unavailable, and nothing else', () => {
    const words = describeRefusal({ kind: 'unavailable' });

    expect(words).not.toMatch(FORBIDDEN);
    expect(words.length).toBeGreaterThan(0);
  });

  it('repeats a rejection exactly as the backend wrote it', () => {
    const message = 'a tenant must retain at least one active administrator';

    // Requirement 8.2: shown as written, not replaced with wording of our own.
    expect(describeRefusal({ kind: 'rejected', message })).toBe(message);
  });

  it('offers trying again when the service could not be reached', () => {
    expect(describeRefusal({ kind: 'unreachable' })).toMatch(/again/i);
  });

  it('says to sign in again when the session ended, which is not a guess', () => {
    // The forbidden vocabulary applies to the *wordless* refusal, not here.
    // A renewal was attempted and failed, so the session really is over and
    // saying so is a fact rather than a plausible-sounding story.
    expect(describeRefusal({ kind: 'session-ended' })).toMatch(/sign in/i);
  });

  it('says to wait when too many attempts were made', () => {
    expect(describeRefusal({ kind: 'throttled' })).toMatch(/wait|again/i);
  });

  it('answers every outcome in the vocabulary', () => {
    const every: Refusal[] = [
      { kind: 'rejected', message: 'a cause' },
      { kind: 'unavailable' },
      { kind: 'throttled' },
      { kind: 'unreachable' },
      { kind: 'session-ended' },
    ];

    // Adding an outcome without giving it words fails here rather than showing
    // an empty sentence to somebody.
    for (const refusal of every) {
      expect(describeRefusal(refusal).trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the error that carries a refusal', () => {
  it('is throwable, and says what it is', () => {
    const error = new ApiError({ kind: 'unavailable' });

    expect(error).toBeInstanceOf(Error);
    expect(error.refusal).toEqual({ kind: 'unavailable' });
    expect(error.message).toBe(describeRefusal({ kind: 'unavailable' }));
  });
});
