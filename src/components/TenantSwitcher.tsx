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
 *
 * `selected` is optional because an address can name no tenant at all — one
 * that does not exist, most often. Nothing is current then and every tenant is
 * a destination, which is accurate: the panel is the way out of a wrong turn,
 * and a frame with no navigation in it is what makes a mistyped address feel
 * like a wall.
 *
 * The rows share edges — `border-t-0` on every one after the first — so the
 * stack reads as one object rather than as separate buttons.
 */
const ROW =
  'flex items-center justify-between gap-2 px-3 py-2 text-control border border-divider [li+li_&]:border-t-0';

export function TenantSwitcher({
  memberships,
  selected,
}: {
  memberships: readonly TenantMembership[];
  selected?: TenantMembership | undefined;
}) {
  return (
    <nav className="flex flex-col gap-2" aria-label="Tenant">
      <h2 className="font-heading text-kicker font-semibold uppercase tracking-[0.14em] opacity-55">
        Acting in
      </h2>
      <ul className="flex flex-col">
        {memberships.map((membership) => {
          const current = membership.tenantId === selected?.tenantId;

          return (
            <li key={membership.tenantId}>
              {current ? (
                // The loudest thing in the panel, deliberately: which tenant
                // you are acting in is the fact every other thing on the
                // screen depends on.
                <span
                  aria-current="true"
                  className={`${ROW} bg-primary text-primary-content border-primary`}
                >
                  {membership.tenantName}
                  <span className="text-label opacity-80">
                    {membership.role}
                  </span>
                </span>
              ) : (
                <Link
                  to={`/t/${membership.tenantId}/members`}
                  className={`${ROW} hover:bg-base-content/7`}
                >
                  {membership.tenantName}
                  <span className="text-label opacity-55">
                    {membership.role}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
