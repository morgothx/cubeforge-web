import { http, HttpResponse } from 'msw';
import { backend } from '../../test/handlers';
import { renderSignedIn, screen, within } from '../../test/render';
import { server } from '../../test/server';
import { session } from '../api/session';
import type { CallerStanding } from '../api/types';
import { AppLayout } from './AppLayout';

/**
 * The frame every signed-in page sits in, and for now the one thing it says:
 * who the caller is.
 *
 * Requirement 6.4 is the interesting half. Being a platform operator is a fact
 * the person is entitled to see, and it is *only* a fact — it opens nothing.
 * That is a claim about what is absent, so the test compares the destinations
 * offered to an operator with those offered to everybody else and requires them
 * to be the same set.
 */

function standingOf(overrides: Partial<CallerStanding>) {
  server.use(
    http.get('/api/me', () =>
      HttpResponse.json({ ...backend.caller, ...overrides }),
    ),
  );
}

/** Every place this layout can take somebody, by its accessible name. */
function destinations(): string[] {
  const region = screen.getByRole('banner');
  return [
    ...within(region).queryAllByRole('link'),
    ...within(region).queryAllByRole('button'),
  ]
    .map((element) => element.textContent ?? '')
    .sort();
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('the application frame', () => {
  it('shows the caller their own address', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>);

    expect(await screen.findByText('caller@example.com')).toBeInTheDocument();
  });

  it('renders the page it frames', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>);

    await screen.findByText('caller@example.com');
    expect(screen.getByRole('main')).toHaveTextContent('a page');
  });

  it('claims no identity while it is still asking', () => {
    renderSignedIn(<AppLayout>a page</AppLayout>);

    // Nothing is known yet, so nothing is said. A layout that rendered an empty
    // slot where the address goes would read as a person with no address.
    expect(screen.queryByText('caller@example.com')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('records the caller as an operator where the platform does', async () => {
    standingOf({ isOperator: true });

    renderSignedIn(<AppLayout>a page</AppLayout>);

    expect(await screen.findByText(/platform operator/i)).toBeInTheDocument();
  });

  it('says nothing of the sort where the platform does not', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>);

    await screen.findByText('caller@example.com');
    expect(screen.queryByText(/platform operator/i)).toBeNull();
  });

  it('offers an operator no destination it does not offer everybody', async () => {
    // Rendered at a tenant's address on purpose: that is where the frame has
    // destinations at all, and a comparison of two empty sets would pass for
    // any implementation whatsoever.
    const ordinary = renderSignedIn(<AppLayout>a page</AppLayout>, {
      at: '/t/t-acme/members',
    });
    await screen.findByText('caller@example.com');
    const offered = destinations();
    expect(offered).not.toEqual([]);
    ordinary.unmount();

    standingOf({ isOperator: true });
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });
    await screen.findByText(/platform operator/i);

    // 6.4, and the reason it is a requirement at all: this repository has no
    // operator screens, and a badge that quietly became a link would be an
    // invitation to a destination that does not exist. The fact is shown; the
    // navigation does not change.
    expect(destinations()).toEqual(offered);
  });

  it('does not make being an operator something to click', async () => {
    standingOf({ isOperator: true });

    renderSignedIn(<AppLayout>a page</AppLayout>);

    const badge = await screen.findByText(/platform operator/i);
    expect(badge.closest('a')).toBeNull();
    expect(badge.closest('button')).toBeNull();
  });
});
