import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStanding } from '../queries/standing';
import { useSelectedTenant } from '../routes/last-tenant';
import { useSession } from '../session/useSession';
import { Brand } from './Brand';
import { SectionNav } from './SectionNav';
import { TenantSwitcher } from './TenantSwitcher';

/**
 * The frame every signed-in page sits in: a side panel and the column it
 * frames.
 *
 * The panel is the shape of the product rather than decoration around it. The
 * tenants are the first-level navigation because in a multi-tenant application
 * *which tenant* is the fact everything else on the screen depends on; the
 * sections are what exists inside the one you are in. A top header said neither
 * — which is exactly what somebody looking at the old screen could not tell.
 *
 * It asks who the caller is and says nothing until it knows. A frame that
 * rendered its slots empty while waiting would show a person with no address
 * and no tenants, which is a different claim from "not yet" — and the one the
 * person would act on.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { data: standing } = useStanding();
  const { signOut } = useSession();
  const tenantId = useSelectedTenant();

  /**
   * The membership the address names, if it names one this caller holds. An
   * address naming a tenant they cannot reach resolves to nothing here and is
   * answered by the route (5.5, task 5.3) rather than by a switcher that
   * quietly picks somebody else's tenant.
   */
  const selected = standing?.memberships.find(
    (membership) => membership.tenantId === tenantId,
  );

  return (
    <div className="shell">
      {standing !== undefined && (
        <header className="panel">
          <Brand />
          {selected !== undefined && (
            <TenantSwitcher
              memberships={standing.memberships}
              selected={selected}
            />
          )}
          {selected !== undefined && (
            <SectionNav tenantId={selected.tenantId} />
          )}
          <div className="panel-identity">
            <span className="panel-identity-address">{standing.email}</span>
            {standing.isOperator && (
              /**
               * A fact, and deliberately nothing else.
               *
               * This repository has no operator screens (10.1), so a badge that
               * became a link would invite somebody to a destination that does
               * not exist. Requirement 6.4 asks for the fact to be shown and for
               * the navigation not to change on account of it; a test compares
               * the destinations offered here with and without it and requires
               * the same set.
               */
              <span className="tag tag-outline">Platform operator</span>
            )}
            {/*
              Offered from the frame rather than from any screen. Requirement 4.3
              asks for it where somebody belongs nowhere, but belonging nowhere is
              not what makes it available — being signed in is, and a person who
              reaches nothing must not be left in a room with no door.
            */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut size={15} strokeWidth={1.5} aria-hidden />
              Sign out
            </button>
          </div>
        </header>
      )}
      <main className="shell-content">{children}</main>
    </div>
  );
}
