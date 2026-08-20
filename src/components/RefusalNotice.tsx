import { describeRefusal, type Refusal } from '../api/refusal';

/**
 * The one place a refusal becomes words.
 *
 * Not a convenience: four screens each writing their own version of "that did
 * not work" would be four voices agreeing by coincidence, and the coincidence
 * ends the first time one of them is edited. A test scans the source and
 * requires that only this component calls `describeRefusal`.
 *
 * What it renders is prose and nothing else — never a status, a body, or an
 * identifier (8.5). A retry is offered for exactly one outcome: a service that
 * could not be reached is worth asking again, and a refusal is not, so the
 * button's presence is itself the distinction requirement 8.3 asks for.
 */
export function RefusalNotice({
  refusal,
  onRetry,
  id,
}: {
  refusal: Refusal;
  onRetry?: () => void;
  id?: string;
}) {
  return (
    <p role="alert" id={id}>
      {describeRefusal(refusal)}
      {refusal.kind === 'unreachable' && onRetry !== undefined && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </p>
  );
}
