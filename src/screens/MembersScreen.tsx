import { useParams } from 'react-router';
import { Waiting } from '../components/Waiting';
import { useMembers } from '../queries/members';
import type { Member } from '../api/types';

/**
 * Who is in this tenant.
 *
 * The delicate part is the address column. The backend **omits** a member's
 * address from a caller who may not see it rather than sending an empty one,
 * and that distinction is the whole of requirement 7.2: a column of blanks
 * reads as "these people have no address" or as data that failed to arrive,
 * while no column at all reads as "not for you". Only the second is true, so
 * the column exists or it does not — there is no in-between rendering.
 */
export function MembersScreen() {
  const { tenantId } = useParams();
  const { data: members, isPending } = useMembers(tenantId ?? '');

  // Not `members ?? []`: an empty listing rendered while the real one is on its
  // way says nobody is here, which is an answer somebody would act on (8.4).
  if (isPending) return <Waiting what="the members of this tenant" />;
  if (members === undefined) return null;

  if (members.length === 0) {
    return (
      <section>
        <h1>Members</h1>
        <p>This tenant has no members yet.</p>
      </section>
    );
  }

  /**
   * Whether the backend disclosed addresses at all.
   *
   * `every` rather than `some`, deliberately. The backend withholds all of them
   * or none, so the two agree in practice — and where they would not, `some`
   * produces exactly the blank cell this requirement is about. Showing none is
   * the reading that cannot produce one.
   */
  const addressesDisclosed = members.every(
    (member) => member.email !== undefined,
  );

  return (
    <section>
      <h1>Members</h1>
      <table>
        <thead>
          <tr>
            {addressesDisclosed && <th scope="col">Member</th>}
            <th scope="col">Role</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow
              key={member.membershipId}
              member={member}
              showAddress={addressesDisclosed}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MemberRow({
  member,
  showAddress,
}: {
  member: Member;
  showAddress: boolean;
}) {
  return (
    <tr>
      {showAddress && <td>{member.email}</td>}
      <td>{member.role}</td>
      {/* 7.1: a revoked membership is part of the answer, and says so. */}
      <td>{member.active ? 'Active' : 'Revoked'}</td>
    </tr>
  );
}
