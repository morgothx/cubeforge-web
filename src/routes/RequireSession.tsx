import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../session/useSession';

/**
 * The gate, and its mirror.
 *
 * Both halves of "the address you were trying to reach is the address you
 * arrive at" live here on purpose. Sending somebody to the form is one
 * mechanism and bringing them back is another, and split across two files they
 * become two chances to lose the destination — the form would have to know
 * about destinations, which is not its subject.
 */

/** Where somebody is sent when they have no session. */
const FORM = '/sign-in';

/** Where somebody lands when nothing was interrupted. */
const DEFAULT_DESTINATION = '/';

interface Interrupted {
  readonly from?: unknown;
}

/**
 * The remembered address, if it is one.
 *
 * Router state is not attacker-controllable the way a query parameter is, but
 * "wherever this value says" is a sentence worth never writing: a value that
 * begins `//` is a different origin, and this is the one place that turns a
 * remembered string into a destination.
 */
function rememberedAddress(state: unknown): string | null {
  const from = (state as Interrupted | null)?.from;
  if (typeof from !== 'string') return null;
  return from.startsWith('/') && !from.startsWith('//') ? from : null;
}

/**
 * Renders its children only for somebody with a session.
 *
 * While the session is being restored it renders **nothing** — not a spinner,
 * not the form. A person about to be signed in must not watch a sign-in screen
 * appear and vanish (2.2), and at this point the application does not yet know
 * which of the two it owes them.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status.state === 'restoring') return null;

  if (status.state === 'signed-out') {
    return (
      <Navigate
        to={FORM}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}

/**
 * The mirror: renders the form only for somebody who still needs it.
 *
 * Once there is a session this sends them to whatever they were trying to
 * reach (2.6), or to the root if nothing was interrupted. It also covers the
 * person who pressed Back onto the form with a session in hand — showing it
 * would invite them to replace a session they already have.
 */
export function ReturnAfterSignIn({ children }: { children: ReactNode }) {
  const { status } = useSession();
  // Not destructured: the router types `state` as `any`, and a binding that
  // wide would let anything through the check below without a complaint.
  const remembered: unknown = useLocation().state;

  if (status.state === 'restoring') return null;

  if (status.state === 'signed-in') {
    return (
      <Navigate
        to={rememberedAddress(remembered) ?? DEFAULT_DESTINATION}
        replace
      />
    );
  }

  return <>{children}</>;
}
