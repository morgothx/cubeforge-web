import { formatMoment } from '../../analytics/calendar';
import { describeProvenance } from '../../analytics/wording';

/**
 * How current an answer is, and where it came from.
 *
 * **The moment belongs to the figure** (4.1). An answer shown without its date
 * is read with more confidence than it has earned: these numbers are as current
 * as the last export, which can be hours old, and nothing else on screen says
 * so. It is truncated to the minute and never rounded up (4.2) — later than the
 * platform said is the one direction this may never err in.
 *
 * **Provenance is available and quieter** (4.3). Whether the platform answered
 * from what it prepared or by reading the exported objects is a fact about the
 * platform rather than about the inventory, and a person reading a figure
 * should meet it after the date rather than beside it. Smaller, muted, after —
 * and never a heading.
 */
export function AnswerCurrency({
  completeThrough,
  servedFrom,
  calendar,
}: {
  completeThrough: string;
  servedFrom: 'prepared' | 'exported-objects';
  calendar: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-meta">
        Complete through {formatMoment(completeThrough, calendar)}
      </p>
      <p className="text-label opacity-55">{describeProvenance(servedFrom)}</p>
    </div>
  );
}
