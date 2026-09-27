import { NavLink } from 'react-router';

/**
 * The two ways to look at a tenant's analytics.
 *
 * Both entries carry the tenant, because which tenant is the fact every answer
 * on either screen depends on. Neither carries a composition or a period: those
 * belong to the screen a person is on, and dragging the explorer's question
 * into the overview would answer something nobody asked.
 *
 * Both are exact matches, unlike the section row in the shell's panel. That row
 * marks the whole section, so it stays current in the explorer; these two say
 * *which of the two* is being served, and marking both would tell the person
 * they are in two places at once.
 */
const ROW = 'px-3 py-2 text-control';

function rowClass({ isActive }: { isActive: boolean }): string {
  return `${ROW} ${
    isActive ? 'bg-steel-100 text-steel-700' : 'hover:bg-base-content/7'
  }`;
}

export function AnalyticsNav({ tenantId }: { tenantId: string }) {
  return (
    <nav
      className="flex gap-1 border border-divider p-1"
      aria-label="Analytics views"
    >
      <NavLink to={`/t/${tenantId}/analytics`} end className={rowClass}>
        Overview
      </NavLink>
      <NavLink to={`/t/${tenantId}/analytics/explore`} end className={rowClass}>
        Explore
      </NavLink>
    </nav>
  );
}
