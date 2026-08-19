import type { Role } from '../api/types';

/**
 * What a role may do inside a tenant, decided once.
 *
 * The navigation and the members screen both need this answer. Asked in two
 * places with two spellings it eventually diverges, and the way that shows up
 * is a control hidden from the menu and left enabled on the page — requirement
 * 6.1's failure mode exactly.
 *
 * **This protects nothing.** Every rule here is enforced by a guard in
 * `cubeforge-api`, and the application must still handle that guard refusing an
 * action it offered, because a role can change between drawing a control and
 * using it (6.3). What this table buys is that a person is not shown a button
 * whose only possible outcome is a refusal.
 */

export const PERMISSIONS = [
  'members:read',
  'members:invite',
  'members:change-role',
  'members:revoke',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Which roles each permission admits — every permission, exhaustively.
 *
 * Exported because the totality is the point, and a type is the only thing that
 * can enforce it. A chain of `if (role === 'admin')` produces identical answers
 * for today's four permissions, which is why a runtime test cannot tell the two
 * apart: a probe replacing the table with comparisons failed nothing. What the
 * comparisons lose is silent — the fifth permission gets no decision and no
 * error — so the guarantee is asserted against this type instead.
 */
export type RoleAdmission = Readonly<Record<Permission, readonly Role[]>>;

/**
 * Every entry mirrors a declaration on `tenant-members.controller.ts`. A
 * difference between roles here that no guard makes over there would be a
 * second authorization model, quieter than the first and answerable to nobody.
 */
const ADMITTED: RoleAdmission = {
  // Every member may see who is here. The backend withholds the addresses from
  // everyone but an administrator, which is a separate decision it makes in the
  // response rather than one this table could express.
  'members:read': ['admin', 'editor', 'viewer'],
  'members:invite': ['admin'],
  'members:change-role': ['admin'],
  'members:revoke': ['admin'],
};

export function may(role: Role, permission: Permission): boolean {
  return ADMITTED[permission].includes(role);
}
