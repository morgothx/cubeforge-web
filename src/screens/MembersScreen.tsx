import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { may } from '../access/permissions';
import { fieldBlamed } from '../api/refusal';
import { RefusalNotice } from '../components/RefusalNotice';
import { Waiting } from '../components/Waiting';
import {
  useChangeMemberRole,
  useInviteMember,
  useMembers,
  useRevokeMembership,
} from '../queries/members';
import { useStanding } from '../queries/standing';
import { nameOf } from './member-identity';
import { ROLES, type Member, type Role } from '../api/types';

/**
 * Who is in this tenant, and what an administrator may change about that.
 *
 * The delicate part of the listing is the Member column. The backend **omits**
 * a member's address from a caller who may not see it rather than sending an
 * empty one, and that distinction is the whole of requirement 7.2: a column of
 * blanks reads as "these people have no address" or as data that failed to
 * arrive. The column itself is not the problem, though — the blank is. So it
 * always exists and always says something (`member-identity.ts`), because
 * "which row is this" is a question the listing owes an answer to either way.
 *
 * The delicate part of the actions is that they are **absent** rather than
 * disabled for a role that may not use them (7.4). A disabled control still
 * says the action exists and that you are the problem — and hiding it is a
 * convenience, never the reason it is safe: the backend refuses it either way,
 * and a role can change between drawing a control and pressing it.
 */
export function MembersScreen() {
  const { tenantId = '' } = useParams();
  const { data: members, isPending } = useMembers(tenantId);
  const { data: standing } = useStanding();

  const role = standing?.memberships.find(
    (membership) => membership.tenantId === tenantId,
  )?.role;

  return (
    <section>
      <h1>Members</h1>
      {role !== undefined && may(role, 'members:invite') && (
        <InviteForm tenantId={tenantId} />
      )}
      {isPending ? (
        // Not `members ?? []`: an empty listing rendered while the real one is
        // on its way says nobody is here, which is an answer somebody would act
        // on (8.4).
        <Waiting what="the members of this tenant" />
      ) : (
        <Listing
          tenantId={tenantId}
          members={members ?? []}
          role={role}
          callerPersonId={standing?.personId}
        />
      )}
    </section>
  );
}

function Listing({
  tenantId,
  members,
  role,
  callerPersonId,
}: {
  tenantId: string;
  members: readonly Member[];
  role: Role | undefined;
  callerPersonId: string | undefined;
}) {
  if (members.length === 0) {
    return <p>This tenant has no members yet.</p>;
  }

  const mayChangeRole = role !== undefined && may(role, 'members:change-role');
  const mayRevoke = role !== undefined && may(role, 'members:revoke');

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Member</th>
          <th scope="col" className="column-role">
            Role
          </th>
          <th scope="col" className="column-status">
            Status
          </th>
          {/*
            7.4: a role that may use neither action is offered no column at
            all, rather than a column of nothing. A header over empty cells
            says an action exists and is being withheld from you.
          */}
          {(mayChangeRole || mayRevoke) && (
            <th scope="col" className="column-change">
              Change
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <MemberRow
            key={member.membershipId}
            tenantId={tenantId}
            member={member}
            isCaller={member.personId === callerPersonId}
            mayChangeRole={mayChangeRole}
            mayRevoke={mayRevoke}
          />
        ))}
      </tbody>
    </table>
  );
}

function MemberRow({
  tenantId,
  member,
  isCaller,
  mayChangeRole,
  mayRevoke,
}: {
  tenantId: string;
  member: Member;
  isCaller: boolean;
  mayChangeRole: boolean;
  mayRevoke: boolean;
}) {
  const changeRole = useChangeMemberRole(tenantId);
  const revoke = useRevokeMembership(tenantId);
  const who = nameOf(member);

  /**
   * Whichever of the two was refused, with the way to ask again.
   *
   * Both actions on a row report through one notice: two notices in one cell
   * would be two places to look for the same kind of news.
   */
  const refused =
    changeRole.error !== null
      ? {
          error: changeRole.error,
          again: () => {
            changeRole.reset();
          },
        }
      : revoke.error !== null
        ? {
            error: revoke.error,
            again: () => {
              revoke.mutate({ membershipId: member.membershipId });
            },
          }
        : undefined;

  return (
    <tr className={member.active ? undefined : 'row-revoked'}>
      <td>
        {who}
        {isCaller && <span className="row-you"> · you</span>}
      </td>
      {/*
        The role a person holds, and — for a caller who may change it — the
        control that changes it, in the cell that states it. A select in the
        Change column beside the revoking would have made one column mean "the
        two things you may do" and left the Role column stating a value twice.
      */}
      <td>
        {mayChangeRole ? (
          <select
            className="input"
            aria-label={`Role of ${who}`}
            value={member.role}
            /*
             * Disabled for a revoked membership — a fact about the row, not
             * about the caller. It says what the role was and that it cannot
             * be changed; removing it would leave the row a different shape
             * from every other one for no reason a reader could see.
             */
            disabled={changeRole.isPending || !member.active}
            onChange={(event) => {
              changeRole.mutate({
                membershipId: member.membershipId,
                role: event.target.value as Role,
              });
            }}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        ) : (
          member.role
        )}
      </td>
      {/* 7.1: a revoked membership is part of the answer, and says so. */}
      <td>
        <span className={member.active ? 'tag tag-accent' : 'tag tag-neutral'}>
          {member.active ? 'Active' : 'Revoked'}
        </span>
      </td>
      {(mayChangeRole || mayRevoke) && (
        <td>
          {/*
            Absent rather than disabled once the membership is already revoked:
            the action has no meaning, and a greyed control still says it
            exists and that you are the one being refused. Same distinction as
            7.4, applied to an object instead of to a person.
          */}
          {mayRevoke && member.active && (
            <button
              type="button"
              className="btn btn-secondary"
              /*
               * Named for the person in the accessible name and not on the
               * face of the button. The column is one word wide, and a control
               * that reads "Revoke" in a row is unambiguous to somebody who
               * can see the row — while somebody hearing the controls one
               * after another gets four buttons called "Revoke" unless the
               * name says which.
               */
              aria-label={`Revoke ${who}`}
              disabled={revoke.isPending}
              onClick={() => {
                revoke.mutate({ membershipId: member.membershipId });
              }}
            >
              Revoke
            </button>
          )}
          {(changeRole.isPending || revoke.isPending) && <span>Changing…</span>}
          {refused !== undefined && (
            <RefusalNotice
              refusal={refused.error.refusal}
              onRetry={() => {
                refused.again();
              }}
            />
          )}
        </td>
      )}
    </tr>
  );
}

function InviteForm({ tenantId }: { tenantId: string }) {
  const invite = useInviteMember(tenantId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');

  const refusal = invite.error?.refusal;
  // Beside the input the backend blamed, rather than at the top where "that
  // person is already a member" is a sentence about nothing in particular.
  const blamed = fieldBlamed(refusal);

  function send(event: FormEvent) {
    event.preventDefault();
    // Guarded here rather than only on the button: a disabled button still
    // leaves the form submittable from the keyboard, and a second invitation
    // comes back refused as an existing member — which reads as the person's
    // mistake rather than as ours (7.8).
    if (invite.isPending || email.trim() === '') return;
    // Cleared on success rather than on submit. A rejected invitation — an
    // address that is already a member, most often — should not cost the
    // person what they typed, and clearing it here would also mask the guard
    // above: with the field empty, a second submission returns early for the
    // wrong reason.
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          setEmail('');
        },
      },
    );
  }

  return (
    <form aria-label="Invite a member" onSubmit={send}>
      <label htmlFor="invite-email">Invite by email address</label>
      <input
        id="invite-email"
        type="email"
        value={email}
        aria-describedby={
          blamed === 'email' ? 'invite-email-refused' : undefined
        }
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      {blamed === 'email' && refusal !== undefined && (
        <RefusalNotice refusal={refusal} id="invite-email-refused" />
      )}

      <label htmlFor="invite-role">Role for the new member</label>
      <select
        id="invite-role"
        value={role}
        onChange={(event) => {
          setRole(event.target.value as Role);
        }}
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <button type="submit" disabled={invite.isPending}>
        Invite
      </button>
      {invite.isPending && <p>Inviting…</p>}
      {refusal !== undefined && blamed === null && (
        <RefusalNotice
          refusal={refusal}
          onRetry={() => {
            invite.mutate({ email, role });
          }}
        />
      )}
    </form>
  );
}
