import type { QuestionBody, Vocabulary } from '../api/types';
import { addDays, dayFrom, spanInDays, today, type Day } from './calendar';

/**
 * Whether a composition can be asked — decided once, for every place one
 * comes from.
 *
 * A person's draft, an address somebody opened and a question the overview
 * chose in advance are three sources of the same thing, and they are checked
 * by one function against one vocabulary. Three checks would drift, and the
 * one that drifted would be the one to ask the platform something it refuses.
 *
 * No measure or grouping name is written in this module. What is offered, the
 * longest period and the default moment all come from the vocabulary.
 */

/** A composition as typed, or read out of an address: nothing checked yet. */
export interface Draft {
  readonly measures: readonly string[];
  readonly groupings: readonly string[];
  readonly from: string;
  readonly to: string;
  readonly by: string;
}

/** A composition the platform can be asked, in the vocabulary's order. */
export interface Composition {
  readonly measures: readonly string[];
  readonly groupings: readonly string[];
  readonly from: Day;
  readonly to: Day;
  readonly by: string;
}

export type CompositionProblem =
  | { readonly kind: 'no-measure' }
  | { readonly kind: 'not-offered'; readonly names: readonly string[] }
  | {
      readonly kind: 'not-a-day';
      readonly which: 'from' | 'to';
      readonly text: string;
    }
  | { readonly kind: 'reversed' }
  | { readonly kind: 'too-long'; readonly longestDays: number }
  | { readonly kind: 'unknown-moment'; readonly text: string };

export type Checked =
  | { readonly ok: true; readonly composition: Composition }
  | { readonly ok: false; readonly problems: readonly CompositionProblem[] };

/**
 * Every problem at once, never the first: somebody who chose no measure and
 * reversed the period learns both, rather than fixing one to be told of the
 * next.
 *
 * A checked composition is **canonical** — the vocabulary's order, each name
 * once — so two spellings of one question become one address, one query key
 * and one request.
 */
export function checkComposition(
  draft: Draft,
  vocabulary: Vocabulary,
): Checked {
  const measures = vocabulary.measures.map(({ name }) => name);
  const groupings = vocabulary.groupings.map(({ name }) => name);
  const problems: CompositionProblem[] = [];

  if (draft.measures.length === 0) {
    problems.push({ kind: 'no-measure' });
  }

  const notOffered = unique([
    ...draft.measures.filter((name) => !measures.includes(name)),
    ...draft.groupings.filter((name) => !groupings.includes(name)),
  ]);
  if (notOffered.length > 0) {
    problems.push({ kind: 'not-offered', names: notOffered });
  }

  const from = dayFrom(draft.from);
  const to = dayFrom(draft.to);
  if (from === null) {
    problems.push({ kind: 'not-a-day', which: 'from', text: draft.from });
  }
  if (to === null) {
    problems.push({ kind: 'not-a-day', which: 'to', text: draft.to });
  }
  if (from !== null && to !== null) {
    if (to < from) {
      problems.push({ kind: 'reversed' });
    } else if (spanInDays(from, to) > vocabulary.longestPeriodDays) {
      problems.push({
        kind: 'too-long',
        longestDays: vocabulary.longestPeriodDays,
      });
    }
  }

  if (!vocabulary.readBy.includes(draft.by)) {
    problems.push({ kind: 'unknown-moment', text: draft.by });
  }

  if (problems.length > 0 || from === null || to === null) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    composition: {
      measures: measures.filter((name) => draft.measures.includes(name)),
      groupings: groupings.filter((name) => draft.groupings.includes(name)),
      from,
      to,
      by: draft.by,
    },
  };
}

/** The thirty days ending on the platform's today (2.5). */
export function defaultPeriod(
  vocabulary: Vocabulary,
  now: Date,
): { readonly from: Day; readonly to: Day } {
  const to = today(vocabulary.calendar, now);
  return { from: addDays(to, -29), to };
}

/**
 * A draft read out of an address.
 *
 * An absent part takes its default — no measures and no groupings, the
 * default period, the platform's first moment. A part that is **present** is
 * kept exactly as written, even when it is wrong, so the check can report it
 * (3.9). Replacing it silently would answer a question nobody asked.
 */
export function draftFromAddress(
  search: URLSearchParams,
  vocabulary: Vocabulary,
  now: Date,
): Draft {
  const period = defaultPeriod(vocabulary, now);

  return {
    measures: listIn(search.get('measures')),
    groupings: listIn(search.get('groupings')),
    from: search.get('from') ?? period.from,
    to: search.get('to') ?? period.to,
    by: search.get('by') ?? vocabulary.readBy[0] ?? '',
  };
}

/** The address of a composition: `?measures=…&groupings=…&from=…&to=…&by=…`. */
export function addressOf(composition: Composition): URLSearchParams {
  const address = new URLSearchParams();
  address.set('measures', composition.measures.join(','));
  if (composition.groupings.length > 0) {
    address.set('groupings', composition.groupings.join(','));
  }
  address.set('from', composition.from);
  address.set('to', composition.to);
  address.set('by', composition.by);
  return address;
}

/** The body the question route takes for this composition. */
export function questionBodyOf(composition: Composition): QuestionBody {
  return {
    measures: composition.measures,
    groupings: composition.groupings,
    from: composition.from,
    to: composition.to,
    by: composition.by,
  };
}

function listIn(value: string | null): string[] {
  return value === null
    ? []
    : value.split(',').filter((name) => name.length > 0);
}

function unique(names: readonly string[]): string[] {
  return [...new Set(names)];
}
