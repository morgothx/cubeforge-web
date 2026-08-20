/**
 * The shapes `cubeforge-api` actually answers with.
 *
 * Written from its source rather than from its documentation, because two of
 * these are load-bearing in ways a summary would flatten — see `Member.email`
 * and the absence of a status on a membership.
 */

/**
 * Every role, in one place and in an order a listing can rely on.
 *
 * A tuple rather than a bare union because the union alone cannot be
 * enumerated: a control offering the roles would otherwise restate them, and
 * the restatement is what goes out of date.
 */
export const ROLES = ['admin', 'editor', 'viewer'] as const;

export type Role = (typeof ROLES)[number];

/** What signing in and renewing both answer with. */
export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionExpiresAt: string;
}

/**
 * A tenant the caller can reach, and the role they hold in it.
 *
 * There is no status here and there must not be one: the backend already
 * excludes memberships that no longer grant access — revoked ones, and ones in
 * a tenant that is no longer active — so a field to filter on would invite a
 * second answer to a question already answered (9.3).
 */
export interface TenantMembership {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: Role;
}

export interface CallerStanding {
  readonly personId: string;
  readonly email: string;
  readonly isOperator: boolean;
  readonly memberships: readonly TenantMembership[];
}

/**
 * One member of a tenant, as its listing reports them.
 *
 * `email` is optional rather than nullable because the backend **omits** the
 * field for a caller who is not an administrator here; it never sends an empty
 * one. The distinction is the whole of requirement 7.2: absent means withheld,
 * and a listing that rendered a blank instead would read as missing data.
 *
 * `active` is `false` for a revoked membership, which the listing includes on
 * purpose — the caller asked who is in this tenant, and a revoked member is
 * part of that answer.
 */
export interface Member {
  readonly membershipId: string;
  readonly personId: string;
  readonly email?: string;
  readonly role: Role;
  readonly active: boolean;
}
