import { createContext, useContext } from 'react';

/**
 * What the application is allowed to know about the session, and the hook that
 * reads it.
 *
 * Separate from the provider because a module that exports a component may
 * export nothing else without breaking fast refresh, and because everything
 * here is what the *consumers* import — the provider is mounted once.
 */

export type SessionStatus =
  /**
   * A stored credential is being exchanged. Its own state, not a variety of
   * signed-out: a person about to be signed in must not watch a sign-in form
   * appear and vanish (2.2).
   */
  | { readonly state: 'restoring' }
  | { readonly state: 'signed-out' }
  | { readonly state: 'signed-in' };

export interface SessionContextValue {
  readonly status: SessionStatus;
  /**
   * Properties rather than methods, and not only for lint's sake: these are
   * closures a screen destructures and hands to a form, never called through
   * the object they arrived in.
   */
  readonly signIn: (credentials: {
    email: string;
    password: string;
  }) => Promise<void>;
  /** Never rejects. Signing out is not allowed to fail — see the provider. */
  readonly signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    // A default value would let a screen render signed-out forever and look
    // like a routing problem. Failing here names the actual mistake.
    throw new Error('useSession was called outside a SessionProvider');
  }
  return value;
}
