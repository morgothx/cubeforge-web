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

/**
 * A measure the platform offers, by the name a question uses.
 *
 * Names are plain strings on purpose. A union of today's names would be the
 * copy of the vocabulary that the platform now publishes precisely so that
 * nobody has to keep one: the dashboard learns what exists by asking.
 */
export interface VocabularyMeasure {
  readonly name: string;
  /** Counts movements recorded before a question's period as well as within it. */
  readonly cumulative: boolean;
}

/**
 * A grouping, and the row columns it fills.
 *
 * The shape, unlike the name, is a closed union: each one is drawn a different
 * way, so a shape the dashboard has never seen must fail to compile rather than
 * render as something it is not. A labelled entity names its two columns by
 * role because which one is the code is exactly what a reader cannot guess.
 */
export type VocabularyGrouping =
  | { readonly name: string; readonly shape: 'day'; readonly column: string }
  | {
      readonly name: string;
      readonly shape: 'category';
      readonly column: string;
    }
  | {
      readonly name: string;
      readonly shape: 'labelled';
      readonly codeColumn: string;
      readonly nameColumn: string;
    };

/** What may be asked, as `GET /tenants/:tenantId/analytics/vocabulary` answers. */
export interface Vocabulary {
  readonly measures: readonly VocabularyMeasure[];
  readonly groupings: readonly VocabularyGrouping[];
  readonly readBy: readonly string[];
  readonly longestPeriodDays: number;
  /** An IANA zone. Every day the platform counts is a day in this zone. */
  readonly calendar: string;
}

/** A composed question, as `POST /tenants/:tenantId/analytics/questions` takes it. */
export interface QuestionBody {
  readonly measures: readonly string[];
  readonly groupings: readonly string[];
  readonly from: string;
  readonly to: string;
  readonly by: string;
}

/**
 * One value in a row, in the form the platform sends it.
 *
 * A measure may arrive as a decimal string — the engine reports every column
 * as text — and absence arrives as `null`, never as an empty string. Reading
 * either into a number is the reader's job, and guessing is not allowed there.
 */
export type RowValue = string | number | null;

/**
 * What one question came back with: rows, or the fact that there could be
 * none yet.
 *
 * `rows` is unreachable until the state has been narrowed, which is what keeps
 * a tenant nothing was ever exported for from being drawn as a quiet period.
 */
export type ModelledAnswer =
  | {
      readonly state: 'answered';
      /** An ISO instant: the moment the rows are complete through. */
      readonly completeThrough: string;
      readonly servedFrom: 'prepared' | 'exported-objects';
      readonly rows: readonly Readonly<Record<string, RowValue>>[];
    }
  | { readonly state: 'never-exported' };
