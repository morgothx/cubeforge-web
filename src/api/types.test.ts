import type { CallerStanding, Member, Role, Session } from './types';

/**
 * Type-level assertions, checked by `pnpm typecheck` rather than by the runner.
 *
 * `@ts-expect-error` is the whole mechanism: a directive that finds nothing to
 * suppress is itself an error, so each of these fails the build the moment the
 * shape it guards stops being wrong. That makes them assertions rather than
 * comments.
 */
describe('the shapes the backend answers with', () => {
  it('takes a withheld address as absent, never as an empty value', () => {
    // The backend *omits* `email` for a caller who may not see it. If this type
    // allowed `null`, requirement 7.2 would be unimplementable: a listing could
    // not tell "not for you" from "this person has no address", and the screen
    // would render a blank that reads as missing data.
    const withheld: Member = {
      membershipId: 'm-1',
      personId: 'p-1',
      role: 'viewer',
      active: true,
    };
    expect(withheld.email).toBeUndefined();

    const nulled: Member = {
      membershipId: 'm-1',
      personId: 'p-1',
      // @ts-expect-error an address is absent or present, never explicitly empty
      email: null,
      role: 'viewer',
      active: true,
    };
    expect(nulled).toBeDefined();
  });

  it('admits only the three roles the platform has', () => {
    const roles: Role[] = ['admin', 'editor', 'viewer'];
    expect(roles).toHaveLength(3);

    // @ts-expect-error the platform has no such role
    const invented: Role = 'owner';
    expect(invented).toBe('owner');
  });

  it('carries the caller standing the backend actually returns', () => {
    const standing: CallerStanding = {
      personId: 'p-1',
      email: 'caller@example.com',
      isOperator: false,
      memberships: [{ tenantId: 't-1', tenantName: 'Acme', role: 'admin' }],
    };

    // Requirement 9.3: the backend already excludes tenants that no longer
    // grant access, so nothing here records a status to filter on. A field for
    // one would be an invitation to filter a second time.
    const filterable: CallerStanding['memberships'][number] = {
      tenantId: 't-1',
      tenantName: 'Acme',
      role: 'admin',
      // @ts-expect-error the answer carries no membership status to re-filter
      active: true,
    };

    expect(standing.memberships).toHaveLength(1);
    expect(filterable.tenantId).toBe('t-1');
  });

  it('carries what signing in answers with', () => {
    const session: Session = {
      accessToken: 'a',
      refreshToken: 'r',
      sessionExpiresAt: '2026-08-18T00:15:00.000Z',
    };

    expect(session.sessionExpiresAt).toContain('T');
  });
});
