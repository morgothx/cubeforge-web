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
