import { dayFrom, type Day } from './calendar';
import type { CompositionProblem } from './composition';
import {
  cumulativeNote,
  describeProblem,
  describeProvenance,
  neverExported,
  nothingRecorded,
  unreadableAnswer,
} from './wording';

function day(text: string): Day {
  const parsed = dayFrom(text);
  if (parsed === null) throw new Error(`not a day: ${text}`);
  return parsed;
}

const AUGUST = day('2026-08-12');
const SEPTEMBER = day('2026-09-10');

describe('what a composition cannot be asked for, said to a person', () => {
  const every: CompositionProblem[] = [
    { kind: 'no-measure' },
    { kind: 'not-offered', names: ['revenue'] },
    { kind: 'not-a-day', which: 'from', text: '2026-02-30' },
    { kind: 'reversed' },
    { kind: 'too-long', longestDays: 366 },
    { kind: 'unknown-moment', text: 'written' },
  ];

  it('answers every problem there is, in words', () => {
    // A problem without a sentence is a form that refuses and says nothing.
    for (const problem of every) {
      expect(describeProblem(problem).trim().length).toBeGreaterThan(0);
    }
  });

  it('names the limit the platform stated, rather than one it remembered', () => {
    expect(describeProblem({ kind: 'too-long', longestDays: 366 })).toContain(
      '366',
    );
    expect(describeProblem({ kind: 'too-long', longestDays: 90 })).toContain(
      '90',
    );
  });

  it('quotes back what was written where that is what is wrong', () => {
    expect(
      describeProblem({ kind: 'not-offered', names: ['revenue', 'margin'] }),
    ).toMatch(/revenue.*margin/);
    expect(
      describeProblem({ kind: 'not-a-day', which: 'to', text: 'yesterday' }),
    ).toContain('yesterday');
  });
});

describe('an answer with nothing in it', () => {
  /**
   * 5.3: never exported and nothing recorded are opposite facts that draw the
   * same empty chart. If either sentence contained the other, the two states
   * would be one on screen — which is the whole thing this pair exists to
   * prevent.
   */
  it('says a tenant never exported differently from a quiet period', () => {
    const absent = neverExported();
    const quiet = nothingRecorded(
      AUGUST,
      SEPTEMBER,
      '2026-09-10T03:00:00.000Z',
      'UTC',
    );

    expect(absent).not.toBe(quiet);
    expect(absent).not.toContain(quiet);
    expect(quiet).not.toContain(absent);
    expect(absent).toMatch(/not arrived|has not been/i);
    // The phrase that makes a period quiet belongs to the quiet period alone.
    // Without this the check is only against literal reuse, and a probe that
    // borrowed the sentence with one word changed slipped through it.
    expect(absent).not.toMatch(/nothing was recorded/i);
  });

  it('calls a period quiet only when the answer covers all of it', () => {
    const quiet = nothingRecorded(
      AUGUST,
      SEPTEMBER,
      // Complete through the last day of the period: the whole period is
      // answered, so "nothing was recorded" is a claim about all of it.
      '2026-09-10T23:00:00.000Z',
      'UTC',
    );

    expect(quiet).toMatch(/12 Sept? 2026|12 Aug 2026/);
    expect(quiet).toContain('10 Sep');
    expect(quiet).not.toMatch(/has not arrived/i);
  });

  /**
   * 4.2: the data is complete through the 3rd, and the period runs to the
   * 10th. Calling the 4th to the 10th quiet would present the answer as more
   * current than the platform said it was.
   */
  it('stops at the moment the answer is complete through, and says the rest has not arrived', () => {
    const quiet = nothingRecorded(
      AUGUST,
      SEPTEMBER,
      '2026-09-03T03:00:00.000Z',
      'UTC',
    );

    expect(quiet).toContain('3 Sep');
    expect(quiet).toMatch(/has not arrived/i);
    // The period's end is not claimed quiet: nothing is known about it yet.
    expect(quiet).not.toMatch(/to 10 Sept? 2026\./);
  });

  it('says nothing has arrived at all when the whole period is later than the answer', () => {
    const quiet = nothingRecorded(
      AUGUST,
      SEPTEMBER,
      '2026-08-01T03:00:00.000Z',
      'UTC',
    );

    expect(quiet).toMatch(/has not arrived/i);
    // Not "nothing was recorded": nothing is known about this period at all.
    expect(quiet).not.toMatch(/nothing was recorded/i);
  });
});

describe('what else the dashboard says about an answer', () => {
  it('warns that a cumulative measure is not a figure for the period alone', () => {
    const note = cumulativeNote('on_hand_quantity');

    expect(note).toContain('on_hand_quantity');
    expect(note).toMatch(/before/i);
  });

  it('says where an answer came from, in two distinguishable ways', () => {
    expect(describeProvenance('prepared')).not.toBe(
      describeProvenance('exported-objects'),
    );
    expect(describeProvenance('prepared').trim().length).toBeGreaterThan(0);
    expect(
      describeProvenance('exported-objects').trim().length,
    ).toBeGreaterThan(0);
  });

  it('says an answer could not be read, without saying it was empty', () => {
    const unreadable = unreadableAnswer();

    expect(unreadable).toMatch(/could not be read/i);
    expect(unreadable).not.toMatch(/nothing was recorded|empty/i);
  });
});

/**
 * 10.4: an answer is as current as the last export, and nothing the dashboard
 * says may suggest otherwise. "Latest", "live" and "up to date" are the words
 * that would, and they are the words somebody reaches for when writing a
 * cheerful empty state.
 */
describe('the currency nothing claims', () => {
  const FORBIDDEN =
    /\blive\b|real[- ]time|up to date|\blatest\b|\bcurrently\b/i;

  it('never promises an answer is current', () => {
    const said = [
      neverExported(),
      nothingRecorded(AUGUST, SEPTEMBER, '2026-09-10T03:00:00.000Z', 'UTC'),
      nothingRecorded(AUGUST, SEPTEMBER, '2026-09-03T03:00:00.000Z', 'UTC'),
      nothingRecorded(AUGUST, SEPTEMBER, '2026-08-01T03:00:00.000Z', 'UTC'),
      cumulativeNote('on_hand_quantity'),
      describeProvenance('prepared'),
      describeProvenance('exported-objects'),
      unreadableAnswer(),
      describeProblem({ kind: 'no-measure' }),
      describeProblem({ kind: 'too-long', longestDays: 366 }),
    ];

    for (const sentence of said) {
      expect(sentence).not.toMatch(FORBIDDEN);
    }
  });
});
