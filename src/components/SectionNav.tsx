import { BarChart3, Users } from 'lucide-react';
import { NavLink } from 'react-router';
import { may } from '../access/permissions';
import type { Role } from '../api/types';

/**
 * What there is to look at inside the tenant being acted in.
 *
 * Rendered only where a tenant is selected, because that is what the list is a
 * list of: "in this tenant" over nothing is a heading for a promise the frame
 * cannot keep.
 *
 * `NavLink` is what marks the current row rather than a comparison written here
 * — the router already knows which address is being served, and a second answer
 * to that question is a second thing to keep in step.
 *
 * Analytics is a link wherever the role may read it (dashboard-analytics 1.1),
 * and **not an exact match**: the explorer lives inside the section, and a
 * panel that stopped marking Analytics there would tell the person they had
 * left it. Members stays exact because nothing lives beneath it.
 *
 * Until that feature this row was a `<span>` marked "Soon" — named rather than
 * hidden, and pressable by nobody. The shell's design records its 10.3 as
 * superseded rather than rewriting the requirement it implemented.
 */
const ROW = 'flex items-center justify-between gap-2 px-3 py-2 text-control';

function rowClass({ isActive }: { isActive: boolean }): string {
  return `${ROW} ${
    isActive ? 'bg-steel-100 text-steel-700' : 'hover:bg-base-content/7'
  }`;
}

export function SectionNav({
  tenantId,
  role,
}: {
  tenantId: string;
  role: Role;
}) {
  return (
    <nav className="flex flex-col gap-2" aria-label="Sections">
      <h2 className="font-heading text-kicker font-semibold uppercase tracking-[0.14em] opacity-55">
        In this tenant
      </h2>
      <ul className="flex flex-col gap-1">
        <li>
          <NavLink to={`/t/${tenantId}/members`} end className={rowClass}>
            <span className="flex items-center gap-2">
              <Users size={15} strokeWidth={1.5} aria-hidden />
              Members
            </span>
          </NavLink>
        </li>
        {may(role, 'analytics:read') && (
          <li>
            <NavLink to={`/t/${tenantId}/analytics`} className={rowClass}>
              <span className="flex items-center gap-2">
                <BarChart3 size={15} strokeWidth={1.5} aria-hidden />
                Analytics
              </span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
