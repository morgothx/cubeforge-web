import { Link, Outlet } from 'react-router';
import { useStanding } from '../queries/standing';
import { useSelectedTenant } from './last-tenant';

/**
 * Resolves the tenant named in the address against the tenants the caller can
 * actually reach.
 *
 * The interesting case is the one that is not an error. A membership can be
 * revoked while somebody has the page open, or between two sessions with the
 * address bookmarked, and the honest answer is that the selection they had is
 * gone — not that something failed. So the notice says what happened and offers
 * the tenants that remain, which is the only thing they can act on (5.5).
 */
export function TenantRoute() {
  const { data: standing } = useStanding();
  const tenantId = useSelectedTenant();

  // Nothing is known yet. A notice rendered now would tell everybody their
  // tenant was gone on every page load, and be accidentally right for a
  // fraction of a second (8.4).
  if (standing === undefined) return null;

  const reachable = standing.memberships.some(
    (membership) => membership.tenantId === tenantId,
  );
  if (reachable) return <Outlet />;

  return (
    <section aria-labelledby="tenant-gone">
      <h1 id="tenant-gone">That tenant is no longer available to you</h1>
      <p>
        You may have been removed from it, or it may have been closed. These are
        the tenants you can reach:
      </p>
      <ul>
        {standing.memberships.map((membership) => (
          <li key={membership.tenantId}>
            <Link to={`/t/${membership.tenantId}/members`}>
              {membership.tenantName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
