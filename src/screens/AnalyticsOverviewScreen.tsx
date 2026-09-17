import { useParams, useSearchParams } from 'react-router';
import { checkComposition, defaultPeriod } from '../analytics/composition';
import {
  MOVEMENTS,
  ON_HAND,
  type FixedComposition,
} from '../analytics/overview';
import type { Vocabulary } from '../api/types';
import { AnswerView } from '../components/analytics/AnswerView';
import { PeriodPicker } from '../components/analytics/PeriodPicker';
import { RefusalNotice } from '../components/RefusalNotice';
import { Waiting } from '../components/Waiting';
import { useVocabulary } from '../queries/analytics';

/**
 * A tenant's analytics as they open: two answers nobody had to ask for (2.1).
 *
 * **The period lives in the address**, not in this component. An address with
 * no period covers the thirty days ending today in the platform's calendar
 * (2.5); a chosen period is written into it (2.6), so reloading, sharing or
 * going back shows the same overview. The screen holds no state of its own
 * that a person could lose.
 *
 * **Asking is the answer query's business.** Each composition is one query key,
 * so re-rendering, refocusing and re-choosing the period on screen ask nothing,
 * and leaving discards both answers so that coming back is a new showing (2.7).
 * Nothing here decides when to ask.
 *
 * The two fixed compositions go through the same check as anything a person
 * composes. A period that is wrong in the address is reported by each view,
 * and neither is asked.
 */
export function AnalyticsOverviewScreen() {
  const { tenantId = '' } = useParams();
  const vocabulary = useVocabulary(tenantId);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-screen">Analytics</h1>
      {vocabulary.isError ? (
        <RefusalNotice
          refusal={vocabulary.error.refusal}
          onRetry={() => void vocabulary.refetch()}
        />
      ) : vocabulary.data === undefined ? (
        <Waiting what="the analytics" />
      ) : (
        <Overview tenantId={tenantId} vocabulary={vocabulary.data} />
      )}
    </section>
  );
}

function Overview({
  tenantId,
  vocabulary,
}: {
  tenantId: string;
  vocabulary: Vocabulary;
}) {
  const [address, setAddress] = useSearchParams();

  const standing = defaultPeriod(vocabulary, new Date());
  const from = address.get('from') ?? standing.from;
  const to = address.get('to') ?? standing.to;

  const checkedWith = (fixed: FixedComposition) =>
    checkComposition({ ...fixed, from, to }, vocabulary);

  return (
    <>
      <PeriodPicker
        // Keyed on the period, so an address changed from outside — the back
        // button — resets the fields to what is actually shown.
        key={`${from}/${to}`}
        vocabulary={vocabulary}
        initial={{ from, to }}
        onChoose={(period) => {
          setAddress({ from: period.from, to: period.to });
        }}
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-block">On hand</h2>
        <AnswerView
          title="On hand"
          tenantId={tenantId}
          vocabulary={vocabulary}
          checked={checkedWith(ON_HAND)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-block">Movements</h2>
        <AnswerView
          title="Movements"
          tenantId={tenantId}
          vocabulary={vocabulary}
          checked={checkedWith(MOVEMENTS)}
        />
      </div>
    </>
  );
}
