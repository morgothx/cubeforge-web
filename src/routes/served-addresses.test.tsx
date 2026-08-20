import { AppRoutes } from './AppRoutes';
import { renderAt, screen } from '../../test/render';
import { session } from '../api/session';
import { SessionProvider } from '../session/SessionProvider';

/**
 * The addresses this feature serves, named, so a route added later fails here
 * rather than slipping in.
 *
 * Requirement 10 is a list of things this feature is *not*: provisioning
 * tenants, issuing setup tokens, deactivating people, managing API keys,
 * charts, setting a password from a token. None of them is excluded by a
 * decision anywhere in the code — they are excluded by there being no address
 * that reaches them, which is a property nothing in the application states and
 * that no ordinary test would notice disappearing.
 *
 * So this states it. The list below is written by hand on purpose: it is the
 * commitment, and the route table is the implementation, and the whole value is
 * that the two have to be reconciled by a person.
 */

/** Every address the feature committed to serving. */
const SERVED = ['*', '/', '/no-tenants', '/sign-in', '/t/:tenantId/members'];

const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function pathsIn(source: string): string[] {
  return [...code(source).matchAll(/path="([^"]*)"/g)].map((match) => match[1]);
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('the addresses this feature serves', () => {
  it('are exactly the ones it committed to', () => {
    const table = sources['./AppRoutes.tsx'];

    // Adding a route without adding it here fails by name, which is the only
    // moment anybody will think about whether it belongs in this feature at
    // all.
    expect(pathsIn(table ?? '').sort()).toEqual(SERVED);
  });

  it('are declared in one file and nowhere else', () => {
    const declaring = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) => /<Route\b/.test(code(source)))
      .map(([path]) => path);

    // A second table somewhere would make the list above true and incomplete
    // at the same time.
    expect(declaring).toEqual(['./AppRoutes.tsx']);
  });
});

describe('the areas this feature excluded', () => {
  it.each([
    ['provisioning a tenant', '/tenants/new'],
    ['issuing a setup token', '/setup-tokens'],
    ['setting a password from a token', '/set-password'],
    ['deactivating a person', '/people/person-caller/deactivate'],
    ['managing API keys', '/api-keys'],
    ['platform operator screens', '/operators'],
    ['a metric or a chart', '/dashboards'],
  ])('has no address that reaches %s', async (_area, address) => {
    renderAt(
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>,
      { at: address },
    );

    // Not "the screen does not exist" — that is trivially true of a screen
    // nobody wrote. What is asserted is that the address leads nowhere, which
    // stays true only while nobody adds one.
    expect(
      await screen.findByRole('heading', { name: /not available/i }),
    ).toBeInTheDocument();
  });
});
