import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { createQueryClient } from '../src/queries/client';

export * from '@testing-library/react';

/**
 * Renders a subject inside the providers the application really uses, at a
 * given address.
 *
 * A fresh query client per render, never a shared one: a cache surviving from
 * one test into the next is the classic source of a suite that passes in order
 * and fails alone.
 *
 * `MemoryRouter` rather than the browser router the application mounts, because
 * a test needs to start at an address and there is no history to push. That is
 * the only difference from production, and it is the router's whole purpose.
 */
export function renderAt(
  subject: ReactElement,
  options: { at?: string } = {},
): RenderResult {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[options.at ?? '/']}>
        {subject}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
