import type { Session } from './types';

/**
 * Where the credential lives, and why the two halves live differently.
 *
 * The access token is held in memory and the refresh token is written down, so
 * a reload can recover the session without the shorter-lived credential ever
 * existing outside the tab that used it. The expiry the backend also returns is
 * kept nowhere: renewing reactively when a request is refused is correct even
 * when the clock is wrong, and a stored value nobody reads is a value somebody
 * will eventually trust by mistake.
 *
 * **The stored refresh token is readable by any script that gets into the
 * page.** That is accepted rather than solved. A static application served from
 * S3 cannot be handed an `httpOnly` cookie by an API on another origin, and the
 * alternative — signing a person out on every reload — was weighed and
 * rejected. What bounds the damage is the backend: refresh tokens rotate, and
 * presenting a used one invalidates the whole family, so a stolen token is
 * worth having only until the real session next renews.
 */

/** Exported so a test can assert against the real key rather than guess it. */
export const REFRESH_STORAGE_KEY = 'cubeforge.refresh';

export interface SessionState {
  accessToken(): string | null;
  refreshToken(): string | null;
  adopt(session: Session): void;
  end(): void;
}

function readStoredRefreshToken(): string | null {
  // A cleared browser, a half-finished write, or somebody else's bug. None of
  // them is a session, and none of them should be a crash on the first paint.
  const stored = localStorage.getItem(REFRESH_STORAGE_KEY);
  return stored !== null && stored.length > 0 ? stored : null;
}

/**
 * A module value rather than React state, deliberately.
 *
 * The request layer needs whichever token is current *now*. A token read
 * through a closure is one render stale, and the render it would be stale
 * during is precisely the renewal this whole design is built around — the
 * moment a request retries with what it believes is the new access token and
 * sends the expired one instead.
 */
function createSessionState(): SessionState {
  let access: string | null = null;

  return {
    accessToken: () => access,

    /**
     * Read from storage every time rather than remembered.
     *
     * Storage is where this token lives, so a copy in memory could only ever be
     * a second answer to the same question — and it would be the wrong one
     * whenever the page was not the last to write: another tab signing out
     * clears the key while this tab still believes in it, and a module loaded
     * before the token was stored never sees it at all.
     */
    refreshToken: () => readStoredRefreshToken(),

    adopt(session) {
      access = session.accessToken;
      localStorage.setItem(REFRESH_STORAGE_KEY, session.refreshToken);
    },

    end() {
      access = null;
      localStorage.removeItem(REFRESH_STORAGE_KEY);
    },
  };
}

export const session: SessionState = createSessionState();
