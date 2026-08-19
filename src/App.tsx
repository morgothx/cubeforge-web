import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';
import { createQueryClient } from './queries/client';

/**
 * The application root: server state, then routing, then the page.
 *
 * The query client is held in state rather than created on each render, so a
 * re-render cannot silently discard every cached answer the person is looking
 * at.
 *
 * The page itself is still a placeholder. Routing arrives with the route table
 * in task 5.1; what exists here is the frame the rest of the feature is built
 * inside, which is worth having early precisely because everything below it
 * assumes it.
 */
export function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <main>
          <h1>CubeForge</h1>
          <p>Multi-tenant analytics. The dashboard starts here.</p>
        </main>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
