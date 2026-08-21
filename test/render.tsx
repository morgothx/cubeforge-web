import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import {
  render,
  screen,
  waitFor,
  type RenderResult,
} from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { REFRESH_STORAGE_KEY } from '../src/api/session';
import { createQueryClient } from '../src/queries/client';
import { SessionProvider } from '../src/session/SessionProvider';

export * from '@testing-library/react';

/**
 * Renders a subject inside the providers the application really uses, at a
 * given address.
 *
 * A fresh query client per render, never a shared one: a cache surviving from
 * one test into the next is the classic source of a suite that passes in order
 * and fails alone.
 *
 * A caller that needs to look inside the cache — signing out has to leave none
 * of the previous person's answers behind — passes its own client and keeps a
 * reference to it.
 *
 * `MemoryRouter` rather than the browser router the application mounts, because
 * a test needs to start at an address and there is no history to push. That is
 * the only difference from production, and it is the router's whole purpose.
 */
export function renderAt(
  subject: ReactElement,
  options: { at?: string; state?: unknown; client?: QueryClient } = {},
): RenderResult {
  const queryClient = options.client ?? createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[{ pathname: options.at ?? '/', state: options.state }]}
      >
        {subject}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * The same, for a subject that only exists once somebody is signed in.
 *
 * A stored refresh token before the first render is how a real page arrives
 * with a session: the provider exchanges it and everything below waits for
 * `signed-in`. Nothing here fakes that state — the subject meets the same
 * restore the browser would give it, which is why a read fired too early shows
 * up as a request rather than as nothing at all.
 *
 * `StrictMode`, because React double-invokes effects under it and this tree
 * contains the one effect in the application that must not run twice.
 */
export function renderSignedIn(
  subject: ReactElement,
  options: { at?: string; state?: unknown; client?: QueryClient } = {},
): RenderResult & { client: QueryClient } {
  localStorage.setItem(REFRESH_STORAGE_KEY, 'refresh-1');
  const client = options.client ?? createQueryClient();

  return {
    client,
    ...renderAt(
      <StrictMode>
        <SessionProvider>{subject}</SessionProvider>
      </StrictMode>,
      { at: options.at, state: options.state, client },
    ),
  };
}

/**
 * The tenant the frame says is being acted in.
 *
 * Since task 2.1 that claim is made by the panel row carrying `aria-current` —
 * the same claim the accent fill makes to somebody who can see it — rather than
 * by a sentence. Tests ask through here so the next repaint has one place to
 * change instead of a dozen regular expressions matching prose.
 *
 * Queried by attribute deliberately: `aria-current` *is* the assertion, and a
 * row that lost it would still hold the right text.
 */
export function actingIn(): HTMLElement | null {
  const tenants = screen.queryByRole('navigation', { name: /tenant/i });
  return tenants?.querySelector<HTMLElement>('[aria-current]') ?? null;
}

/** The same, awaited — the panel arrives with the standing, not with the page. */
export async function findActingIn(
  tenant: string | RegExp,
): Promise<HTMLElement> {
  return waitFor(() => {
    const current = actingIn();
    if (current === null) throw new Error('no tenant is marked as current');
    expect(current).toHaveTextContent(tenant);
    return current;
  });
}
