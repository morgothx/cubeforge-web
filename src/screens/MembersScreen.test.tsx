import { delay, http, HttpResponse } from 'msw';
import { AppRoutes } from '../routes/AppRoutes';
import { MembersScreen } from './MembersScreen';
import { backend, withoutAddresses } from '../../test/handlers';
import { renderSignedIn, screen, waitFor, within } from '../../test/render';
import { countRequests, server } from '../../test/server';
import { session } from '../api/session';
import type { Member } from '../api/types';

/**
 * The listing, and the one thing about it that is easy to get subtly wrong.
 *
 * The backend **omits** a member's address from a caller who may not see it —
 * it never sends an empty one — and requirement 7.2 turns on that distinction.
 * A column of blanks says "these people have no address" or "the data failed to
 * arrive"; no column at all says "not for you". Those are different sentences,
 * and only the second is true.
 */

function membersAre(members: readonly Member[]) {
  server.use(
    http.get('/api/tenants/:tenantId/members', () =>
      HttpResponse.json(members),
    ),
  );
}

/** Every cell of the listing, row by row, so a blank is visible as a blank. */
function rows(): string[][] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    );
}

function columns(): string[] {
  return screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '');
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('the members of the selected tenant', () => {
  it('lists each one with their role and whether they are still a member', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    expect(await screen.findByText('editor@example.com')).toBeInTheDocument();
    expect(rows()).toEqual([
      ['caller@example.com', 'admin', 'Active'],
      ['editor@example.com', 'editor', 'Active'],
      // 7.1: a revoked membership is part of the answer to "who is in this
      // tenant", and the listing asks for it explicitly.
      ['gone@example.com', 'viewer', 'Revoked'],
    ]);
  });

  it('leaves no column where a withheld address would be', async () => {
    membersAre(withoutAddresses(backend.members));

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    // Not "the addresses are absent" — a column of blanks would satisfy that.
    // There is no address column, and no cell is empty.
    expect(columns()).toEqual(['Role', 'Status']);
    expect(rows().flat()).not.toContain('');
  });

  it('shows the column when the backend disclosed the addresses', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await screen.findByText('editor@example.com');
    expect(columns()).toEqual(['Member', 'Role', 'Status']);
  });

  it('withholds every address when it withholds one', async () => {
    const [first, ...rest] = backend.members;
    membersAre([first, ...withoutAddresses(rest)]);

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    // The backend withholds all or none, so this cannot happen — and if it
    // ever does, one blank cell is the exact failure 7.2 is about. Showing
    // none is the reading that cannot produce one.
    expect(columns()).toEqual(['Role', 'Status']);
    expect(rows().flat()).not.toContain('');
  });
});

describe('while the listing is on its way', () => {
  it('says it is waiting rather than showing an empty list', async () => {
    server.use(
      http.get('/api/tenants/:tenantId/members', async () => {
        await delay(30);
        return HttpResponse.json(backend.members);
      }),
    );

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    expect(await screen.findByText(/loading|waiting/i)).toBeInTheDocument();
    // 8.4: "no members yet" and "not here yet" are different answers, and only
    // one of them is a reason to invite somebody.
    expect(screen.queryByText(/no members/i)).toBeNull();
    expect(await screen.findByText('editor@example.com')).toBeInTheDocument();
  });

  it('says a tenant with nobody in it has nobody in it', async () => {
    membersAre([]);

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    expect(await screen.findByText(/no members/i)).toBeInTheDocument();
    // An empty answer is an ordinary answer, not a failure.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the listing belongs to one tenant', () => {
  it('asks nothing at an address that names no tenant', async () => {
    renderSignedIn(<MembersScreen />, { at: '/somewhere-else' });

    // The route table never renders this without a tenant, but that is a
    // property of today's routes rather than of the screen. Asking anyway
    // would put a request with an empty tenant segment on the wire, be refused
    // wordlessly, and send the request layer off to renew a credential that
    // was never the problem.
    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
    expect(countRequests('GET', '/api/tenants//members')).toBe(0);
  });

  it('asks again for the tenant switched to', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });
    await screen.findByText('editor@example.com');

    within(screen.getByRole('navigation', { name: /tenant/i }))
      .getByRole('link', { name: 'Globex' })
      .click();

    // Keyed on the tenant, so the answer for one is never shown for the other
    // — the classic cache mistake, and the one that shows somebody another
    // tenant's people.
    await waitFor(() => {
      expect(countRequests('GET', '/api/tenants/t-globex/members')).toBe(1);
    });
    expect(countRequests('GET', '/api/tenants/t-acme/members')).toBe(1);
  });
});
