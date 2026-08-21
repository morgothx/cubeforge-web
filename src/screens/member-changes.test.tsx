import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from '../routes/AppRoutes';
import { backend } from '../../test/handlers';
import {
  findActingIn,
  fireEvent,
  renderSignedIn,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { countRequests, held, server } from '../../test/server';
import { session } from '../api/session';
import type { CallerStanding, Member, Role } from '../api/types';

/**
 * What an administrator may change, and what everybody else is not offered.
 *
 * Two properties here are invisible in a rendered screen and are asserted as
 * counts and as sequences instead: that a change is followed by the listing
 * being *read again* rather than patched locally, and that the caller's own
 * standing is read again too — because the person who just demoted themselves
 * must stop being offered what their new role does not permit.
 */

const user = userEvent.setup();

/** The caller's role in Acme, which is what every gate on this screen reads. */
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

/** A listing that answers differently once the change has been made. */
function listingChangesTo(after: readonly Member[]) {
  let changed = false;
  server.use(
    http.get('/api/tenants/:tenantId/members', () =>
      HttpResponse.json(changed ? after : backend.members),
    ),
    http.post('/api/tenants/:tenantId/members', () => {
      changed = true;
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch('/api/tenants/:tenantId/members/:membershipId', () => {
      changed = true;
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('/api/tenants/:tenantId/members/:membershipId', () => {
      changed = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

function rowFor(email: string) {
  return screen.getByRole('row', { name: new RegExp(email) });
}

async function openListing(role: Role = 'admin') {
  callerIsA(role);
  renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });
  await screen.findByText('editor@example.com');
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('what an administrator is offered', () => {
  it('may invite, change a role, and revoke', async () => {
    await openListing('admin');

    expect(
      screen.getByRole('textbox', { name: /invite/i }),
    ).toBeInTheDocument();
    expect(
      within(rowFor('editor@example.com')).getByRole('combobox'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('editor@example.com')).getByRole('button', {
        name: /revoke/i,
      }),
    ).toBeInTheDocument();
  });

  it.each(['editor', 'viewer'] as const)(
    'offers none of the three to a %s',
    async (role) => {
      await openListing(role);

      // 7.4, and 6.1: not disabled, absent. A disabled control still tells
      // somebody the action exists and that they are the problem, and the
      // backend refuses it either way.
      expect(screen.queryByRole('textbox', { name: /invite/i })).toBeNull();
      expect(screen.queryAllByRole('combobox')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /revoke/i })).toBeNull();
    },
  );
});

describe('a change the backend accepts', () => {
  it('shows the listing as it now stands, without a reload', async () => {
    listingChangesTo([
      ...backend.members,
      {
        membershipId: 'm-new',
        personId: 'person-new',
        email: 'new@example.com',
        role: 'viewer',
        active: true,
      },
    ]);
    await openListing('admin');

    await user.type(
      screen.getByRole('textbox', { name: /invite/i }),
      'new@example.com',
    );
    await user.click(screen.getByRole('button', { name: /^invite$/i }));

    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
    // Asserted as a second read, not just as the new row: a screen that spliced
    // the invitation into its own cache would show the same thing and be wrong
    // about everything the backend decided (7.5).
    await waitFor(() => {
      expect(countRequests('GET', '/api/tenants/t-acme/members')).toBe(2);
    });
  });

  it('reads the caller their own standing again after a role changes', async () => {
    listingChangesTo(backend.members);
    await openListing('admin');

    fireEvent.change(
      within(rowFor('editor@example.com')).getByRole('combobox'),
      { target: { value: 'viewer' } },
    );

    // 4.5: this is the one that can change what the caller themselves may do.
    await waitFor(() => {
      expect(countRequests('GET', '/api/me')).toBe(2);
    });
  });

  it('reads it again after a membership is revoked', async () => {
    listingChangesTo(backend.members.slice(0, 1));
    await openListing('admin');

    // An *active* membership: since task 3.1 a revoked one is offered no
    // revoking, and pressing the control of a row that has none would have
    // been a test of nothing.
    await user.click(
      within(rowFor('editor@example.com')).getByRole('button', {
        name: /revoke/i,
      }),
    );

    await waitFor(() => {
      expect(countRequests('GET', '/api/me')).toBe(2);
    });
  });
});

describe('an administrator who demotes themselves', () => {
  it('stops being offered what their new role does not permit', async () => {
    let demoted = false;
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          ...backend.caller,
          memberships: [
            {
              tenantId: 't-acme',
              tenantName: 'Acme',
              role: demoted ? 'viewer' : 'admin',
            },
          ],
        }),
      ),
      http.patch('/api/tenants/:tenantId/members/:membershipId', () => {
        demoted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });
    expect(await findActingIn('Acme')).toHaveTextContent('admin');
    await screen.findByText('editor@example.com');

    fireEvent.change(
      within(rowFor('caller@example.com')).getByRole('combobox'),
      { target: { value: 'viewer' } },
    );

    // The whole reason standing is a query rather than something remembered at
    // sign-in: the role changed, the credential did not, and the next render
    // is the one that has to notice.
    expect(await findActingIn(/viewer/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /revoke/i })).toBeNull();
    });
    expect(screen.queryByRole('textbox', { name: /invite/i })).toBeNull();
  });
});

describe('while a change is in flight', () => {
  it('shows it and refuses the same action twice', async () => {
    const invitation = held();
    server.use(
      http.post('/api/tenants/:tenantId/members', async () => {
        await invitation.until;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await openListing('admin');
    await user.type(
      screen.getByRole('textbox', { name: /invite/i }),
      'new@example.com',
    );

    await user.click(screen.getByRole('button', { name: /^invite$/i }));

    expect(await screen.findByText(/inviting/i)).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form', { name: /invite a member/i }));
    fireEvent.submit(screen.getByRole('form', { name: /invite a member/i }));
    invitation.release();
    await waitFor(() => {
      expect(screen.queryByText(/inviting/i)).toBeNull();
    });
    // 7.8. Two invitations for one click is the second one being refused as an
    // existing member, which reads as the person's mistake rather than ours.
    expect(countRequests('POST', '/api/tenants/t-acme/members')).toBe(1);
  });
});

/**
 * A membership that is already revoked (task 3.1).
 *
 * It stays in the listing — 7.1 asks for it, because "who is in this tenant" is
 * answered wrongly by a list that quietly drops the people who were. What it
 * does not keep is its controls, and the two are treated differently on
 * purpose:
 *
 * - **the Change cell is empty** — revoking a revoked membership is an action
 *   with no meaning, and offering it greyed out would still say it exists;
 * - **the role select stays, disabled** — this is a fact about the row rather
 *   than about the caller. It says what the role was and that it cannot be
 *   changed, and removing it would leave the row a different shape from every
 *   other one for no reason a reader could see.
 *
 * That distinction is the same one 7.4 makes, applied to an object rather than
 * to a person: what you may not do is absent, what cannot be done is stated.
 */
describe('a membership that is already revoked', () => {
  it('is still listed, and still says what the role was', async () => {
    await openListing('admin');

    const row = rowFor('gone@example.com');
    expect(within(row).getByText('Revoked')).toBeInTheDocument();
    expect(within(row).getByRole('combobox')).toHaveValue('viewer');
  });

  it('cannot have that role changed', async () => {
    await openListing('admin');

    expect(
      within(rowFor('gone@example.com')).getByRole('combobox'),
    ).toBeDisabled();
    // The active row's select is not, so this is a claim about the membership.
    expect(
      within(rowFor('editor@example.com')).getByRole('combobox'),
    ).toBeEnabled();
  });

  it('is offered no revoking', async () => {
    await openListing('admin');

    // Absent, not disabled. A greyed control still says the action exists and
    // that you are the one it is refusing.
    expect(
      within(rowFor('gone@example.com')).queryByRole('button', {
        name: /revoke/i,
      }),
    ).toBeNull();
    // And the row that is still active keeps it, so the assertion above is
    // about this membership rather than about an administrator who lost the
    // action altogether.
    expect(
      within(rowFor('editor@example.com')).getByRole('button', {
        name: /revoke/i,
      }),
    ).toBeInTheDocument();
  });
});

describe('the controls in a row', () => {
  it('name the person they act on', async () => {
    await openListing('admin');

    // The face of the revoke button says one word, because the column is one
    // word wide and the row already says whose it is. Somebody hearing the
    // controls one after another has no row — so the name has to carry it, and
    // four buttons called "Revoke" would be four identical choices.
    for (const who of ['caller@example.com', 'editor@example.com']) {
      expect(
        screen.getByRole('button', { name: `Revoke ${who}` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: `Role of ${who}` }),
      ).toBeInTheDocument();
    }
  });

  it('names them by the identifier when it has no address to use', async () => {
    server.use(
      http.get('/api/tenants/:tenantId/members', () =>
        HttpResponse.json(
          backend.members.map(({ email: _email, ...rest }) => rest),
        ),
      ),
    );
    callerIsA('admin');
    renderSignedIn(<AppRoutes />, { at: '/t/t-acme/members' });
    await screen.findByRole('table');

    // Never `Role of undefined`, and never the raw person id either: whatever
    // the column shows is what the control is called, so the two agree.
    // Scoped to the table: the invite form has a role select too, and it is
    // about nobody in particular.
    const named = within(screen.getByRole('table'))
      .getAllByRole('combobox')
      .map((control) => control.getAttribute('aria-label') ?? '');
    expect(named).toHaveLength(3);
    for (const name of named) {
      expect(name).toMatch(/^Role of person_[0-9a-f]{6}$/);
    }
  });
});
