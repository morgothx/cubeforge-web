import { holdQuestions, releaseHold, secondsHeld, subscribe } from './hold';

const NOW = new Date('2026-09-10T12:00:00.000Z').getTime();

/**
 * No local reset: `test/setup.ts` releases the hold after every test, and
 * these tests depend on that. Resetting here too would make the global release
 * unverifiable — a line nothing could show to matter.
 */

describe('holding questions while the platform says to wait', () => {
  it('holds nothing until the platform says so', () => {
    expect(secondsHeld(NOW)).toBe(0);
  });

  it('counts down the whole seconds left, and stops at none', () => {
    holdQuestions(42, NOW);

    expect(secondsHeld(NOW)).toBe(42);
    expect(secondsHeld(NOW + 41_500)).toBe(1);
    expect(secondsHeld(NOW + 42_000)).toBe(0);
    // Past the wait is not a negative wait.
    expect(secondsHeld(NOW + 90_000)).toBe(0);
  });

  /**
   * A second refusal inside a longer wait must not shorten it. The platform
   * refused for a reason it already stated; asking again sooner because a
   * later refusal said a smaller number would spend the allowance the wait
   * exists to protect.
   */
  it('never shortens a wait already running', () => {
    holdQuestions(60, NOW);
    holdQuestions(5, NOW + 1_000);

    expect(secondsHeld(NOW + 1_000)).toBe(59);
  });

  it('extends a wait when the platform asks for longer', () => {
    holdQuestions(5, NOW);
    holdQuestions(90, NOW);

    expect(secondsHeld(NOW)).toBe(90);
  });

  it('tells whoever is listening when the hold changes', () => {
    const heard: number[] = [];
    const stop = subscribe(() => heard.push(secondsHeld(NOW)));

    holdQuestions(30, NOW);
    releaseHold();

    expect(heard).toEqual([30, 0]);

    stop();
    holdQuestions(30, NOW);
    // Unsubscribed means unsubscribed: a view that has gone must not be woken.
    expect(heard).toEqual([30, 0]);
  });

  /**
   * The hold outlives renders on purpose — the platform counts a caller, not a
   * screen — so tests have to clear it, and `test/setup.ts` does. Without that
   * a held test would hold every test after it.
   */
  it('can be released, which is what keeps one test from holding the next', () => {
    holdQuestions(60, NOW);
    releaseHold();

    expect(secondsHeld(NOW)).toBe(0);
  });

  it('reads the clock when nobody says what time it is', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(NOW));
      holdQuestions(10);
      expect(secondsHeld()).toBe(10);

      vi.setSystemTime(new Date(NOW + 4_000));
      expect(secondsHeld()).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });
});
