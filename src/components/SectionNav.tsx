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
 * is a `<span>` and why three tests hold it to that.
 */
export function SectionNav({ tenantId }: { tenantId: string }) {
  return (
    <nav className="panel-group" aria-label="Sections">
      <h2 className="panel-label">In this tenant</h2>
      <ul className="panel-list panel-list-sections">
        <li>
          <NavLink className="panel-row" to={`/t/${tenantId}/members`} end>
            <span className="panel-row-name">
              <Users size={15} strokeWidth={1.5} aria-hidden />
              Members
            </span>
          </NavLink>
        </li>
        <li>
          <span className="panel-row panel-row-inert">
            <span className="panel-row-name">
              <BarChart3 size={15} strokeWidth={1.5} aria-hidden />
              Analytics
            </span>
            <span className="tag tag-neutral panel-row-soon">Soon</span>
          </span>
        </li>
      </ul>
    </nav>
  );
}
