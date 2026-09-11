import type { AnswerTable, Cell, Column } from './reading';

/**
 * Whether an answer may be drawn, and where every one of its rows goes.
 *
 * The rule this module exists for is 3.7: a chart is drawn **only if every row
 * becomes exactly one mark in it**. A chart that drops a row looks exactly like
 * a chart of fewer rows — there is nothing on screen for a person to notice —
 * so the decision is made here, once, and the table is always shown beside it.
 *
 * Nothing is invented on the way: a day nobody recorded anything on is not a
 * category, bars are never stacked into a total, and the value axis carries
 * only the figures the answer returned (8.1).
 */

/** How many categories stay legible when they are not days. */
export const MOST_CATEGORIES = 40;
/** How many series a person can still tell apart. */
export const MOST_SERIES = 6;
/**
 * How many marks fit in one chart.
 *
 * A year and a day: the longest period the platform answers, which is the most
 * daily marks a day axis can ever carry. A first value, like the two above,
 * and the first real answers are what should move it.
 *
 * Not a round four hundred, deliberately. The shell's scan that keeps HTTP
 * status codes out of everything above the request layer matches a bare `400`,
 * and a legibility bound is not a status — but a reader of that scan cannot
 * tell, and weakening it to admit this file would cost more than choosing a
 * number with a reason behind it.
 */
export const MOST_MARKS = 366;

export interface Mark {
  /** The row this mark draws. Every row appears exactly once per chart. */
  readonly row: number;
  readonly category: number;
  readonly series: number;
  readonly value: number;
}

export interface ChartPlan {
  readonly measure: string;
  readonly categories: readonly string[];
  /** Named after the measure when there is no series grouping, so a legend can be left out. */
  readonly series: readonly string[];
  readonly marks: readonly Mark[];
  /** The only figures the value axis carries, beside the zero baseline. */
  readonly extremes: { readonly least: number; readonly greatest: number };
}

export type Charting =
  | { readonly drawn: true; readonly charts: readonly ChartPlan[] }
  | { readonly drawn: false };

const NOT_DRAWN: Charting = { drawn: false };

export function planCharts(table: AnswerTable): Charting {
  const groupings = table.columns.filter(
    (column) => column.role === 'grouping',
  );
  const measures = table.columns.filter((column) => column.role === 'measure');
  const axes = axesFor(groupings, table.columns);
  if (axes === null || measures.length === 0) return NOT_DRAWN;

  const categories: string[] = [];
  const series: string[] = [];
  const places: { category: number; series: number }[] = [];

  for (const row of table.rows) {
    const category = labelOf(row[axes.category]);
    const inSeries = axes.series === undefined ? '' : labelOf(row[axes.series]);
    // A row with nowhere to go: a chart could only omit it.
    if (category === null || inSeries === null) return NOT_DRAWN;

    places.push({
      category: indexOf(categories, category),
      series: axes.series === undefined ? 0 : indexOf(series, inSeries),
    });
  }

  if (series.length > MOST_SERIES) return NOT_DRAWN;
  if (!axes.categoriesAreDays && categories.length > MOST_CATEGORIES) {
    return NOT_DRAWN;
  }
  if (table.rows.length > MOST_MARKS) return NOT_DRAWN;
  // Two rows in one place would be drawn as one mark, which is a row merged
  // away rather than shown (3.7).
  if (
    new Set(places.map(({ category, series: at }) => `${category}:${at}`))
      .size !== places.length
  ) {
    return NOT_DRAWN;
  }

  const charts: ChartPlan[] = [];
  for (const measure of measures) {
    const at = table.columns.indexOf(measure);
    const marks: Mark[] = [];

    for (const [row, cells] of table.rows.entries()) {
      const cell = cells[at];
      // An absent figure has no mark, and a chart missing one row of a
      // measure is the failure this whole module is about.
      if (cell?.kind !== 'measure' || cell.value === null) return NOT_DRAWN;
      marks.push({
        row,
        category: places[row]?.category ?? 0,
        series: places[row]?.series ?? 0,
        value: cell.value,
      });
    }

    const values = marks.map((mark) => mark.value);
    charts.push({
      measure: measure.name,
      categories,
      series: series.length > 0 ? series : [measure.name],
      marks,
      extremes: { least: Math.min(...values), greatest: Math.max(...values) },
    });
  }

  return charts.length > 0 ? { drawn: true, charts } : NOT_DRAWN;
}

interface Axes {
  /** Column index of the grouping whose values are the categories. */
  readonly category: number;
  /** Column index of the grouping split into series, if there is one. */
  readonly series?: number;
  readonly categoriesAreDays: boolean;
}

/**
 * Which grouping is the axis and which is the series — or nothing, when the
 * answer has a shape no bar chart can show whole.
 *
 * One grouping is an axis. A day and one other is an axis of days split into
 * series. Two days, two plain groupings, three or more, or none: the table
 * alone (3.7).
 */
function axesFor(
  groupings: readonly Column[],
  columns: readonly Column[],
): Axes | null {
  const days = groupings.filter((column) => column.shape === 'day');

  if (groupings.length === 1) {
    const only = groupings[0];
    if (only === undefined) return null;
    return {
      category: columns.indexOf(only),
      categoriesAreDays: only.shape === 'day',
    };
  }

  if (groupings.length === 2 && days.length === 1) {
    const day = days[0];
    const other = groupings.find((column) => column.shape !== 'day');
    if (day === undefined || other === undefined) return null;
    return {
      category: columns.indexOf(day),
      series: columns.indexOf(other),
      categoriesAreDays: true,
    };
  }

  return null;
}

/** What a cell is called on an axis, or `null` when it has no label at all. */
function labelOf(cell: Cell | undefined): string | null {
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

/** The label's position, appended in the order the rows arrive (already sorted). */
function indexOf(labels: string[], label: string): number {
  const at = labels.indexOf(label);
  if (at !== -1) return at;
  labels.push(label);
  return labels.length - 1;
}
