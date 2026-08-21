import { BarChart3, Users } from 'lucide-react';
import { NavLink } from 'react-router';

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
 * Analytics is the product's whole point and it does not exist yet, so it is
 * named and marked rather than hidden. A panel that stayed silent would let
 * somebody read this as a members list and stop; a row that could be pressed
 * would promise a room that is not built. Naming the room and saying it is not
 * built is only honest while pressing it does nothing at all — which is why it
 * is a `<span>`, why it carries no hover tint of its own, and why three tests
 * hold it to that.
 */
const ROW = 'flex items-center justify-between gap-2 px-3 py-2 text-control';

export function SectionNav({ tenantId }: { tenantId: string }) {
  return (
    <nav className="flex flex-col gap-2" aria-label="Sections">
      <h2 className="font-heading text-kicker font-semibold uppercase tracking-[0.14em] opacity-55">
        In this tenant
      </h2>
      <ul className="flex flex-col gap-1">
        <li>
          <NavLink
            to={`/t/${tenantId}/members`}
            end
            className={({ isActive }) =>
              `${ROW} ${
                isActive
                  ? 'bg-steel-100 text-steel-700'
                  : 'hover:bg-base-content/7'
              }`
            }
          >
            <span className="flex items-center gap-2">
              <Users size={15} strokeWidth={1.5} aria-hidden />
              Members
            </span>
          </NavLink>
        </li>
        <li>
          <span className={`${ROW} opacity-55`}>
            <span className="flex items-center gap-2">
              <BarChart3 size={15} strokeWidth={1.5} aria-hidden />
              Analytics
            </span>
            <span className="badge badge-neutral badge-sm text-kicker uppercase tracking-[0.09em]">
              Soon
            </span>
          </span>
        </li>
      </ul>
    </nav>
  );
}
