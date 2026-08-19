import { Link } from 'react-router';
import type { TenantMembership } from '../api/types';

/**
 * Which tenant the person is acting in, and how to act in another.
 *
 * The current one is always named (5.2) and is never offered as a destination —
 * going where you already are is not a choice. Somebody who can reach exactly
 * one tenant therefore sees the name and no control at all, which is what 5.1
 * asks for: there is nothing to ask about.
 */
export function TenantSwitcher({
  memberships,
  selected,
}: {
  memberships: readonly TenantMembership[];
  selected: TenantMembership;
}) {
  const others = memberships.filter(
    (membership) => membership.tenantId !== selected.tenantId,
  );

  return (
    <nav aria-label="Tenant">
      <p>
        Acting in {selected.tenantName} as {selected.role}
      </p>
      {others.length > 0 && (
        <ul>
          {others.map((membership) => (
            <li key={membership.tenantId}>
              <Link to={`/t/${membership.tenantId}/members`}>
                {membership.tenantName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
