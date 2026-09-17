import { planCharts } from '../../analytics/chart-plan';
import type { Checked } from '../../analytics/composition';
import { readAnswer } from '../../analytics/reading';
import {
  cumulativeNote,
  describeProblem,
  neverExported,
  nothingRecorded,
  unreadableAnswer,
} from '../../analytics/wording';
import type { Vocabulary } from '../../api/types';
import { useAnswer, useQuestionHold } from '../../queries/analytics';
import { Empty } from '../Empty';
import { RefusalNotice } from '../RefusalNotice';
import { Waiting } from '../Waiting';
import { AnswerChart } from './AnswerChart';
import { AnswerCurrency } from './AnswerCurrency';
import { AnswerTable } from './AnswerTable';

/**
 * One composition, asked and rendered in every state it can reach.
 *
 * The states are exclusive and ordered deliberately, because several of them
 * could otherwise be true at once and the wrong one would win:
 *
 * 1. **Problems** come first and ask nothing — an unaskable composition has no
 *    answer to wait for.
 * 2. **A hold** comes next, for the same reason: the platform has said to wait,
 *    and a question sent now would be refused and spend another of the ten a
 *    minute it allows (7.3).
 * 3. **A refusal** before waiting, because a failed query is not pending.
 * 4. **Never exported** before anything is read: a tenant whose data has never
 *    arrived has no rows to read and no axis to draw, and a frame around
 *    nothing reads as a quiet period — a claim about their stock that nobody
 *    made (5.3, 5.4).
 * 5. **Unreadable** before empty, because an answer whose figures could not be
 *    read is a fault of this dashboard, and calling it "nothing was recorded"
 *    would publish that fault as a fact about the tenant.
 *
 * The retry is handed to `RefusalNotice` unconditionally; that component shows
 * the button for `unreachable` alone, which is the one outcome where asking
 * again could succeed. Deciding it here would be a second opinion on the same
 * question.
 */
export function AnswerView({
  title,
  tenantId,
  vocabulary,
  checked,
}: {
  title: string;
  tenantId: string;
  vocabulary: Vocabulary;
  checked: Checked;
}) {
  const composition = checked.ok ? checked.composition : null;
  const answer = useAnswer(tenantId, composition);
  const secondsHeld = useQuestionHold();

  if (!checked.ok) {
    return (
      <ul className="text-meta">
        {checked.problems.map((problem) => (
          <li key={problem.kind}>{describeProblem(problem)}</li>
        ))}
      </ul>
    );
  }

  if (secondsHeld > 0) {
    return (
      <RefusalNotice
        refusal={{ kind: 'throttled', retryAfterSeconds: secondsHeld }}
      />
    );
  }

  if (answer.isError) {
    return (
      <RefusalNotice
        refusal={answer.error.refusal}
        onRetry={() => void answer.refetch()}
      />
    );
  }

  if (answer.data === undefined) {
    return <Waiting what={title} />;
  }

  if (answer.data.state === 'never-exported') {
    // Not `Empty`: that component announces "Answered, and empty", which is the
    // quiet period this state is not.
    return (
      <div className="flex flex-col gap-2 border border-divider p-6">
        <p className="text-meta">{neverExported()}</p>
      </div>
    );
  }

  const { completeThrough, servedFrom, rows } = answer.data;
  const currency = (
    <AnswerCurrency
      completeThrough={completeThrough}
      servedFrom={servedFrom}
      calendar={vocabulary.calendar}
    />
  );

  const reading = readAnswer(rows, checked.composition, vocabulary);
  if (!reading.ok) {
    return (
      <div className="flex flex-col gap-2 border border-divider p-6">
        <p className="text-meta">{unreadableAnswer()}</p>
      </div>
    );
  }

  const notes = checked.composition.measures.filter((name) =>
    vocabulary.measures.some(
      (measure) => measure.name === name && measure.cumulative,
    ),
  );

  if (reading.table.rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Empty title={title}>
          {nothingRecorded(
            checked.composition.from,
            checked.composition.to,
            completeThrough,
            vocabulary.calendar,
          )}
        </Empty>
        {currency}
      </div>
    );
  }

  const charting = planCharts(reading.table);

  return (
    <div className="flex flex-col gap-4">
      <AnswerTable table={reading.table} calendar={vocabulary.calendar} />
      {charting.drawn &&
        charting.charts.map((plan) => (
          <AnswerChart key={plan.measure} plan={plan} />
        ))}
      {currency}
      {notes.map((measure) => (
        <p key={measure} className="text-meta opacity-55">
          {cumulativeNote(measure)}
        </p>
      ))}
    </div>
  );
}
