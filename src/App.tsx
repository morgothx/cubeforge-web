import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';
import { createQueryClient } from './queries/client';
import { AppRoutes } from './routes/AppRoutes';
import { SessionProvider } from './session/SessionProvider';

/**
 * The application root: server state, then routing, then the page.
 *
 * The query client is held in state rather than created on each render, so a
 * re-render cannot silently discard every cached answer the person is looking
 * at.
 *
 * The session sits inside the query client and outside the router: it clears
 * the cache when a session ends, and every route below it may ask which of the
 * three states applies.
 *
 * What each address renders is still partly a stand-in — the form and the
 * members screen arrive in tasks 6.1 and 6.2 — but the table, the gate and the
 * frame around them are real.
 */
export function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
