import { Corners } from './Corners';

/**
 * An answer that was nothing — and the news that it *is* an answer.
 *
 * Deliberately not the same component as `Waiting`, and deliberately not the
 * same frame: this one is solid where waiting is dashed, because in this design
 * a dashed hairline marks the absence of data and a solid one marks a real
 * object. An empty listing is a real object. Requirement 8.4 is the reason the
 * two may never be merged behind a flag — "nobody is here yet" and "not here
 * yet" are different pieces of news, and only one of them is a reason to invite
 * somebody.
 *
 * The kicker says "Answered, and empty" in as many words, because that is the
 * one thing a person cannot tell by looking at a blank.
 */
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-2 border border-divider p-6">
      <Corners />
      <p className="font-heading text-kicker font-semibold uppercase tracking-[0.14em] opacity-55">
        Answered, and empty
      </p>
      <p className="font-heading text-block font-semibold">{title}</p>
      {children !== undefined && (
        <p className="text-meta opacity-55">{children}</p>
      )}
    </div>
  );
}
