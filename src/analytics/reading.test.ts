import { backend } from '../../test/handlers';
import type { RowValue } from '../api/types';
import { checkComposition, type Composition } from './composition';
import { readAnswer } from './reading';

const vocabulary = backend.analytics.vocabulary;

function composed(measures: string[], groupings: string[] = []): Composition {
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

type Row = Readonly<Record<string, RowValue>>;

describe('reading an answer', () => {
  it('lays out groupings first, then measures, saying which counts from before the period', () => {
    const reading = readAnswer(
      [],
      composed(
        ['net_quantity', 'on_hand_quantity'],
        ['recorded_day', 'product'],
      ),
      vocabulary,
    );

    expect(reading.ok && reading.table.columns).toEqual([
      {
        name: 'recorded_day',
        role: 'grouping',
        shape: 'day',
        cumulative: false,
      },
      {
        name: 'product',
        role: 'grouping',
        shape: 'labelled',
        cumulative: false,
      },
      {
        name: 'net_quantity',
        role: 'measure',
        shape: 'measure',
        cumulative: false,
      },
      {
        name: 'on_hand_quantity',
        role: 'measure',
        shape: 'measure',
        cumulative: true,
      },
    ]);
  });

  it('reads the forms the platform sends', () => {
    const reading = readAnswer(
      [
        {
          recorded_day: '2026-09-08T00:00:00.000',
          kind: 'receipt',
          product_code: 'W-1',
          product_name: 'the W-1 widget',
          net_quantity: '6',
        },
      ],
      composed(['net_quantity'], ['recorded_day', 'kind', 'product']),
      vocabulary,
    );

    expect(reading.ok && reading.table.rows).toEqual([
      [
        { kind: 'day', day: '2026-09-08' },
        { kind: 'category', text: 'receipt' },
        { kind: 'labelled', code: 'W-1', name: 'the W-1 widget' },
        { kind: 'measure', value: 6 },
      ],
    ]);
  });

  it('reads a measure that arrived as a number, and a signed one', () => {
    const reading = readAnswer(
      [
        { kind: 'issue', net_quantity: -4 },
        { kind: 'receipt', net_quantity: '-4.5' },
      ],
      composed(['net_quantity'], ['kind']),
      vocabulary,
    );

    expect(reading.ok && reading.table.rows.map((row) => row[1])).toEqual([
      { kind: 'measure', value: -4 },
      { kind: 'measure', value: -4.5 },
    ]);
  });

  /**
   * `null` is the platform saying there is no figure — a product that moved
   * only before the period has no net quantity in it. Kept as an absence all
   * the way to the screen, because rendering it as `0` is a figure nobody
   * returned (8.1).
   */
  it('keeps an absent figure absent', () => {
    const reading = readAnswer(
      [{ product_code: 'W-1', product_name: null, net_quantity: null }],
      composed(['net_quantity'], ['product']),
      vocabulary,
    );

    expect(reading.ok && reading.table.rows[0]).toEqual([
      { kind: 'labelled', code: 'W-1', name: null },
      { kind: 'measure', value: null },
    ]);
  });

  /**
   * The unreadable answer is the one this module exists for. `Number('')` is
   * `0`, `Number('six')` is `NaN`, and either on a chart is a figure the
   * platform never sent. Refusing the whole answer is the only honest reading
   * of a value that cannot be read.
   */
  it.each<[string, RowValue | object]>([
    ['an empty string', ''],
    ['a word', 'six'],
    ['an object', {}],
    ['a number in scientific notation', '1e3'],
    ['a value that is not finite', 'Infinity'],
  ])(
    'refuses an answer whose measure is %s, rather than calling it zero',
    (_label, value) => {
      const rows = [
        { kind: 'receipt', net_quantity: value },
      ] as unknown as Row[];

      expect(
        readAnswer(rows, composed(['net_quantity'], ['kind']), vocabulary),
      ).toEqual({
        ok: false,
      });
    },
  );

  it('refuses an answer whose day is not a day', () => {
    expect(
      readAnswer(
        [{ recorded_day: 'yesterday', net_quantity: '1' }],
        composed(['net_quantity'], ['recorded_day']),
        vocabulary,
      ),
    ).toEqual({ ok: false });
  });

  it('refuses an answer missing a column the question implies', () => {
    // A product row with a code and no name key at all. Absent is not null:
    // null is the platform saying "no value"; a missing key is an answer that
    // does not match the question it answers.
    expect(
      readAnswer(
        [{ product_code: 'W-1', net_quantity: '1' }],
        composed(['net_quantity'], ['product']),
        vocabulary,
      ),
    ).toEqual({ ok: false });
  });

  it('orders rows by their groupings — days first, then labels — and alters none', () => {
    const reading = readAnswer(
      [
        {
          recorded_day: '2026-09-09T00:00:00.000',
          kind: 'receipt',
          net_quantity: '6',
        },
        {
          recorded_day: '2026-09-08T00:00:00.000',
          kind: 'receipt',
          net_quantity: '10',
        },
        {
          recorded_day: '2026-09-08T00:00:00.000',
          kind: 'issue',
          net_quantity: '-4',
        },
      ],
      composed(['net_quantity'], ['recorded_day', 'kind']),
      vocabulary,
    );

    expect(
      reading.ok &&
        reading.table.rows.map((row) =>
          row.map((cell) =>
            cell.kind === 'day'
              ? cell.day
              : cell.kind === 'category'
                ? cell.text
                : cell.kind === 'measure'
                  ? cell.value
                  : null,
          ),
        ),
    ).toEqual([
      ['2026-09-08', 'issue', -4],
      ['2026-09-08', 'receipt', 10],
      ['2026-09-09', 'receipt', 6],
    ]);
  });
});
