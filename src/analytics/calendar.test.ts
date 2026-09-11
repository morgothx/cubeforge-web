import {
  addDays,
  dayFrom,
  formatDay,
  formatMoment,
  spanInDays,
  today,
  type Day,
} from './calendar';

/** A day the test knows to be real, without routing it through the parser twice. */
function day(text: string): Day {
  const parsed = dayFrom(text);
  if (parsed === null) throw new Error(`not a day: ${text}`);
  return parsed;
}

/**
 * Runs `check` as though the machine were in `zone`.
 *
 * Node reads `TZ` whenever it formats a local date, so setting it here moves
 * every local reading the code might mistakenly make — which is the point: a
 * calendar that only works on a machine set to UTC works on the CI box and the
 * author's laptop and nowhere a customer is.
 *
 * Through `vi.stubEnv` rather than `process.env`: this is browser code, typed
 * without Node, and the stub is the test runner's own typed way in.
 */
function onAMachineIn(zone: string, check: () => void): void {
  vi.stubEnv('TZ', zone);
  try {
    check();
  } finally {
    vi.unstubAllEnvs();
  }
}

describe('a day as the platform counts it', () => {
  it('accepts a real calendar date written YYYY-MM-DD, and nothing else', () => {
    expect(dayFrom('2026-09-10')).toBe('2026-09-10');

    for (const text of [
      '2026-02-30',
      '2026-13-01',
      '2026-9-10',
      '10/09/2026',
      '2026-09-10T00:00:00.000',
      '',
    ]) {
      expect(dayFrom(text)).toBeNull();
    }
  });

  /**
   * 01:00 UTC on the 10th is 20:00 on the 9th in Bogotá — the case the
   * requirements name. A person there is already in the platform's 10th, and a
   * default period ending on "their" today would end a day before the data.
   */
  it('is today in the platform calendar, whatever zone the machine is in', () => {
    const now = new Date('2026-09-10T01:00:00.000Z');

    for (const zone of ['America/Bogota', 'Pacific/Kiritimati', 'UTC']) {
      onAMachineIn(zone, () => {
        expect(today('UTC', now)).toBe('2026-09-10');
      });
    }
  });

  it('is today in whatever calendar the platform names', () => {
    const now = new Date('2026-09-10T01:00:00.000Z');

    expect(today('America/Bogota', now)).toBe('2026-09-09');
  });

  it('gives thirty days ending today as 12 August to 10 September', () => {
    const now = new Date('2026-09-10T01:00:00.000Z');
    const end = today('UTC', now);
    const start = addDays(end, -29);

    expect([start, end]).toEqual(['2026-08-12', '2026-09-10']);
    expect(spanInDays(start, end)).toBe(30);
  });

  it('counts a period inclusively, so a day to itself is one day', () => {
    expect(spanInDays(day('2026-09-10'), day('2026-09-10'))).toBe(1);
    expect(spanInDays(day('2025-09-10'), day('2026-09-10'))).toBe(366);
  });

  it('moves across month, year and leap boundaries without a zone creeping in', () => {
    onAMachineIn('America/Bogota', () => {
      expect(addDays(day('2026-12-31'), 1)).toBe('2027-01-01');
      expect(addDays(day('2028-02-28'), 1)).toBe('2028-02-29');
      expect(addDays(day('2026-03-01'), -1)).toBe('2026-02-28');
    });
  });
});

describe('a day and a moment, written for a person', () => {
  it('writes a day as that day, even on a machine a day behind it', () => {
    onAMachineIn('America/Bogota', () => {
      expect(formatDay(day('2026-09-10'))).toMatch(/^10 Sept? 2026$/);
    });
  });

  /**
   * Truncated, never rounded. Rounding 14:59:59 up to 15:00 would present the
   * answer as complete through a minute it is not complete through — later
   * than the platform said, which is the one direction this may never err in.
   */
  it('writes a moment to the minute, truncated, with the zone named', () => {
    const written = formatMoment('2026-09-10T14:59:59.999Z', 'UTC');

    expect(written).toContain('14:59');
    expect(written).not.toContain('15:00');
    expect(written).toContain('UTC');
    expect(written).toMatch(/10 Sept? 2026/);
  });

  it('writes a moment in the platform calendar, not the machine one', () => {
    onAMachineIn('America/Bogota', () => {
      expect(formatMoment('2026-09-10T01:30:00.000Z', 'UTC')).toContain(
        '01:30',
      );
    });
  });
});
