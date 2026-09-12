/**
 * The wait the platform asked for, held in one place.
 *
 * The platform counts questions **per caller, across every tenant**, so this is
 * one hold for the whole application rather than one per view or per tenant.
 * Switching tenant does not escape it, because switching tenant does not make
 * somebody a different caller.
 *
 * A module value, like the session's credential, and for the same reason: the
 * layers that need it are not in one React tree, and a value read through a
 * closure is a value that can be one render stale — precisely while a countdown
 * is running. It outlives renders on purpose, which is why `test/setup.ts`
 * releases it between tests.
 */

let heldUntil: number | null = null;
const listeners = new Set<() => void>();

/**
 * Hold every question for `seconds`.
 *
 * **A later, shorter wait never shortens a longer one.** The platform refused
 * for a reason it already stated; asking again sooner because a second refusal
 * named a smaller number would spend exactly the allowance the wait exists to
 * protect.
 */
export function holdQuestions(seconds: number, now: number = Date.now()): void {
  const until = now + seconds * 1000;
  heldUntil = heldUntil === null ? until : Math.max(heldUntil, until);
  announce();
}

/** Whole seconds left, and `0` when nothing is held. Never negative. */
export function secondsHeld(now: number = Date.now()): number {
  if (heldUntil === null) return 0;
  return Math.max(0, Math.ceil((heldUntil - now) / 1000));
}

/** Called whenever the hold is set or released. Returns how to stop listening. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ends the hold. Tests need this; nothing in the application calls it. */
export function releaseHold(): void {
  heldUntil = null;
  announce();
}

function announce(): void {
  for (const listener of listeners) listener();
}
