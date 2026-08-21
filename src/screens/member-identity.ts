import type { Member } from '../api/types';

/**
 * What to call a member on screen.
 *
 * The backend **omits** an address from a caller who may not see it rather than
 * sending an empty one, and requirement 7.2 was originally read as "then show
 * no address column at all". That reading was protecting the right thing — *a
 * blank reads as missing data* — by the crudest available means, and it cost
 * the listing the one column that tells the rows apart. `person_8c41f2` is not
 * a blank: it names the row without disclosing anything, so the rule becomes
 * the one 7.2 was always about — **never an empty cell where a name would be.**
 *
 * Decided per row rather than for the listing as a whole. The backend
 * discloses all or none, so the two agree in practice; where they would not,
 * the per-row reading is the one that cannot produce a blank.
 */
export function nameOf(member: Pick<Member, 'email' | 'personId'>): string {
  return member.email ?? `person_${digest(member.personId)}`;
}

/**
 * Six stable hex characters from a person's id.
 *
 * Hashed rather than sliced. The id's own characters carry its shape — a
 * seeded fixture reads as `person_caller`, and a real id would surrender its
 * prefix — while a hash is the same width for every id and spells nothing.
 *
 * This is legibility, not secrecy: the id is already in the payload the browser
 * received, and anybody who wants it can read it there. What the identifier
 * buys is a person being able to say "the second one" and mean something.
 *
 * FNV-1a, because it is four lines and deterministic. Six hex digits can
 * collide; in a listing of a tenant's members that is remote enough to accept,
 * and the alternative — a longer identifier nobody can hold in their head —
 * costs more than the case it guards.
 */
function digest(personId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < personId.length; index += 1) {
    hash ^= personId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(-6);
}
