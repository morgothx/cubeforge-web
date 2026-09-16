import { formatDay } from '../../analytics/calendar';
import type {
  AnswerTable as Table,
  Cell,
  Column,
} from '../../analytics/reading';

/**
 * Every row the platform answered with, and nothing else.
 *
 * The table is always shown, whether or not a chart can be drawn beside it, so
 * it is the one place every row is certain to appear (3.5). Three rules shape
 * it, and all three are about not saying more than the answer does:
 *
 * - **A day is the platform's day.** The header names the calendar, because a
 *   date without one is read as the reader's own, and a person west of UTC
 *   would take the platform's 10th for their 9th (4.4).
 * - **An absent figure stays absent.** `null` is the platform saying there is
 *   no figure here; drawn as `0` it becomes one nobody measured (8.1).
 * - **No figure is added.** No total, no average, no difference — those are
 *   answers the platform was never asked for (8.1).
 */
export function AnswerTable({
  table,
  calendar,
}: {
  table: Table;
  calendar: string;
}) {
  const HEADER =
    'text-label font-normal uppercase tracking-[0.08em] opacity-55';

  return (
    <table className="table">
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th key={column.name} scope="col" className={HEADER}>
              {headingOf(column, calendar)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, at) => (
              <td key={table.columns[at]?.name ?? at}>{written(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A day column says which calendar its days are counted in. */
function headingOf(column: Column, calendar: string): string {
  return column.shape === 'day' ? `${column.name} (${calendar})` : column.name;
}

function written(cell: Cell) {
  switch (cell.kind) {
    case 'day':
      return cell.day === null ? <Absent /> : formatDay(cell.day);
    case 'category':
      return cell.text ?? <Absent />;
    case 'labelled':
      return cell.code === null ? (
        <Absent />
      ) : (
        <span>
          {cell.code}
          {cell.name !== null && (
            <span className="text-meta opacity-55"> · {cell.name}</span>
          )}
        </span>
      );
    case 'measure':
      return cell.value === null ? <Absent /> : String(cell.value);
  }
}

/**
 * An absence, said rather than drawn.
 *
 * A dash alone is a shape a screen reader announces as nothing at all, and a
 * blank cell reads as data that failed to arrive. Named, it says what it is.
 */
function Absent() {
  return (
    <span aria-label="no value" className="opacity-55">
      —
    </span>
  );
}
