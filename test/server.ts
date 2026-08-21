import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers());

interface SeenRequest {
  readonly method: string;
  readonly path: string;
}

let seen: SeenRequest[] = [];

server.events.on('request:start', ({ request }) => {
  seen.push({
    method: request.method.toUpperCase(),
    path: new URL(request.url).pathname,
  });
});

/**
 * How many times a route was asked.
 *
 * Two of this feature's properties are only expressible as a count: that
 * several requests expiring together produce **one** renewal rather than
 * several, and that access just renewed is not renewed again. Neither shows up
 * in a response body — an implementation that renewed three times would answer
 * exactly the same as one that renewed once.
 */
export function countRequests(method: string, path: string): number {
  return seen.filter(
    (request) =>
      request.method === method.toUpperCase() && request.path === path,
  ).length;
}

export function forgetRequests(): void {
  seen = [];
}

/**
 * A request the test holds open until it says otherwise.
 *
 * `await delay(30)` was how the three in-flight tests kept a request pending,
 * and thirty milliseconds is a wager rather than a mechanism: it is the entire
 * window in which "Inviting…" exists, and under a loaded machine the click, the
 * render and the resolution can all land inside it. That flake was watched twice
 * before it was fixed, both times on a machine also running a browser and a
 * database.
 *
 * Held open explicitly, the window is as long as the assertions need and the
 * test asserts the same thing it always did.
 */
export function held(): { until: Promise<void>; release: () => void } {
  let release = () => undefined as void;
  const until = new Promise<void>((resolve) => {
    release = () => {
      resolve();
    };
  });
  return { until, release };
}
