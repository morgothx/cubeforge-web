import type { RowValue, Vocabulary, VocabularyGrouping } from '../api/types';
import { dayFrom, type Day } from './calendar';
import type { Composition } from './composition';

/**
 * An answer's rows, read into typed cells — or refused.
 *
 * The platform sends what its engine sends: measures as decimal strings, days
 * as the engine's timestamp for the day, absence as `null`. Every one of those
 * is read here and nowhere else, and a value that cannot be read makes the
 * **whole answer** unreadable. The alternative is a guess, and every guess
 * available is a figure the platform did not return: `Number('')` is `0`.
 */

export type Cell =
  | { readonly kind: 'measure'; readonly value: number | null }
  | { readonly kind: 'day'; readonly day: Day | null }
  | { readonly kind: 'category'; readonly text: string | null }
  | {
      readonly kind: 'labelled';
      readonly code: string | null;
      readonly name: string | null;
    };

export interface Column {
  readonly name: string;
  readonly role: 'grouping' | 'measure';
  /**
   * What the column holds, known before any row is: an empty answer still
   * needs to say its day column is counted in the platform's calendar (4.4).
   */
  readonly shape: VocabularyGrouping['shape'] | 'measure';
  /** Counts movements from before the period — a measure's trait, `false` for a grouping. */
  readonly cumulative: boolean;
}

export interface AnswerTable {
  /** Groupings first, in the composition's order, then measures. */
  readonly columns: readonly Column[];
  /** Ordered by their grouping cells: days ascending, then text. */
  readonly rows: readonly (readonly Cell[])[];
}

export type Reading =
  { readonly ok: true; readonly table: AnswerTable } | { readonly ok: false };

type Row = Readonly<Record<string, RowValue>>;

const UNREADABLE: Reading = { ok: false };

/** A plain decimal, optionally signed — the one form the engine writes a figure in. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

export function readAnswer(
  rows: readonly Row[],
  composition: Composition,
  vocabulary: Vocabulary,
): Reading {
  const groupings: VocabularyGrouping[] = [];
  for (const name of composition.groupings) {
    const declared = vocabulary.groupings.find(
      (grouping) => grouping.name === name,
    );
    if (declared === undefined) return UNREADABLE;
    groupings.push(declared);
  }

  const columns: Column[] = [
    ...groupings.map((grouping): Column => ({
      name: grouping.name,
      role: 'grouping',
      shape: grouping.shape,
      cumulative: false,
    })),
    ...composition.measures.map((name): Column => ({
      name,
      role: 'measure',
      shape: 'measure',
      cumulative:
        vocabulary.measures.find((measure) => measure.name === name)
          ?.cumulative ?? false,
    })),
  ];

  const read: Cell[][] = [];
  for (const row of rows) {
    const cells: Cell[] = [];
    for (const grouping of groupings) {
      const cell = groupingCell(row, grouping);
      if (cell === null) return UNREADABLE;
      cells.push(cell);
    }
    for (const name of composition.measures) {
      const cell = measureCell(row, name);
      if (cell === null) return UNREADABLE;
      cells.push(cell);
    }
    read.push(cells);
  }

  return {
    ok: true,
    table: { columns, rows: read.sort(byGroupings(groupings.length)) },
  };
}

/** `null` when the row does not carry what the grouping's shape says it fills. */
function groupingCell(row: Row, grouping: VocabularyGrouping): Cell | null {
  switch (grouping.shape) {
    case 'day': {
      const value = row[grouping.column];
      if (value === null) return { kind: 'day', day: null };
      if (typeof value !== 'string') return null;
      const day = dayFrom(value.slice(0, 10));
      return day === null ? null : { kind: 'day', day };
    }
    case 'category': {
      const text = textIn(row, grouping.column);
      return text === undefined ? null : { kind: 'category', text };
    }
    case 'labelled': {
      const code = textIn(row, grouping.codeColumn);
      const name = textIn(row, grouping.nameColumn);
      return code === undefined || name === undefined
        ? null
        : { kind: 'labelled', code, name };
    }
  }
}

/**
 * A text column's value; `undefined` when the column is missing or holds
 * something other than text. A missing key reads as `undefined`, never as
 * `null`, so it cannot pass for the platform saying "no value".
 */
function textIn(row: Row, column: string): string | null | undefined {
  const value = row[column];
  return value === null || typeof value === 'string' ? value : undefined;
}

/** `null` when the figure cannot be read; never a guess at one. */
function measureCell(row: Row, name: string): Cell | null {
  const value = row[name];
  if (value === null) return { kind: 'measure', value: null };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { kind: 'measure', value } : null;
  }
  if (typeof value === 'string' && DECIMAL.test(value)) {
    return { kind: 'measure', value: Number(value) };
  }
  return null;
}

/**
 * Days ascending, then text, one grouping at a time; an absent value last.
 * Ordering is not a figure — nothing in a row is changed by it.
 */
function byGroupings(count: number) {
  return (a: readonly Cell[], b: readonly Cell[]): number => {
    for (let index = 0; index < count; index += 1) {
      const order = compare(sortKey(a[index]), sortKey(b[index]));
      if (order !== 0) return order;
    }
    return 0;
  };
}

function sortKey(cell: Cell | undefined): string | null {
  switch (cell?.kind) {
    case 'day':
      return cell.day;
    case 'category':
      return cell.text;
    case 'labelled':
      return cell.code;
    default:
      return null;
  }
}

function compare(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
