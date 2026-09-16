import { render, screen } from '@testing-library/react';
import { backend } from '../../../test/handlers';
import { planCharts, type ChartPlan } from '../../analytics/chart-plan';
import { checkComposition } from '../../analytics/composition';
import { readAnswer } from '../../analytics/reading';
import type { RowValue } from '../../api/types';
import { AnswerChart } from './AnswerChart';

const vocabulary = backend.analytics.vocabulary;

/**
 * A plan made the way the application makes one: read from rows in the
 * platform's forms, then planned. A hand-written plan would let the component
 * agree with a shape nothing produces.
 */
function planOf(
  rows: readonly Readonly<Record<string, RowValue>>[],
  measures: string[],
  groupings: string[],
): ChartPlan {
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

  const charting = planCharts(reading.table);
  if (!charting.drawn) throw new Error('expected a drawable answer');

  const [plan] = charting.charts;
  if (plan === undefined) throw new Error('expected a plan');
  return plan;
}

const SIGNED = [
  { kind: 'receipt', net_quantity: '10' },
  { kind: 'issue', net_quantity: '-4' },
];

/**
 * Every number a reader can see on the chart itself, axis labels included.
 *
 * `Array.from` rather than a spread: this application's `lib` does not include
 * `DOM.Iterable`, so a `NodeList` is not iterable to the type checker, and the
 * spread degrades every element to `any`.
 */
function numbersWritten(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('text'))
    .map((text) => Number(text.textContent?.trim()))
    .filter((value) => Number.isFinite(value));
}

describe('a plan drawn as bars', () => {
  it('draws one mark per row, each naming the row it draws', () => {
    const plan = planOf(SIGNED, ['net_quantity'], ['kind']);
    const { container } = render(<AnswerChart plan={plan} />);

    const marks = container.querySelectorAll('[data-row]');

    // 3.7 as the component's own contract: the plan decided every row can be
    // drawn, and the drawing is what keeps that promise.
    expect(marks).toHaveLength(plan.marks.length);
    expect(
      Array.from(marks)
        .map((mark) => mark.getAttribute('data-row'))
        .sort(),
    ).toEqual(plan.marks.map((mark) => String(mark.row)).sort());
  });

  it('says what each mark is, in words, for anybody hovering or listening', () => {
    const plan = planOf(SIGNED, ['net_quantity'], ['kind']);
    const { container } = render(<AnswerChart plan={plan} />);

    const titles = Array.from(container.querySelectorAll('title')).map(
      (title) => title.textContent,
    );

    expect(titles).toContain('issue · net_quantity: -4');
    expect(titles).toContain('receipt · net_quantity: 10');
  });

  /**
   * A signed measure is the reason the baseline exists: a bar for -4 drawn
   * upward from the bottom reads as a quantity of four that arrived, which is
   * the opposite of what happened.
   */
  it('hangs a negative value below the zero baseline, and a positive above it', () => {
    const plan = planOf(SIGNED, ['net_quantity'], ['kind']);
    const { container } = render(<AnswerChart plan={plan} />);

    const baseline = container.querySelector('[data-baseline]');
    const zero = Number(baseline?.getAttribute('y1'));
    const rectAt = (row: number) =>
      container.querySelector(`[data-row="${row}"]`);

    const negative = rectAt(plan.marks.findIndex((mark) => mark.value < 0));
    const positive = rectAt(plan.marks.findIndex((mark) => mark.value > 0));

    // SVG's y grows downward: below the baseline is a larger y.
    expect(Number(negative?.getAttribute('y'))).toBeGreaterThanOrEqual(zero);
    expect(Number(positive?.getAttribute('y'))).toBeLessThanOrEqual(zero);
  });

  /**
   * 8.1: the axis carries figures the answer returned, and zero, which is the
   * line the bars stand on rather than a measurement. A "nice" axis that
   * rounded 10 up to 12 would put a number on screen that nothing answered.
   */
  it('writes no number the answer did not return', () => {
    const plan = planOf(SIGNED, ['net_quantity'], ['kind']);
    const { container } = render(<AnswerChart plan={plan} />);

    const allowed = new Set([plan.extremes.least, plan.extremes.greatest, 0]);
    for (const written of numbersWritten(container)) {
      expect(allowed).toContain(written);
    }
    // And the extremes really are written: an axis with no labels would pass
    // the rule above by saying nothing at all.
    expect(numbersWritten(container)).toEqual(
      expect.arrayContaining([plan.extremes.least, plan.extremes.greatest]),
    );
  });

  it('names the measure it draws, for anybody who cannot see it', () => {
    const plan = planOf(SIGNED, ['net_quantity'], ['kind']);
    render(<AnswerChart plan={plan} />);

    expect(
      screen.getByRole('img', { name: /net_quantity/ }),
    ).toBeInTheDocument();
  });

  /**
   * A year of days is a legitimate plan, and a phone is 360 points wide. The
   * chart scrolls inside its own container rather than squeezing marks until
   * they overlap — squeezed, two rows would share a pixel, which is the merge
   * 3.7 forbids arriving by another route.
   */
  it('scrolls sideways rather than squeezing its marks together', () => {
    const many = Array.from({ length: 40 }, (_unused, index) => ({
      kind: `kind-${index}`,
      net_quantity: String(index + 1),
    }));
    const plan = planOf(many, ['net_quantity'], ['kind']);
    const { container } = render(<AnswerChart plan={plan} />);

    const scroller = container.querySelector('.overflow-x-auto');
    expect(scroller).not.toBeNull();
    expect(scroller?.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('[data-row]')).toHaveLength(40);
  });
});
