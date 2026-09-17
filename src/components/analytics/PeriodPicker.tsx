import { useState } from 'react';
import type { Day } from '../../analytics/calendar';
import { checkComposition } from '../../analytics/composition';
import { describeProblem } from '../../analytics/wording';
import type { Vocabulary } from '../../api/types';

/**
 * The two days an overview covers (2.6).
 *
 * Checked by **the same function a composed question is checked with**, so a
 * period refused in the explorer is refused here, said the same way and with
 * the same limit — the platform's, as the vocabulary stated it. Two checks
 * would be two answers to one question, and the looser one would win
 * somewhere.
 *
 * Days are typed as the platform writes them, `YYYY-MM-DD`, which is also what
 * the refusal says when one is not a date. A native date control would hide
 * that shape and hand back a local day, which is the one thing a day here must
 * never be.
 */
export function PeriodPicker({
  vocabulary,
  initial,
  onChoose,
}: {
  vocabulary: Vocabulary;
  initial: { from: string; to: string };
  onChoose: (period: { from: Day; to: Day }) => void;
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  // The period alone is under test here, so the draft carries a measure the
  // platform offers rather than one written down: whatever the vocabulary
  // lists first is enough to leave the period as the only thing that can be
  // wrong.
  const checked = checkComposition(
    {
      measures: vocabulary.measures.slice(0, 1).map(({ name }) => name),
      groupings: [],
      from,
      to,
      by: vocabulary.readBy[0] ?? '',
    },
    vocabulary,
  );
  const problems = checked.ok ? [] : checked.problems;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex w-[150px] flex-col gap-1">
        <label htmlFor="period-from" className="text-label opacity-55">
          From
        </label>
        <input
          id="period-from"
          className="input w-full"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
          }}
        />
      </div>

      <div className="flex w-[150px] flex-col gap-1">
        <label htmlFor="period-to" className="text-label opacity-55">
          To
        </label>
        <input
          id="period-to"
          className="input w-full"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
          }}
        />
      </div>

      <button
        type="button"
        className="btn btn-primary px-6"
        disabled={!checked.ok}
        onClick={() => {
          if (checked.ok) {
            onChoose({
              from: checked.composition.from,
              to: checked.composition.to,
            });
          }
        }}
      >
        Show
      </button>

      {problems.length > 0 && (
        <ul className="w-full text-meta">
          {problems.map((problem) => (
            <li key={problem.kind}>{describeProblem(problem)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
