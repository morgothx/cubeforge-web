import { http, HttpResponse } from 'msw';
import { AppRoutes } from './AppRoutes';
import { TENANT_STORAGE_KEY, lastTenant } from './last-tenant';
import { backend } from '../../test/handlers';
import {
  findActingIn,
  renderSignedIn,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { server } from '../../test/server';
import { session } from '../api/session';
import type { CallerStanding, TenantMembership } from '../api/types';

/**
 * Which tenant the person is acting in.
 *
 * There are two mechanisms here and only one of them is state. The address is
 * the selection: `/t/t-acme/members` *is* a person acting in Acme, which is why
 * requirement 5.4 costs nothing — reloading restores the choice because the
 * choice never left. The remembered value exists for exactly one question,
 * "where do I send somebody who arrived at the root", and every test below that
 * names a tenant in the address requires the remembered value to be ignored.
 */

function standingOf(memberships: readonly TenantMembership[]) {
  const standing: CallerStanding = { ...backend.caller, memberships };
  server.use(http.get('/api/me', () => HttpResponse.json(standing)));
}

const acmeOnly: readonly TenantMembership[] = [
  { tenantId: 't-acme', tenantName: 'Acme', role: 'admin' },
];

/** Where the switcher lives, so a test can tell it from the page. */
function switcher() {
  return screen.getByRole('navigation', { name: /tenant/i });
}

/**
 * The tenants offered as destinations, by name.
 *
 * A row says the tenant *and* the role held in it, so the name is read from the
 * node that holds it rather than from the row's whole text — otherwise every
 * assertion here would also be an assertion about where the role is printed.
 */
function tenantsOffered(): string[] {
  return within(switcher())
    .queryAllByRole('link')
    .map((link) => link.firstChild?.textContent ?? '');
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('arriving at the root', () => {
  it('selects the only tenant without asking', async () => {
    standingOf(acmeOnly);

    renderSignedIn(<AppRoutes />, { at: '/' });

    expect(await findActingIn('Acme')).toBeInTheDocument();
    // 5.1: nowhere to go but here, so there is nothing to ask about.
    expect(tenantsOffered()).toEqual([]);
  });

  it('returns to the tenant last used', async () => {
    localStorage.setItem(TENANT_STORAGE_KEY, 't-globex');

    renderSignedIn(<AppRoutes />, { at: '/' });

    expect(await findActingIn('Globex')).toBeInTheDocument();
  });

  it('falls back when nothing was remembered', async () => {
    renderSignedIn(<AppRoutes />, { at: '/' });

    expect(await findActingIn('Acme')).toBeInTheDocument();
  });

  it('sends somebody who reaches nowhere to the plain statement', async () => {
    standingOf([]);

    renderSignedIn(<AppRoutes />, { at: '/' });

    // 4.3. The root resolves into a tenant, and "none" is an answer it has to
    // have rather than a case that falls through into picking one.
    expect(
      await screen.findByText(/belong to no tenants/i),
    ).toBeInTheDocument();
  });

  it('ignores a remembered tenant the caller can no longer reach', async () => {
    localStorage.setItem(TENANT_STORAGE_KEY, 't-gone');

    renderSignedIn(<AppRoutes />, { at: '/' });

    // A membership can be revoked between sessions. The remembered value is a
    // convenience and never an authority — the standing is the authority, and
    // it no longer names this one.
    expect(await findActingIn('Acme')).toBeInTheDocument();
  });
});

describe('the address as the selection', () => {
  it('keeps the tenant named in the address over the one remembered', async () => {
    localStorage.setItem(TENANT_STORAGE_KEY, 't-acme');

    renderSignedIn(<AppRoutes />, { at: '/t/t-globex/members' });

    // This is the whole reason the selection lives in the URL. If the
    // remembered value could win here, a reload would move somebody to a
    // different tenant than the one on their screen.
    expect(await findActingIn('Globex')).toBeInTheDocument();
  });

  it('records the tenant being acted in as the one last used', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-globex/members' });

    await findActingIn('Globex');
    await waitFor(() => {
      expect(lastTenant()).toBe('t-globex');
    });
  });

  it('remembers nothing at an address that names no tenant', async () => {
    localStorage.setItem(TENANT_STORAGE_KEY, 't-globex');

    renderSignedIn(<AppRoutes />, { at: '/no-tenants' });

    await screen.findByText(/belong to no tenants/i);
    expect(lastTenant()).toBe('t-globex');
  });
});

describe('choosing among several', () => {
  it('shows which tenant is selected, and offers the others', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    expect(await findActingIn('Acme')).toBeInTheDocument();
    // 5.2: the current one is always visible, and it is not offered as a
    // destination — going where you already are is not a choice.
    expect(tenantsOffered()).toEqual(['Globex']);
  });

  it('changes the tenant, and the role that comes with it', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });
    expect(await findActingIn('Acme')).toHaveTextContent('admin');

    within(switcher())
      .getByRole('link', { name: /^Globex/ })
      .click();

    // 5.3: the role is the caller's role *in the tenant selected*, and it is
    // what every later gate reads. The same person is an administrator in one
    // of these and a viewer in the other.
    expect(await findActingIn('Globex')).toHaveTextContent('viewer');
  });

  it('offers no switcher to somebody who belongs nowhere', async () => {
    standingOf([]);

    renderSignedIn(<AppRoutes />, { at: '/no-tenants' });

    // The frame is awaited first. Absence asserted while the standing is still
    // being read is absence proved by nothing having rendered yet.
    await screen.findByRole('button', { name: /sign out/i });
    // An empty control invites a choice that does not exist (4.3).
    expect(screen.queryByRole('navigation', { name: /tenant/i })).toBeNull();
  });
});
