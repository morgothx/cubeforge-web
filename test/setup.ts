import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { forgetRequests, server } from './server';

/**
 * How long an eventual assertion waits before it calls the thing a failure.
 *
 * The default is one second, which is a wager on how fast the machine is
 * rather than a statement about the application. Two assertions in this suite
 * lost that wager on a developer machine that was also running a browser, a
 * database and two dev servers — and a continuous-integration runner is not
 * faster. Nothing here waits on a timer; every one of these is waiting for a
 * render that has already been asked for, so a longer ceiling costs nothing
 * when the code is right and buys a diagnosis when it is not.
 *
 * Kept **below** the test timeout, which is the mistake this line made first:
 * set equal to it, a query that never matches exhausts the test rather than
 * itself, and the report is "timed out in 5000ms" instead of the element it
 * could not find and the ones it found instead.
 */
configure({ asyncUtilTimeout: 3_000 });

/**
 * `matchMedia`, which jsdom does not implement and every browser has.
 *
 * The theme reads it to find the system's preference. Without this the call
 * throws, React renders nothing, and **seventy tests across the whole suite
 * fail with an empty document** — while the theme's own file passes, because it
 * stubs `matchMedia` itself. A test that stubs a global proves the component
 * works *given* the stub; only the rest of the suite proves the global exists.
 *
 * Stubbed here rather than guarded in the application: the environment is the
 * deficient one, and code written to survive a missing browser API is code that
 * cannot be read as describing a browser.
 *
 * Reports "no preference expressed", which is what an unconfigured environment
 * honestly is. A test that cares overrides it.
 */
window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

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
