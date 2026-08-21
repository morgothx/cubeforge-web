/**
 * That the application is waiting, said out loud.
 *
 * Requirement 8.4 exists because the alternative is not a blank screen but a
 * lie: a listing rendered before it arrives is an empty listing, and "nobody is
 * here" is an answer somebody acts on. `aria-busy` says the same thing to a
 * screen reader as the words do to everybody else.
 *
 * Dashed, and never solid: in this design a dashed hairline marks the absence
 * of data and a solid one marks a real object. Nothing here is an object yet.
 * The bars are a drawing of the rows that are coming, and they are hidden from
 * anybody listening — two grey rectangles announced as content would be two
 * more things that are not true yet.
 *
 * Kept apart from `Empty` as a matter of policy rather than of taste. One
 * component with a `loading` flag is one edit away from the two states sharing
 * a frame, and looking alike is the whole failure.
 */
export function Waiting({ what }: { what: string }) {
  return (
    <div
      className="flex flex-col gap-2 border border-dashed border-divider p-6"
      role="status"
      aria-busy="true"
    >
      <p className="font-heading text-kicker font-semibold uppercase tracking-[0.14em] opacity-55">
        Waiting
      </p>
      <span className="block h-[11px] w-[70%] bg-ghost" aria-hidden />
      <span className="block h-[11px] w-[52%] bg-ghost" aria-hidden />
      <p className="text-meta opacity-55">Loading {what}…</p>
    </div>
  );
}
