import { useParams, useSearchParams } from 'react-router';
import {
  addressOf,
  checkComposition,
  draftFromAddress,
} from '../analytics/composition';
import type { Vocabulary } from '../api/types';
import { AnalyticsNav } from '../components/analytics/AnalyticsNav';
import { AnswerView } from '../components/analytics/AnswerView';
import { Composer } from '../components/analytics/Composer';
import { RefusalNotice } from '../components/RefusalNotice';
import { Waiting } from '../components/Waiting';
import { useQuestionHold, useVocabulary } from '../queries/analytics';

/**
 * A question of the person's own: a composer and an address in front of the
 * same machinery the overview uses.
 *
 * **The address is the composition** (3.8). Asking is the one moment a draft
 * becomes a question, and it *pushes* a new address — so the back button
 * returns to the previous composition, and an address opened fresh asks
 * exactly what it says. Nothing about the question is kept in this component,
 * which is why reloading loses nothing.
 *
 * **A composition the platform cannot be asked is reported, not repaired**
 * (3.9). The draft is read from the address exactly as written, wrong parts
 * included, and the `Composer` says every problem — it is checking the same
 * draft against the same vocabulary. The answer view is rendered only for a
 * composition that can be asked, so nothing asks, and one voice says what is
 * wrong rather than two saying it in chorus.
 */
export function AnalyticsExplorerScreen() {
  const { tenantId = '' } = useParams();
  const vocabulary = useVocabulary(tenantId);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-screen">Explore</h1>
      <AnalyticsNav tenantId={tenantId} />
      {vocabulary.isError ? (
        <RefusalNotice
          refusal={vocabulary.error.refusal}
          onRetry={() => void vocabulary.refetch()}
        />
      ) : vocabulary.data === undefined ? (
        <Waiting what="the analytics" />
      ) : (
        <Explorer tenantId={tenantId} vocabulary={vocabulary.data} />
      )}
    </section>
  );
}

function Explorer({
  tenantId,
  vocabulary,
}: {
  tenantId: string;
  vocabulary: Vocabulary;
}) {
  const [address, setAddress] = useSearchParams();
  const heldSeconds = useQuestionHold();

  const draft = draftFromAddress(address, vocabulary, new Date());
  const checked = checkComposition(draft, vocabulary);

  return (
    <>
      <Composer
        // Keyed on the address, so arriving at another composition — the back
        // button, or a link — starts the draft from what is being served
        // rather than from what was last typed.
        key={address.toString()}
        vocabulary={vocabulary}
        initial={draft}
        held={heldSeconds}
        onAsk={(composition) => {
          setAddress(addressOf(composition));
        }}
      />

      {checked.ok && (
        <AnswerView
          title="this question"
          tenantId={tenantId}
          vocabulary={vocabulary}
          checked={checked}
        />
      )}
    </>
  );
}
