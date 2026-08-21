import { http, HttpResponse } from 'msw';
import { AppRoutes } from '../routes/AppRoutes';
import { MembersScreen } from './MembersScreen';
import { backend, withoutAddresses } from '../../test/handlers';
import { renderSignedIn, screen, waitFor, within } from '../../test/render';
import { countRequests, held, server } from '../../test/server';
import { session } from '../api/session';
import type { CallerStanding, Member, Role } from '../api/types';

/**
 * The listing, and the one thing about it that is easy to get subtly wrong.
 *
 * The backend **omits** a member's address from a caller who may not see it —
 * it never sends an empty one — and requirement 7.2 turns on that distinction.
 * A column of blanks says "these people have no address" or "the data failed to
 * arrive". Neither is true, and the fix is not to drop the column: it is to
 * name the row with something that is not an address and not a blank. Since
 * task 3.1 that is an opaque identifier, so the listing always has a column
 * saying who each row is about.
 */

/**
 * The caller's role in Acme.
 *
 * A viewer throughout this file, deliberately: what the listing renders about
 * addresses is decided by **what the backend sent**, not by what role the
 * caller holds, and the two are kept apart here so a change to one cannot be
 * mistaken for the other. The actions a role may take have their own file.
 */
function callerIsA(role: Role) {
  const standing: CallerStanding = {
    ...backend.caller,
    memberships: [
      { tenantId: 't-acme', tenantName: 'Acme', role },
      { tenantId: 't-globex', tenantName: 'Globex', role: 'viewer' },
    ],
  };
  server.use(http.get('/api/me', () => HttpResponse.json(standing)));
}

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
  callerIsA('viewer');
});

describe('the members of the selected tenant', () => {
  it('lists each one with their role and whether they are still a member', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    expect(await screen.findByText('editor@example.com')).toBeInTheDocument();
    expect(rows()).toEqual([
      // The caller's own row says so. Somebody looking for the effect of a
      // change they are about to make needs to find themselves first.
      ['caller@example.com · you', 'admin', 'Active'],
      ['editor@example.com', 'editor', 'Active'],
      // 7.1: a revoked membership is part of the answer to "who is in this
      // tenant", and the listing asks for it explicitly.
      ['gone@example.com', 'viewer', 'Revoked'],
    ]);
  });

  it('names a person it may not name, rather than leaving a blank', async () => {
    membersAre(withoutAddresses(backend.members));

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    // The column stays, because "who is this row about" is a question the
    // listing has to answer either way. What it holds is an identifier, and
    // no cell is empty — which is the whole of 7.2.
    expect(columns()).toEqual(['Member', 'Role', 'Status']);
    expect(rows().flat()).not.toContain('');
    for (const [member] of rows()) {
      expect(member).toMatch(/^person_[0-9a-f]{6}/);
    }
  });

  it('discloses no address the backend withheld', async () => {
    membersAre(withoutAddresses(backend.members));

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    // The identifier is a substitute for the address, not a decoration beside
    // it. A row that rendered both would make the whole column pointless.
    // Scoped to the table: the panel shows the caller their *own* address, and
    // always did.
    expect(
      within(screen.getByRole('table')).queryByText(/@example\.com/),
    ).toBeNull();
  });

  it('shows the address where the backend disclosed one', async () => {
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await screen.findByText('editor@example.com');
    expect(columns()).toEqual(['Member', 'Role', 'Status']);
  });

  it('leaves no blank when one address arrives and the others do not', async () => {
    const [first, ...rest] = backend.members;
    membersAre([first, ...withoutAddresses(rest)]);

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    // The backend discloses all or none, so this cannot happen. Deciding the
    // name per row rather than for the listing is what makes it harmless if it
    // ever does — the reading that cannot produce a blank.
    expect(rows().flat()).not.toContain('');
    expect(rows()[0]?.[0]).toBe('caller@example.com · you');
    expect(rows()[1]?.[0]).toMatch(/^person_[0-9a-f]{6}$/);
  });
});

describe('while the listing is on its way', () => {
  it('says it is waiting rather than showing an empty list', async () => {
    const listing = held();
    server.use(
      http.get('/api/tenants/:tenantId/members', async () => {
        await listing.until;
        return HttpResponse.json(backend.members);
      }),
    );

    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });

    expect(await screen.findByText(/loading|waiting/i)).toBeInTheDocument();
    // 8.4: "no members yet" and "not here yet" are different answers, and only
    // one of them is a reason to invite somebody.
    expect(screen.queryByText(/no members/i)).toBeNull();
    listing.release();
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
      .getByRole('link', { name: /^Globex/ })
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
