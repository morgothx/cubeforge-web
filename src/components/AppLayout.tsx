import type { ReactNode } from 'react';
import { useStanding } from '../queries/standing';

/**
 * The frame every signed-in page sits in.
 *
 * It asks who the caller is and says nothing until it knows. A frame that
 * rendered its slots empty while waiting would show a person with no address
 * and no tenants, which is a different claim from "not yet" — and the one the
 * person would act on.
 *
 * The tenant switcher, the navigation and signing out arrive in tasks 5.2 and
 * 6.1; what is here is the identity, which everything else hangs beside.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { data: standing } = useStanding();

  return (
    <>
      {standing !== undefined && (
        <header>
          <p>{standing.email}</p>
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
            <p>Platform operator</p>
          )}
        </header>
      )}
      <main>{children}</main>
    </>
  );
}
