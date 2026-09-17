/**
 * The same place, in another tenant (1.2).
 *
 * `/t/acme/analytics/explore?…` → `/t/globex/analytics/explore?…`
 *
 * Nothing in a section or a composition belongs to a tenant, so both travel.
 * What belongs to the tenant is the answer, and that is asked again under the
 * new tenant's key by the screen that lands here — never carried across.
 *
 * Only the first tenant segment is replaced. An address naming no tenant, or a
 * tenant and no section, has nothing to keep: it lands on the members listing,
 * where arriving in a tenant lands everywhere else, and a query written for no
 * section is dropped rather than attached to one it was never about.
 */
const IN_A_TENANT = /^\/t\/[^/]+(\/[^/].*)$/;

const LANDING = 'members';

export function sameSectionIn(
  tenantId: string,
  pathname: string,
  search: string,
): string {
  const section = IN_A_TENANT.exec(pathname)?.[1];

  if (section === undefined) return `/t/${tenantId}/${LANDING}`;

  return `/t/${tenantId}${section}${search}`;
}
