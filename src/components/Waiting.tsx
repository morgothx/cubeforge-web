/**
 * That the application is waiting, said out loud.
 *
 * Requirement 8.4 exists because the alternative is not a blank screen but a
 * lie: a listing rendered before it arrives is an empty listing, and "nobody is
 * here" is an answer somebody acts on. `aria-busy` says the same thing to a
 * screen reader as the words do to everybody else.
 */
export function Waiting({ what }: { what: string }) {
  return <p aria-busy="true">Loading {what}…</p>;
}
