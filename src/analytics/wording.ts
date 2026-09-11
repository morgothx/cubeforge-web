import { dayFrom, formatDay, formatMoment, type Day } from './calendar';
import type { CompositionProblem } from './composition';

/**
 * Every sentence the analytics say that is not a refusal.
 *
 * Refusals have their own single voice, in `describeRefusal`, and only
 * `RefusalNotice` speaks them. These are the other things a person reads: why
 * a question cannot be asked yet, what an empty answer means, and what a figure
 * does and does not include.
 *
 * Two rules hold here, and both are about not claiming more than the platform
 * said. An answer is only as current as the last export (10.4), so nothing
 * below calls anything live, latest or up to date. And a period is only quiet
 * up to the moment the answer is complete through (4.2): the days after it are
 * unknown, not empty.
 */

/** Why a composition cannot be asked, said to whoever composed it. */
export function describeProblem(problem: CompositionProblem): string {
  switch (problem.kind) {
    case 'no-measure':
      return 'Choose at least one measure to ask about.';
    case 'not-offered':
      return `The platform does not offer ${problem.names.join(', ')}. Choose from what it lists.`;
    case 'not-a-day':
      return `The ${problem.which} date, “${problem.text}”, is not a date. Write it as YYYY-MM-DD.`;
    case 'reversed':
      return 'The period ends before it starts.';
    case 'too-long':
      // The platform's own limit, as the vocabulary stated it — never a number
      // this dashboard remembers.
      return `A period covers at most ${problem.longestDays} days. Shorten it.`;
    case 'unknown-moment':
      return `“${problem.text}” is not a moment the platform reads by.`;
  }
}

/** A tenant nothing has ever been exported for (5.3). */
export function neverExported(): string {
  return 'This tenant’s data has not arrived yet: nothing has been exported for it.';
}

/**
 * An answer with no rows, said without claiming more of the period than the
 * answer covers.
 *
 * Three cases, and the difference between them is 4.2. When the answer covers
 * the whole period, it was quiet. When it stops inside the period, only the
 * part up to that moment was quiet and the rest is not known. When it stops
 * before the period begins, nothing about the period is known at all — and
 * calling that a quiet period would be the dashboard claiming an answer the
 * platform has not given.
 */
export function nothingRecorded(
  from: Day,
  to: Day,
  completeThrough: string,
  calendar: string,
): string {
  const moment = formatMoment(completeThrough, calendar);
  const through = dayFrom(completeThrough.slice(0, 10));

  if (through === null || through >= to) {
    return `Nothing was recorded from ${formatDay(from)} to ${formatDay(to)}.`;
  }

  if (through < from) {
    return `Data for this period has not arrived yet. The data is complete through ${moment}.`;
  }

  return `Nothing was recorded from ${formatDay(from)} to ${formatDay(through)}. Data after ${moment} has not arrived yet.`;
}

/**
 * What a cumulative measure counts, said wherever one appears (2.4).
 *
 * Attached to the measure rather than to the overview, because the same
 * misreading is available in the explorer the moment somebody chooses one.
 */
export function cumulativeNote(measure: string): string {
  return `${measure} counts movements from before this period as well as within it. It is not a figure for this period alone.`;
}

/** Where an answer came from (4.3), in the platform's two terms. */
export function describeProvenance(
  servedFrom: 'prepared' | 'exported-objects',
): string {
  return servedFrom === 'prepared'
    ? 'Answered from data prepared in advance.'
    : 'Answered by reading the exported data.';
}

/**
 * An answer whose figures could not be read.
 *
 * Deliberately not an empty state: the platform answered, and the dashboard
 * could not make sense of what it sent. Showing that as "nothing was recorded"
 * would turn a fault into a fact about the tenant's inventory.
 */
export function unreadableAnswer(): string {
  return 'This answer could not be read, so none of it is shown.';
}
