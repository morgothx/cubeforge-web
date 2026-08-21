import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from '../src/routes/AppRoutes';
import { SessionProvider } from '../src/session/SessionProvider';
import { session } from '../src/api/session';
import { REFRESH_STORAGE_KEY } from '../src/api/session';
import type { Member, Role } from '../src/api/types';
import { findActingIn, renderAt, screen, waitFor, within } from './render';
import { server } from './server';

/**
 * The whole journey, and the two properties only it exposes.
 *
 * Every layer below has been tested on its own, and each of those tests knows
 * one thing. What none of them can see is the property this platform was built
 * around: **a role changed between two asks shows in the second, with the
 * credential unchanged.** That is why standing is a query rather than a claim
 * carried in a token, and it is only observable across a whole session — sign
 * in, act, be changed, act again.
 *
 * The second is the mirror of it. An action the application offered can be
 * refused, because a role can change between drawing a control and pressing it,
 * and the application must treat that as an ordinary Tuesday rather than as an
 * impossible state. That is what "authorization is not this layer's job" means
 * when it stops being a slogan (9.1).
 */

const user = userEvent.setup();

/**
 * A backend that actually changes when it is asked to.
 *
 * A fixed fixture cannot express any of this: the point is that the *same*
 * question, asked twice with the same credential, answers differently once
 * something has changed underneath.
 */
function aBackendWhere({ callerIs }: { callerIs: Role }) {
  const state = { role: callerIs, revoked: false };

  const membersNow = (): Member[] => [
    {
      membershipId: 'm-1',
      personId: 'person-caller',
      email: 'caller@example.com',
      role: state.role,
      active: true,
    },
    {
      membershipId: 'm-2',
      personId: 'person-editor',
      email: 'editor@example.com',
      role: 'editor',
      active: !state.revoked,
    },
  ];

  server.use(
    http.post('/api/auth/sign-in', () =>
      HttpResponse.json({
        accessToken: 'access-journey',
        refreshToken: 'refresh-journey',
        sessionExpiresAt: '2026-08-19T00:15:00.000Z',
      }),
    ),
    http.get('/api/me', () =>
      HttpResponse.json({
        personId: 'person-caller',
        email: 'caller@example.com',
        isOperator: false,
        memberships: [
          { tenantId: 't-acme', tenantName: 'Acme', role: state.role },
        ],
      }),
    ),
    http.get('/api/tenants/t-acme/members', () =>
      HttpResponse.json(membersNow()),
    ),
    http.patch(
      '/api/tenants/t-acme/members/:membershipId',
      async ({ request, params }) => {
        const { role } = (await request.json()) as { role: Role };
        if (params.membershipId === 'm-1') state.role = role;
        return new HttpResponse(null, { status: 204 });
      },
    ),
    http.delete('/api/tenants/t-acme/members/:membershipId', () => {
      state.revoked = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return state;
}

function start() {
  return renderAt(
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>,
    { at: '/sign-in' },
  );
}

async function signIn() {
  await user.type(await screen.findByLabelText(/email/i), 'caller@example.com');
  await user.type(screen.getByLabelText(/password/i), 'secret');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

function rowFor(email: string) {
  return screen.getByRole('row', { name: new RegExp(email) });
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('the whole journey', () => {
  it('signs in, reaches a tenant, changes something, and signs out', async () => {
    aBackendWhere({ callerIs: 'admin' });
    start();

    await signIn();

    // The standing decides where they land and what the frame says. Awaited,
    // not read: the frame appears with the standing, and the tenant appears in
    // it only once the root has resolved into one.
    expect(await screen.findByText('caller@example.com')).toBeInTheDocument();
    expect(await findActingIn('Acme')).toHaveTextContent('admin');
    expect(await screen.findByText('editor@example.com')).toBeInTheDocument();

    await user.click(
      within(rowFor('editor@example.com')).getByRole('button', {
        name: /revoke/i,
      }),
    );

    // 7.5: the listing as it now stands, without a reload.
    expect(
      await within(rowFor('editor@example.com')).findByText('Revoked'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
    // 2.4: nothing kept. The next person on this browser starts from nothing.
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull();
    expect(session.accessToken()).toBeNull();
  });
});

describe('a role changed between two asks', () => {
  it('shows in the second, with the credential unchanged', async () => {
    aBackendWhere({ callerIs: 'admin' });
    start();
    await signIn();
    await screen.findByText('editor@example.com');

    const credential = session.accessToken();
    expect(credential).toBe('access-journey');

    await user.selectOptions(
      within(rowFor('caller@example.com')).getByRole('combobox'),
      'viewer',
    );

    expect(await findActingIn(/viewer/)).toBeTruthy();
    // The whole reason standing is a query. Had the role travelled inside the
    // token, seeing this would have required a new one — and the application
    // would have had to sign somebody out to tell them their own role.
    expect(session.accessToken()).toBe(credential);
    // And the controls that role no longer permits are gone with it.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /revoke/i })).toBeNull();
    });
  });
});

describe('an action the application offered and the backend refuses', () => {
  it('is an ordinary outcome, not an impossible one', async () => {
    aBackendWhere({ callerIs: 'admin' });
    start();
    await signIn();
    await screen.findByText('editor@example.com');

    server.use(
      http.delete('/api/tenants/t-acme/members/:membershipId', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'the requested record does not exist' },
          { status: 404 },
        ),
      ),
    );
    await user.click(
      within(rowFor('editor@example.com')).getByRole('button', {
        name: /revoke/i,
      }),
    );

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent(/not available/i);
    // 9.1 and 9.4 in one assertion: the application drew a control its role
    // permitted, the backend disagreed, and nothing here treats that as a
    // defect. The screen is still there and still usable.
    expect(screen.getByText('editor@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument();
  });
});
