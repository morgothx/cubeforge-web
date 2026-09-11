import type {
  CallerStanding,
  Member,
  ModelledAnswer,
  Role,
  Session,
  VocabularyGrouping,
} from './types';

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

describe('the shapes the analytics routes answer with', () => {
  it('reads a grouping only in the three shapes it can be drawn in', () => {
    const labelled: VocabularyGrouping = {
      name: 'product',
      shape: 'labelled',
      codeColumn: 'product_code',
      nameColumn: 'product_name',
    };
    expect(labelled.shape).toBe('labelled');

    const invented: VocabularyGrouping = {
      name: 'region',
      // @ts-expect-error a shape the dashboard has no way to render
      shape: 'map',
      column: 'region',
    };
    expect(invented).toBeDefined();

    const halfLabelled: VocabularyGrouping = {
      name: 'product',
      shape: 'labelled',
      // @ts-expect-error a labelled grouping names its code and name by role
      column: 'product_code',
    };
    expect(halfLabelled).toBeDefined();
  });

  it('keeps an answer that was never exported apart from one that has rows', () => {
    const quiet: ModelledAnswer = {
      state: 'answered',
      completeThrough: '2026-09-10T03:00:00.000Z',
      servedFrom: 'prepared',
      rows: [],
    };
    const absent: ModelledAnswer = { state: 'never-exported' };
    expect([quiet.state, absent.state]).toEqual(['answered', 'never-exported']);

    const told: ModelledAnswer = {
      state: 'answered',
      completeThrough: '2026-09-10T03:00:00.000Z',
      // @ts-expect-error provenance is one of two things the platform reports
      servedFrom: 'cache',
      rows: [],
    };
    expect(told).toBeDefined();

    // @ts-expect-error an answer never exported has no rows to reach
    const leaked: ModelledAnswer = { state: 'never-exported', rows: [] };
    expect(leaked).toBeDefined();
  });
});
