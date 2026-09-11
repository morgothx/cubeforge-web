/**
 * Days as the platform counts them, and moments as it states them.
 *
 * Every day the platform counts is a day in one calendar — UTC today, named by
 * the vocabulary rather than assumed here. A person in Bogotá at eight in the
 * evening is already in the platform's next day, so nothing in this module ever
 * reads the machine's own zone: a local reading is how "the thirty days ending
 * today" quietly ends a day before the data does, on exactly the machines where
 * nobody is watching for it.
 */

declare const aDay: unique symbol;

/**
 * `YYYY-MM-DD`, and a real date — a calendar date with no time and no zone of
 * its own, which is exactly what the platform counts. Obtainable only through
 * `dayFrom` or the arithmetic below, so a string that merely looks like one
 * cannot be passed where a day is meant.
 */
export type Day = string & { readonly [aDay]: true };

const SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** The day this text names, or `null` when it names none. */
export function dayFrom(text: string): Day | null {
  if (!SHAPE.test(text)) return null;
  // The shape is not the calendar: `2026-02-30` passes the pattern and is no
  // date at all. Parsed at UTC midnight, a real date prints back unchanged.
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && isoDay(parsed) === text
    ? (text as Day)
    : null;
}

/**
 * The current day in `calendar`, which is what "today" means for a period
 * ending today (2.5). Asked of the zone the platform names, never of the
 * machine.
 */
export function today(calendar: string, now: Date): Day {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: calendar,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}` as Day;
}

/** `days` after `day` — or before it, for a negative count. */
export function addDays(day: Day, days: number): Day {
  return isoDay(
    new Date(new Date(`${day}T00:00:00.000Z`).getTime() + days * DAY_MS),
  ) as Day;
}

/** Inclusive of both ends, as a period is: a day to itself is one day. */
export function spanInDays(from: Day, to: Day): number {
  const between =
    new Date(`${to}T00:00:00.000Z`).getTime() -
    new Date(`${from}T00:00:00.000Z`).getTime();
  return Math.round(between / DAY_MS) + 1;
}

/**
 * A day, for a person to read.
 *
 * Formatted as the date it is, never converted: the day is put at UTC midnight
 * and read back in UTC, so no zone — the machine's or the platform's — can
 * move it. Converting a day to local time is where it silently becomes the day
 * before (4.4).
 */
export function formatDay(day: Day): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

/**
 * A moment, to the minute, in the platform's calendar with the zone named.
 *
 * Truncated and never rounded — formatting drops the seconds rather than
 * rounding them. Rounding 14:59:40 up to 15:00 would present an answer as
 * complete through a minute it is not, which is later than the platform said
 * (4.2).
 */
export function formatMoment(iso: string, calendar: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: calendar,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

function isoDay(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}
