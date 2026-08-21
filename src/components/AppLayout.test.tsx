import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { backend } from '../../test/handlers';
import { fireEvent, renderSignedIn, screen, within } from '../../test/render';
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

/** The address being served, so a test can see that pressing something moved nobody. */
function Where() {
  return <p>at {useLocation().pathname}</p>;
}

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

/**
 * The side panel (task 2.1).
 *
 * The panel is the answer to the complaint that started this repaint: looking
 * at the old header, it was not clear what the platform *was*. The panel says
 * it structurally — the tenants are the first-level navigation, and the
 * sections are what exists inside the one you are in.
 *
 * Nothing here can see a colour; jsdom applies no stylesheet. What these tests
 * hold is the structure the design asks for and the meaning that structure
 * carries: two separately named navigations, a current row in each, and an
 * order that puts who-you-are last.
 */
describe('the side panel', () => {
  it('names its two navigations separately', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    await screen.findByText('caller@example.com');
    // Two lists of destinations that answer different questions — which tenant,
    // and which section of it. One nav holding both would offer them as if they
    // were the same kind of choice.
    expect(
      screen.getByRole('navigation', { name: /tenant/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: /section/i }),
    ).toBeInTheDocument();
  });

  it('marks the tenant being acted in, and does not offer it as a destination', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    await screen.findByText('caller@example.com');
    const tenants = screen.getByRole('navigation', { name: /tenant/i });
    const current = tenants.querySelector('[aria-current]');

    expect(current).not.toBeNull();
    expect(current).toHaveTextContent('Acme');
    // 5.2 again, now that every membership is a row rather than only the
    // others: the row you are on is a statement, not a link back to itself.
    expect(current?.closest('a')).toBeNull();
    expect(
      within(tenants)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Globexviewer']);
  });

  it('marks the section being looked at', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    await screen.findByText('caller@example.com');
    const sections = screen.getByRole('navigation', { name: /section/i });

    expect(sections.querySelector('[aria-current="page"]')).toHaveTextContent(
      'Members',
    );
  });

  it('says which tenant each membership is held in, and as what', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    await screen.findByText('caller@example.com');
    const tenants = screen.getByRole('navigation', { name: /tenant/i });

    // The role travels with the tenant, because it changes with it (5.3). A
    // list of bare names would make somebody guess what they may do in each.
    expect(tenants).toHaveTextContent('Acme');
    expect(tenants).toHaveTextContent('admin');
    expect(tenants).toHaveTextContent('Globex');
    expect(tenants).toHaveTextContent('viewer');
  });

  it('reads brand, then where you are, then who you are', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    const identity = await screen.findByText('caller@example.com');
    const brand = screen.getByText('CUBEFORGE');
    const tenants = screen.getByRole('navigation', { name: /tenant/i });

    // The design pins the identity to the bottom of the panel with CSS, which
    // jsdom cannot see. Document order is the part that survives without a
    // stylesheet — and it is the part a screen reader follows.
    const follows = (first: Element, second: Element) =>
      Boolean(
        first.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    expect(follows(brand, tenants)).toBe(true);
    expect(follows(tenants, identity)).toBe(true);
  });

  it('offers no sections where no tenant is selected', async () => {
    standingOf({ memberships: [] });

    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/no-tenants' });

    await screen.findByText('caller@example.com');
    // "In this tenant" is a heading over an empty promise when there is no
    // tenant to be in. The sections belong to a selection, not to the frame.
    expect(screen.queryByRole('navigation', { name: /section/i })).toBeNull();
  });
});

/**
 * Analytics, marked as a hole rather than hidden (task 2.2).
 *
 * The product's whole point is analytics and it does not have them yet. Two
 * dishonest options were available: leave the panel silent, so somebody
 * evaluating this reads "a members list" and stops; or draw a chart of invented
 * numbers. The third is to name the room and say it is not built — which is
 * only honest if pressing it does nothing at all, because a destination that
 * greets you with an empty page is the same lie told slower.
 */
describe('the analytics section', () => {
  it('names where the analytics will live', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    await screen.findByText('caller@example.com');
    const sections = screen.getByRole('navigation', { name: /section/i });

    expect(within(sections).getByText(/analytics/i)).toBeInTheDocument();
    // And says so in the panel rather than in a tooltip somebody has to find.
    expect(within(sections).getByText(/soon/i)).toBeInTheDocument();
  });

  it('offers it as nothing that can be pressed', async () => {
    renderSignedIn(<AppLayout>a page</AppLayout>, { at: '/t/t-acme/members' });

    await screen.findByText('caller@example.com');
    const sections = screen.getByRole('navigation', { name: /section/i });
    const analytics = within(sections).getByText(/analytics/i);

    // The claim is about what it is *not*, so it is made twice: this element
    // is not inside a control, and the section list offers exactly one
    // destination. Either alone passes an implementation the other catches.
    expect(analytics.closest('a')).toBeNull();
    expect(analytics.closest('button')).toBeNull();
    expect(
      within(sections)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Members']);
    expect(within(sections).queryAllByRole('button')).toEqual([]);
  });

  it('sends nobody anywhere when it is pressed anyway', async () => {
    renderSignedIn(
      <AppLayout>
        <Where />
      </AppLayout>,
      { at: '/t/t-acme/members' },
    );

    await screen.findByText('caller@example.com');
    const analytics = screen.getByText(/analytics/i);
    fireEvent.click(analytics);

    // Not a redundant test. `closest('a')` proves the markup; this proves the
    // behaviour, and a handler quietly added to the row would be invisible to
    // the first and caught here.
    expect(screen.getByText('at /t/t-acme/members')).toBeInTheDocument();
  });
});
