import { render, screen, within } from '@testing-library/react';
import { backend } from '../../../test/handlers';
import { checkComposition } from '../../analytics/composition';
import { readAnswer, type AnswerTable as Table } from '../../analytics/reading';
import type { RowValue } from '../../api/types';
import { AnswerTable } from './AnswerTable';

const vocabulary = backend.analytics.vocabulary;

/**
 * A table read the way a real answer is read, so the component meets the
 * cells the platform's own forms produce rather than ones a test invented.
 */
function tableOf(
  rows: readonly Readonly<Record<string, RowValue>>[],
  measures: string[],
  groupings: string[],
): Table {
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

  const reading = readAnswer(rows, checked.composition, vocabulary);
  if (!reading.ok) throw new Error('expected a readable answer');
  return reading.table;
}

describe('an answer as a table', () => {
  it('shows one row per row the platform answered with', () => {
    render(
      <AnswerTable
        table={tableOf(
          [
            { kind: 'receipt', net_quantity: '10' },
            { kind: 'issue', net_quantity: '-4' },
          ],
          ['net_quantity'],
          ['kind'],
        )}
        calendar="UTC"
      />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(3); // a header and two rows
    expect(screen.getByRole('cell', { name: '-4' })).toBeInTheDocument();
  });

  /**
   * 4.4: a day is the platform's day, in the platform's calendar. A person in
   * Bogotá reading "9 Sep" for a row the platform counted on the 10th has been
   * told something false, and the only place to say which calendar it is, is
   * the header.
   */
  it('names the calendar in the header of a day column', () => {
    render(
      <AnswerTable
        table={tableOf(
          [{ recorded_day: '2026-09-08T00:00:00.000', net_quantity: '10' }],
          ['net_quantity'],
          ['recorded_day'],
        )}
        calendar="UTC"
      />,
    );

    const header = screen.getByRole('columnheader', { name: /recorded_day/ });
    expect(header).toHaveTextContent('UTC');
    // And the day itself as a date a person reads, not the engine's timestamp.
    expect(
      screen.getByRole('cell', { name: /8 Sept? 2026/ }),
    ).toBeInTheDocument();
  });

  it('labels a product by its code and its current name', () => {
    render(
      <AnswerTable
        table={tableOf(
          [
            {
              product_code: 'W-1',
              product_name: 'the W-1 widget',
              on_hand_quantity: '6',
            },
          ],
          ['on_hand_quantity'],
          ['product'],
        )}
        calendar="UTC"
      />,
    );

    const cell = screen.getByRole('cell', { name: /W-1/ });
    expect(cell).toHaveTextContent('W-1');
    expect(cell).toHaveTextContent('the W-1 widget');
  });

  /**
   * 8.1: `null` is the platform saying there is no figure. Rendered as `0` it
   * becomes a figure nobody returned, and one that reads as a real measurement
   * — the worst of the two mistakes available here.
   */
  it('shows an absent figure as an absence, named, and never as zero', () => {
    render(
      <AnswerTable
        table={tableOf(
          [
            {
              product_code: 'W-1',
              product_name: 'the W-1 widget',
              net_quantity: null,
              on_hand_quantity: '6',
            },
          ],
          ['net_quantity', 'on_hand_quantity'],
          ['product'],
        )}
        calendar="UTC"
      />,
    );

    const row = screen.getAllByRole('row')[1];
    if (row === undefined) throw new Error('expected a row');
    expect(within(row).getByLabelText(/no value/i)).toBeInTheDocument();
    expect(row).not.toHaveTextContent(/\b0\b/);
  });

  it('adds no figure of its own — no total, no average', () => {
    render(
      <AnswerTable
        table={tableOf(
          [
            { kind: 'receipt', net_quantity: '10' },
            { kind: 'issue', net_quantity: '-4' },
          ],
          ['net_quantity'],
          ['kind'],
        )}
        calendar="UTC"
      />,
    );

    expect(screen.queryByText(/total|average|sum\b/i)).toBeNull();
    // 6 is what a total would say, and nothing answered it.
    expect(screen.queryByRole('cell', { name: '6' })).toBeNull();
  });
});
