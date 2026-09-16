import type { ChartPlan } from '../../analytics/chart-plan';

/**
 * One plan, drawn as bars on a zero baseline.
 *
 * The plan already decided that every row can be drawn whole (3.7); this draws
 * it, and adds nothing. Three rules keep that true:
 *
 * - **One mark per row, and the mark says which row.** A chart missing a row
 *   looks exactly like a chart of fewer rows, so the drawing carries the row
 *   number a test can count.
 * - **A zero baseline, with negatives below it.** Net quantity is signed. A
 *   bar for −4 drawn upward from the bottom reads as four that arrived, which
 *   is the opposite of what happened.
 * - **No figure the answer did not return** (8.1). The value axis carries the
 *   plan's extremes and zero — the line the bars stand on — and nothing
 *   rounded, nicened or interpolated. Days with no rows are not drawn at all,
 *   because the plan does not carry them.
 *
 * The table beside it is the accessible reading of the same answer; this is
 * one image with a name, and every bar says what it is on hover and to a
 * screen reader.
 */

/** Room for the value labels, in the same units as the drawing. */
const GUTTER = 48;
const PADDING = 12;
const HEIGHT = 160;
const BAR = 14;
const BETWEEN_BARS = 3;
const BETWEEN_CATEGORIES = 14;
const LABELS = 22;

export function AnswerChart({ plan }: { plan: ChartPlan }) {
  const seriesCount = Math.max(plan.series.length, 1);
  const categoryWidth =
    seriesCount * BAR + (seriesCount - 1) * BETWEEN_BARS + BETWEEN_CATEGORIES;
  const width = GUTTER + plan.categories.length * categoryWidth + PADDING;
  const height = HEIGHT + LABELS;

  const top = Math.max(plan.extremes.greatest, 0);
  const bottom = Math.min(plan.extremes.least, 0);
  // A single value equal to zero would otherwise divide by nothing.
  const span = top - bottom === 0 ? 1 : top - bottom;
  const y = (value: number) =>
    PADDING + ((top - value) / span) * (HEIGHT - PADDING * 2);
  const baseline = y(0);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${plan.measure}, one bar per row`}
      >
        <line
          data-baseline
          x1={GUTTER - 6}
          x2={width - PADDING}
          y1={baseline}
          y2={baseline}
          className="stroke-divider"
        />

        <text
          x={0}
          y={y(top) + 4}
          className="fill-current text-label opacity-55"
        >
          {plan.extremes.greatest}
        </text>
        <text
          x={0}
          y={y(bottom) + 4}
          className="fill-current text-label opacity-55"
        >
          {plan.extremes.least}
        </text>

        {plan.marks.map((mark) => {
          const x =
            GUTTER +
            mark.category * categoryWidth +
            mark.series * (BAR + BETWEEN_BARS);
          const value = y(mark.value);

          return (
            <rect
              key={mark.row}
              data-row={mark.row}
              x={x}
              y={Math.min(value, baseline)}
              width={BAR}
              // A value too small to see is still a value: never nothing.
              height={Math.max(Math.abs(value - baseline), 1)}
              className="fill-primary"
              opacity={weightOf(mark.series)}
            >
              <title>
                {`${plan.categories[mark.category] ?? ''} · ${
                  plan.series[mark.series] ?? ''
                }: ${mark.value}`}
              </title>
            </rect>
          );
        })}

        {plan.categories.map((category, at) => (
          <text
            key={category}
            x={GUTTER + at * categoryWidth}
            y={HEIGHT + 14}
            className="fill-current text-label opacity-55"
          >
            {category}
          </text>
        ))}
      </svg>
    </div>
  );
}

/**
 * Series told apart by weight rather than by hue.
 *
 * The palette is one accent in this design, and six hues invented here would
 * be six colours nobody chose — and two of them would collide in one of the
 * two themes. Weight survives both.
 */
function weightOf(series: number): number {
  return [1, 0.7, 0.52, 0.38, 0.28, 0.2][series] ?? 0.2;
}
