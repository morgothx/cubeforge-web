import { Info, RefreshCw } from 'lucide-react';
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
 * identifier (8.5).
 *
 * **Two shapes, one component.** A refusal that named a cause is about
 * something the person did and can fix, so it is tinted and sits against the
 * field the backend blamed. Everything else is about the platform rather than
 * about them, so it is neutral and sits above the block it concerns. Two
 * components would be two vocabularies that agree until one is edited.
 *
 * **A retry is offered for exactly one outcome.** A service that could not be
 * reached is worth asking again, and nothing else here is: a refusal that named
 * a cause gives the same answer to the same input, and a throttled caller is
 * locked out for 900 seconds — so a button beside that copy could not succeed
 * for a quarter of an hour, and somebody who pressed it and was refused
 * identically would conclude the product is broken. The button's presence is
 * itself the distinction requirement 8.3 asks for.
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
  const named = refusal.kind === 'rejected';

  return (
    <div
      role="alert"
      id={id}
      className={
        named
          ? // A cause the backend named: about something the person did and can
            // fix. The tint is what makes it read as attached to the field
            // above it rather than as a statement about the screen.
            'flex items-center gap-2 bg-steel-100 px-3 py-2 text-meta text-steel-800'
          : // Everything else is about the platform rather than about them:
            // hairline, no fill, claiming no more attention than the block it
            // sits above. Never red — the design says state in words.
            'flex items-center gap-2 border border-divider px-3 py-2 text-meta'
      }
    >
      {named && (
        <Info size={15} strokeWidth={1.5} className="shrink-0" aria-hidden />
      )}
      <span>{describeRefusal(refusal)}</span>
      {refusal.kind === 'unreachable' && onRetry !== undefined && (
        <button
          type="button"
          className="btn btn-hairline btn-sm ml-auto"
          onClick={onRetry}
        >
          <RefreshCw size={15} strokeWidth={1.5} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
