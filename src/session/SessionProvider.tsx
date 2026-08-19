import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import { ApiError } from '../api/refusal';
import { session } from '../api/session';
import {
  SessionContext,
  type SessionContextValue,
  type SessionStatus,
} from './useSession';

/**
 * The one place that decides whether there is a session, and the only one that
 * ends it deliberately.
 *
 * Below this, `session.ts` holds the credential and `request` renews it; above
 * it, screens ask which of three states applies. What this adds is the two
 * transitions nothing else can make: exchanging a stored refresh token on
 * start-up, and taking a session apart on the way out.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  /**
   * Decided while rendering rather than in an effect. An initial `signed-out`
   * corrected a moment later is exactly the flash requirement 2.2 forbids, and
   * whether anything was stored is knowable synchronously.
   */
  const [status, setStatus] = useState<SessionStatus>(() =>
    session.refreshToken() === null
      ? { state: 'signed-out' }
      : { state: 'restoring' },
  );

  /**
   * Restoring happens once per page, not once per effect.
   *
   * StrictMode runs effects twice in development, and the backend invalidates
   * a whole refresh-token family when a used token is presented — so a second
   * exchange would end the very session the first one restored. In a browser
   * the two invocations arrive back to back, before the first exchange has
   * answered, so the state below has not moved yet and only this ref stands
   * between them.
   *
   * **No test in this suite can see it.** jsdom interleaves the two the other
   * way round, and there the state check catches the second one unaided — so
   * removing this line fails nothing. It is kept because the ordering it
   * guards against is the one a browser actually produces, and it is written
   * down here rather than pretended to be covered.
   */
  const restored = useRef(false);

  useEffect(() => {
    if (status.state !== 'restoring' || restored.current) return;
    restored.current = true;

    const stored = session.refreshToken();
    if (stored === null) {
      setStatus({ state: 'signed-out' });
      return;
    }

    void endpoints.refresh(stored).then(
      (renewed) => {
        session.adopt(renewed);
        setStatus({ state: 'signed-in' });
      },
      (error: unknown) => {
        // A backend that could not be reached has said nothing about this
        // credential, so keep it: throwing it away would cost a password for a
        // dropped connection, and the next reload restores. Anything else is
        // the backend declining to exchange it, which is 2.3.
        const unanswered =
          error instanceof ApiError && error.refusal.kind === 'unreachable';
        if (!unanswered) {
          session.end();
        }
        setStatus({ state: 'signed-out' });
      },
    );
  }, [status.state]);

  const signIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      session.adopt(await endpoints.signIn(credentials));
      // Whatever the previous session left behind is not this person's to see,
      // and a session can end without anyone signing out (4.4).
      queryClient.clear();
      setStatus({ state: 'signed-in' });
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const stored = session.refreshToken();
    try {
      if (stored !== null) {
        await endpoints.signOut(stored);
      }
    } catch {
      // Signing out cannot fail. Leaving somebody signed in because the network
      // dropped is the one outcome this must never produce — and the backend
      // answers a sign-out for an unknown token successfully anyway, so there
      // is nothing here worth reporting.
    }
    session.end();
    queryClient.clear();
    setStatus({ state: 'signed-out' });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, signIn, signOut }),
    [status, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
