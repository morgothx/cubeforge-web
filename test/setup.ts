import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { forgetRequests, server } from './server';

/**
 * `onUnhandledRequest: 'error'` on purpose. A request nobody wrote a handler
 * for would otherwise reach the network, which makes a suite depend on a
 * machine's connectivity and turns a typo'd path into a backend that answered
 * nothing.
 */
beforeAll(() => {
  server.listen({
    // Our own error rather than the built-in `'error'` strategy, because the
    // built-in one is indistinguishable from the request simply failing — and
    // in this environment an unhandled request fails anyway, there being no
    // server behind the address. A test asserting "it threw" would therefore
    // pass with the policy switched off, which is how a harness comes to be
    // trusted for the wrong reason.
    onUnhandledRequest: (request) => {
      throw new Error(
        `no handler for ${request.method} ${new URL(request.url).pathname}`,
      );
    },
  });
});

afterEach(() => {
  // Vitest does not unmount between tests, and a component left in the document
  // makes the next test's query ambiguous rather than failing outright — which
  // is the kind of failure that gets diagnosed as flakiness.
  cleanup();
  server.resetHandlers();
  forgetRequests();
});

afterAll(() => {
  server.close();
});
