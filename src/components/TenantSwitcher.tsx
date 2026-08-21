import { Link } from 'react-router';
import type { TenantMembership } from '../api/types';

/**
 * Which tenant the person is acting in, and how to act in another.
 *
 * Every membership is a row, and the row you are on is a statement rather than
 * a link back to itself (5.2) — it carries `aria-current`, which is the same
 * claim the accent fill makes to somebody who can see it. Somebody who can
 * reach exactly one tenant therefore sees the name and no destination at all,
 * which is what 5.1 asks for: there is nothing to ask about.
 *
 * The role travels with the name because it changes with it (5.3). A list of
 * bare tenant names would leave somebody to find out what they may do in each
 * by trying.
 */
export function TenantSwitcher({
  memberships,
  selected,
}: {
  memberships: readonly TenantMembership[];
  selected: TenantMembership;
}) {
  return (
    <nav className="panel-group" aria-label="Tenant">
      <h2 className="panel-label">Acting in</h2>
      <ul className="panel-list panel-list-tenants">
        {memberships.map((membership) => {
          const role = (
            <span className="panel-row-note">{membership.role}</span>
          );

          return (
            <li key={membership.tenantId}>
              {membership.tenantId === selected.tenantId ? (
                <span className="panel-row" aria-current="true">
                  {membership.tenantName}
                  {role}
                </span>
              ) : (
                <Link
                  className="panel-row"
                  to={`/t/${membership.tenantId}/members`}
                >
                  {membership.tenantName}
                  {role}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
