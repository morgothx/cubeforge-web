import { backend } from '../../test/handlers';
import { checkComposition, type Composition } from './composition';
import {
  MOST_CATEGORIES,
  MOST_MARKS,
  MOST_SERIES,
  planCharts,
} from './chart-plan';
import { readAnswer, type AnswerTable } from './reading';
import type { RowValue } from '../api/types';

const vocabulary = backend.analytics.vocabulary;

function composed(measures: string[], groupings: string[]): Composition {
  const checked = checkComposition(
    {
      measures,
      groupings,
      from: '2026-08-12',
      to: '2026-09-10',
      by: 'recorded',
    },
    vocabulary,
  );
  if (!checked.ok) throw new Error('expected a composition');
  return checked.composition;
}

/** A table, read the way a real answer is read. */
function tableOf(
  rows: readonly Readonly<Record<string, RowValue>>[],
  measures: string[],
  groupings: string[],
): AnswerTable {
  const reading = readAnswer(rows, composed(measures, groupings), vocabulary);
  if (!reading.ok) throw new Error('expected a readable answer');
  return reading.table;
}

/**
 * The engine's timestamp for a real day, counted from a base.
 *
 * Written as arithmetic rather than as `2026-09-${index + 1}`, which was the
 * first version and produced `2026-09-31`: the reading refused the answer
 * before the plan ever saw it, and the bound under test was never reached.
 */
const aDay = (index: number) => {
  const moment = new Date('2026-07-01T00:00:00.000Z');
  moment.setUTCDate(moment.getUTCDate() + index);
  return `${moment.toISOString().slice(0, 10)}T00:00:00.000`;
};

describe('whether an answer may be drawn', () => {
  it('draws one chart per measure, categories from the one grouping', () => {
    const charting = planCharts(
      tableOf(
        [
          { kind: 'receipt', net_quantity: '10', movement_count: '2' },
          { kind: 'issue', net_quantity: '-4', movement_count: '1' },
        ],
        ['net_quantity', 'movement_count'],
        ['kind'],
      ),
    );

    expect(charting.drawn).toBe(true);
    if (!charting.drawn) return;
    expect(charting.charts.map((chart) => chart.measure)).toEqual([
      'net_quantity',
      'movement_count',
    ]);
    const [net] = charting.charts;
    expect(net?.categories).toEqual(['issue', 'receipt']);
    expect(net?.marks).toEqual([
      { row: 0, category: 0, series: 0, value: -4 },
      { row: 1, category: 1, series: 0, value: 10 },
    ]);
    // Only the figures the answer returned. Zero is the baseline the chart
    // draws, not a value it claims was measured.
    expect(net?.extremes).toEqual({ least: -4, greatest: 10 });
  });

  it('puts days on the axis and the other grouping into series', () => {
    const charting = planCharts(
      tableOf(
        [
          { recorded_day: aDay(0), kind: 'receipt', net_quantity: '10' },
          { recorded_day: aDay(0), kind: 'issue', net_quantity: '-4' },
          { recorded_day: aDay(1), kind: 'receipt', net_quantity: '6' },
        ],
        ['net_quantity'],
        ['recorded_day', 'kind'],
      ),
    );

    expect(charting.drawn).toBe(true);
    if (!charting.drawn) return;
    const [chart] = charting.charts;
    expect(chart?.categories).toEqual([
      aDay(0).slice(0, 10),
      aDay(1).slice(0, 10),
    ]);
    expect(chart?.series).toEqual(['issue', 'receipt']);
    expect(chart?.marks).toHaveLength(3);
    // A day nobody recorded anything on is not a category, and certainly not a
    // zero: filling it would draw a figure the platform never sent (8.1).
    expect(chart?.categories).not.toContain(aDay(2).slice(0, 10));
  });

  /**
   * The extremes are figures the answer returned, not the range a chart would
   * like to draw. With every value above zero, folding zero in would put a
   * figure on the axis that nobody measured (8.1) — the baseline is the
   * chart's own line, and the component draws it without calling it a value.
   */
  it('takes its extremes from the answer, never widening them to zero', () => {
    const charting = planCharts(
      tableOf(
        [
          { kind: 'receipt', net_quantity: '6' },
          { kind: 'transfer', net_quantity: '10' },
        ],
        ['net_quantity'],
        ['kind'],
      ),
    );

    expect(charting.drawn && charting.charts[0]?.extremes).toEqual({
      least: 6,
      greatest: 10,
    });
  });

  it('names a single series after the measure, so a legend can be left out', () => {
    const charting = planCharts(
      tableOf(
        [{ kind: 'receipt', net_quantity: '10' }],
        ['net_quantity'],
        ['kind'],
      ),
    );

    expect(charting.drawn && charting.charts[0]?.series).toEqual([
      'net_quantity',
    ]);
  });

  it('labels an entity category by its code', () => {
    const charting = planCharts(
      tableOf(
        [
          {
            product_code: 'W-1',
            product_name: 'the W-1 widget',
            on_hand_quantity: '6',
          },
        ],
        ['on_hand_quantity'],
        ['product'],
      ),
    );

    expect(charting.drawn && charting.charts[0]?.categories).toEqual(['W-1']);
  });

  it.each([
    [
      'no grouping at all',
      ['net_quantity'],
      [] as string[],
      [{ net_quantity: '10' }],
    ],
    [
      'two days',
      ['net_quantity'],
      ['recorded_day', 'occurred_day'],
      [{ recorded_day: aDay(0), occurred_day: aDay(0), net_quantity: '10' }],
    ],
    [
      'two groupings that are not days',
      ['net_quantity'],
      ['kind', 'product'],
      [
        {
          kind: 'receipt',
          product_code: 'W-1',
          product_name: 'the W-1 widget',
          net_quantity: '10',
        },
      ],
    ],
    [
      'three groupings',
      ['net_quantity'],
      ['recorded_day', 'kind', 'product'],
      [
        {
          recorded_day: aDay(0),
          kind: 'receipt',
          product_code: 'W-1',
          product_name: 'the W-1 widget',
          net_quantity: '10',
        },
      ],
    ],
  ])('does not draw %s', (_label, measures, groupings, rows) => {
    expect(planCharts(tableOf(rows, measures, groupings))).toEqual({
      drawn: false,
    });
  });

  /**
   * A row with nowhere to go and a row with nothing to show are the same
   * failure: the chart would be missing a row nobody could see was missing.
   */
  it('does not draw when a value is absent, of either kind', () => {
    expect(
      planCharts(
        tableOf(
          [
            { kind: 'receipt', net_quantity: '10' },
            { kind: 'issue', net_quantity: null },
          ],
          ['net_quantity'],
          ['kind'],
        ),
      ),
    ).toEqual({ drawn: false });

    expect(
      planCharts(
        tableOf(
          [
            { kind: 'receipt', net_quantity: '10' },
            { kind: null, net_quantity: '4' },
          ],
          ['net_quantity'],
          ['kind'],
        ),
      ),
    ).toEqual({ drawn: false });
  });

  it('does not draw when two rows would land in one place', () => {
    // Two rows whose labels differ only in the name: one code, one position,
    // and a chart that quietly showed one of them (3.7).
    expect(
      planCharts(
        tableOf(
          [
            {
              product_code: 'W-1',
              product_name: 'a widget',
              on_hand_quantity: '6',
            },
            {
              product_code: 'W-1',
              product_name: 'a widget, renamed',
              on_hand_quantity: '9',
            },
          ],
          ['on_hand_quantity'],
          ['product'],
        ),
      ),
    ).toEqual({ drawn: false });
  });

  it.each([
    [
      'more categories than stay legible',
      MOST_CATEGORIES + 1,
      (index: number) => ({ kind: `kind-${index}`, net_quantity: '1' }),
      ['kind'],
    ],
  ])('does not draw %s', (_label, count, rowAt, groupings) => {
    const rows = Array.from({ length: count }, (_unused, index) =>
      rowAt(index),
    );

    expect(planCharts(tableOf(rows, ['net_quantity'], groupings))).toEqual({
      drawn: false,
    });
  });

  it('does not draw more series than a person can tell apart', () => {
    const rows = Array.from({ length: MOST_SERIES + 1 }, (_unused, index) => ({
      recorded_day: aDay(0),
      kind: `kind-${index}`,
      net_quantity: '1',
    }));

    expect(
      planCharts(tableOf(rows, ['net_quantity'], ['recorded_day', 'kind'])),
    ).toEqual({ drawn: false });
  });

  it('does not draw more marks than fit in one chart', () => {
    // Sixty-seven days across six series: every bound but the marks one is
    // respected, so this is the bound that decides.
    const days = 67;
    const rows = Array.from({ length: MOST_MARKS + 1 }, (_unused, index) => ({
      recorded_day: aDay(index % days),
      kind: `kind-${Math.floor(index / days)}`,
      net_quantity: '1',
    }));

    expect(
      planCharts(tableOf(rows, ['net_quantity'], ['recorded_day', 'kind'])),
    ).toEqual({ drawn: false });
  });
});

/**
 * The invariant, over generated tables rather than examples.
 *
 * 3.7 is the requirement nobody looking at a chart can check: a chart that
 * dropped a row looks exactly like a chart of fewer rows. So it is asserted as
 * a property — every drawn plan places every row exactly once — over shapes
 * chosen to include the awkward ones: repeated labels, absent values, many
 * categories, several groupings.
 */
describe('every row, or no chart', () => {
  /** A deterministic generator: the same tables every run, and every machine. */
  function pseudoRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
  }

  it('places every row exactly once in every drawn chart', () => {
    const next = pseudoRandom(20_260_911);
    let drawnTables = 0;

    for (let attempt = 0; attempt < 300; attempt += 1) {
      const groupings = [
        ['kind'],
        ['product'],
        ['recorded_day'],
        ['recorded_day', 'kind'],
        ['kind', 'product'],
        ['recorded_day', 'kind', 'product'],
        [],
      ][Math.floor(next() * 7)];
      const measures =
        next() < 0.5 ? ['net_quantity'] : ['net_quantity', 'movement_count'];

      const rows = Array.from(
        { length: 1 + Math.floor(next() * 8) },
        (_unused, index) => {
          const row: Record<string, RowValue> = {};
          if (groupings.includes('recorded_day')) {
            row.recorded_day = aDay(Math.floor(next() * 3));
          }
          if (groupings.includes('kind')) {
            row.kind = next() < 0.1 ? null : `kind-${Math.floor(next() * 3)}`;
          }
          if (groupings.includes('product')) {
            row.product_code = `W-${Math.floor(next() * 3)}`;
            row.product_name = `widget ${index}`;
          }
          for (const measure of measures) {
            row[measure] =
              next() < 0.1 ? null : String(Math.floor(next() * 20) - 10);
          }
          return row;
        },
      );

      const reading = readAnswer(
        rows,
        composed(measures, groupings),
        vocabulary,
      );
      if (!reading.ok) continue;

      const charting = planCharts(reading.table);
      if (!charting.drawn) continue;
      drawnTables += 1;

      for (const chart of charting.charts) {
        expect(chart.marks).toHaveLength(reading.table.rows.length);
        expect(new Set(chart.marks.map((mark) => mark.row)).size).toBe(
          reading.table.rows.length,
        );
        for (const mark of chart.marks) {
          expect(chart.categories[mark.category]).toBeDefined();
          expect(chart.series[mark.series]).toBeDefined();
        }
      }
    }

    // A property that held over nothing would be no property at all.
    expect(drawnTables).toBeGreaterThan(20);
  });
});
