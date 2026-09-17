import { useState } from 'react';
import {
  checkComposition,
  type Composition,
  type Draft,
} from '../../analytics/composition';
import { describeProblem } from '../../analytics/wording';
import type { Vocabulary } from '../../api/types';
import { RefusalNotice } from '../RefusalNotice';

/**
 * Where a person composes a question of their own.
 *
 * **Everything on offer comes from the vocabulary** (3.2). No measure, grouping
 * or moment is written here: the platform publishes what it answers, and this
 * renders that list in the platform's order and by its names. A platform that
 * offered something else would be followed without a line changing.
 *
 * **The draft is checked as it changes**, by the same function that checks an
 * address and the overview's fixed questions, and every problem is shown at
 * once (3.3, 3.4). Asking is disabled while any of them stands — and while the
 * platform has said to wait, because a question sent then would only be refused
 * again and spend another of the ten a minute (7.3).
 *
 * The wait is rendered through `RefusalNotice`, the one place in this
 * application that turns a refusal into words.
 */
export function Composer({
  vocabulary,
  initial,
  held,
  onAsk,
}: {
  vocabulary: Vocabulary;
  initial: Draft;
  held: number;
  onAsk: (composition: Composition) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);

  const checked = checkComposition(draft, vocabulary);
  const problems = checked.ok ? [] : checked.problems;
  const waiting = held > 0;

  const toggle = (
    chosen: readonly string[],
    name: string,
  ): readonly string[] =>
    chosen.includes(name)
      ? chosen.filter((each) => each !== name)
      : [...chosen, name];

  return (
    <div className="relative flex flex-col gap-4 border border-divider p-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label opacity-55">Measures</legend>
        <div className="flex flex-wrap gap-4">
          {vocabulary.measures.map(({ name }) => (
            <label key={name} className="flex items-center gap-2 text-control">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                value={name}
                checked={draft.measures.includes(name)}
                onChange={() => {
                  setDraft({
                    ...draft,
                    measures: toggle(draft.measures, name),
                  });
                }}
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label opacity-55">Groupings</legend>
        <div className="flex flex-wrap gap-4">
          {vocabulary.groupings.map(({ name }) => (
            <label key={name} className="flex items-center gap-2 text-control">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                value={name}
                checked={draft.groupings.includes(name)}
                onChange={() => {
                  setDraft({
                    ...draft,
                    groupings: toggle(draft.groupings, name),
                  });
                }}
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label opacity-55">Read by</legend>
        <div className="flex flex-wrap gap-4">
          {vocabulary.readBy.map((moment) => (
            <label
              key={moment}
              className="flex items-center gap-2 text-control"
            >
              <input
                type="radio"
                className="radio radio-sm"
                name="by"
                value={moment}
                checked={draft.by === moment}
                onChange={() => {
                  setDraft({ ...draft, by: moment });
                }}
              />
              {moment}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex w-[150px] flex-col gap-1">
          <label htmlFor="composed-from" className="text-label opacity-55">
            From
          </label>
          <input
            id="composed-from"
            className="input w-full"
            value={draft.from}
            onChange={(event) => {
              setDraft({ ...draft, from: event.target.value });
            }}
          />
        </div>

        <div className="flex w-[150px] flex-col gap-1">
          <label htmlFor="composed-to" className="text-label opacity-55">
            To
          </label>
          <input
            id="composed-to"
            className="input w-full"
            value={draft.to}
            onChange={(event) => {
              setDraft({ ...draft, to: event.target.value });
            }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary px-6"
          disabled={!checked.ok || waiting}
          onClick={() => {
            if (checked.ok && !waiting) onAsk(checked.composition);
          }}
        >
          Ask
        </button>
      </div>

      {problems.length > 0 && (
        <ul className="text-meta">
          {problems.map((problem) => (
            <li key={problem.kind}>{describeProblem(problem)}</li>
          ))}
        </ul>
      )}

      {waiting && (
        <RefusalNotice
          refusal={{ kind: 'throttled', retryAfterSeconds: held }}
        />
      )}
    </div>
  );
}
