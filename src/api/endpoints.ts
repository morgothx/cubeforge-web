import { request, unauthorized } from './http';
import { ApiError } from './refusal';
import type {
  CallerStanding,
  Member,
  ModelledAnswer,
  QuestionBody,
  Role,
  Session,
  Vocabulary,
} from './types';

/**
 * Every route this feature uses, written down exactly once.
 *
 * The value is not abstraction — most of these are a verb and a path — it is
 * that a URL exists in one place. A component that assembled its own would put
 * a second copy of the backend's shape somewhere the type system cannot reach,
 * and the two would drift the first time a path changed. A test reads this
 * directory's source to keep that true (9.2).
 *
 * The split between the two functions below it is the interesting part. Signing
 * in, renewing and signing out travel `unauthorized`: they carry no access
 * token, and none of them may renew. Everything else travels `request`, which
 * attaches the credential and, when it has run out, renews it and asks again.
 */

/** Where a tenant's identifier is put into a path, escaped, in one place. */
function tenantPath(tenantId: string): string {
  return `/tenants/${encodeURIComponent(tenantId)}`;
}

function membersOf(tenantId: string): string {
  return `${tenantPath(tenantId)}/members`;
}

export function signIn(credentials: {
  email: string;
  password: string;
}): Promise<Session> {
  return unauthorized<Session>('/auth/sign-in', {
    method: 'POST',
    body: credentials,
  });
}

/**
 * Exchanges a refresh token for a new session.
 *
 * Callers of this are the ones restoring a stored session on start-up; the
 * request layer renews on its own and does not come through here, because it
 * cannot import this module without a cycle.
 */
export function refresh(refreshToken: string): Promise<Session> {
  return unauthorized<Session>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function signOut(refreshToken: string): Promise<void> {
  return unauthorized<void>('/auth/sign-out', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function fetchStanding(): Promise<CallerStanding> {
  return request<CallerStanding>('/me');
}

/**
 * Every member of the tenant, revoked ones included.
 *
 * The query is not optional and there is no parameter for it. Requirement 7.1
 * asks the listing to show whether a membership is currently active, and the
 * backend leaves revoked memberships out unless asked for them — so without
 * this the column would read `true` on every row it ever rendered, which is a
 * column that answers nothing. Found in review: the design's signature omitted
 * the query and the two requirements only contradict each other at this line.
 */
export function listMembers(tenantId: string): Promise<readonly Member[]> {
  return request<readonly Member[]>(
    `${membersOf(tenantId)}?includeInactive=true`,
  );
}

/**
 * The backend answers `201` with the new membership, and this discards it: the
 * caller invalidates the listing and reads the authoritative answer from there
 * rather than splicing a second one into the cache (7.5).
 */
export async function inviteMember(
  tenantId: string,
  invitation: { email: string; role: Role },
): Promise<void> {
  await request<unknown>(membersOf(tenantId), {
    method: 'POST',
    body: invitation,
  });
}

export function changeMemberRole(
  tenantId: string,
  membershipId: string,
  role: Role,
): Promise<void> {
  return request<void>(
    `${membersOf(tenantId)}/${encodeURIComponent(membershipId)}`,
    { method: 'PATCH', body: { role } },
  );
}

export function revokeMembership(
  tenantId: string,
  membershipId: string,
): Promise<void> {
  return request<void>(
    `${membersOf(tenantId)}/${encodeURIComponent(membershipId)}`,
    { method: 'DELETE' },
  );
}

/**
 * What may be asked of this tenant's analytics: the measures, the groupings,
 * the moments, the longest period and the calendar, as the platform publishes
 * them. The dashboard offers exactly these and defines no name of its own.
 */
export function fetchVocabulary(tenantId: string): Promise<Vocabulary> {
  return request<Vocabulary>(`${tenantPath(tenantId)}/analytics/vocabulary`);
}

/**
 * The refusals whose words the platform wrote to be read.
 *
 * An answer too large names its limit and both remedies (7.2); a period too
 * long names the longest the platform answers. Both are about the question a
 * person can reshape, so they pass through as written.
 */
const READABLE_REFUSALS: readonly (string | undefined)[] = [
  'question',
  'period',
];

/**
 * One composed question, answered — or refused in terms a person can act on.
 *
 * **One reinterpretation, and only here.** Every other rejection this route can
 * give is about something the dashboard composed rather than something the
 * person typed: a measure or grouping the platform does not offer, or a body it
 * could not read. The person chose from what they were offered and cannot fix
 * either, so presenting it as `rejected` — tinted, against a field — would blame
 * them for the dashboard's disagreement with the platform (7.1). It becomes
 * `not-offered`, which blames nobody and quotes nothing back.
 *
 * No abort signal is passed. An answer that arrives after its view has moved on
 * is discarded by its key, and under StrictMode an abort would cancel and resend
 * — spending a second question of the ten a minute allows.
 */
export async function askQuestion(
  tenantId: string,
  body: QuestionBody,
): Promise<ModelledAnswer> {
  try {
    return await request<ModelledAnswer>(
      `${tenantPath(tenantId)}/analytics/questions`,
      { method: 'POST', body },
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.refusal.kind === 'rejected' &&
      !READABLE_REFUSALS.includes(error.refusal.field)
    ) {
      throw new ApiError({ kind: 'not-offered' });
    }
    throw error;
  }
}
