import type { Role } from '../api/types';
import {
  may,
  PERMISSIONS,
  type Permission,
  type RoleAdmission,
} from './permissions';

/**
 * The one answer to "may this role do this here".
 *
 * The navigation and the members screen both ask it. Asked in two places with
 * two spellings, it eventually answers differently in each — a control hidden
 * in the menu and left enabled on the page, which is the exact bug requirement
 * 6.1 describes.
 *
 * Nothing here protects anything: the backend's guards do. This decides what is
 * worth offering, so that a person is not shown a button whose only outcome is
 * a refusal.
 */
describe('what a role may do in a tenant', () => {
  /**
   * The backend's own declarations, transcribed from
   * `tenant-members.controller.ts` on 2026-08-18. Every difference between the
   * roles below must exist because a guard over there makes it exist — that is
   * what stops this table from drifting into a second, quieter authorization
   * model.
   */
  const AS_THE_BACKEND_DECLARES: Readonly<Record<Permission, readonly Role[]>> =
    {
      'members:read': ['admin', 'editor', 'viewer'],
      'members:invite': ['admin'],
      'members:change-role': ['admin'],
      'members:revoke': ['admin'],
    };

  const EVERY_ROLE: readonly Role[] = ['admin', 'editor', 'viewer'];

  it.each(PERMISSIONS)(
    'answers %s exactly as the backend guards it',
    (permission) => {
      const admitted = EVERY_ROLE.filter((role) => may(role, permission));

      expect([...admitted].sort()).toEqual(
        [...AS_THE_BACKEND_DECLARES[permission]].sort(),
      );
    },
  );

  it('lets every role read the listing', () => {
    for (const role of EVERY_ROLE) {
      expect(may(role, 'members:read')).toBe(true);
    }
  });

  it('lets only an administrator change anything', () => {
    const changes: Permission[] = [
      'members:invite',
      'members:change-role',
      'members:revoke',
    ];

    for (const permission of changes) {
      expect(may('admin', permission)).toBe(true);
      expect(may('editor', permission)).toBe(false);
      expect(may('viewer', permission)).toBe(false);
    }
  });

  it('treats an editor and a viewer identically here, and that is not a mistake', () => {
    // The two roles differ elsewhere on the platform and will differ on the
    // data screens a later feature adds. On the members listing they do not,
    // because the backend admits both to the read and neither to the writes.
    // Asserted so that nobody "fixes" the apparent redundancy by inventing a
    // distinction the guards do not make.
    for (const permission of PERMISSIONS) {
      expect(may('editor', permission)).toBe(may('viewer', permission));
    }
  });

  it('cannot express a table that leaves a permission undecided', () => {
    // The guarantee that separates a table from a chain of comparisons, and it
    // is a compile-time one: today's four permissions produce identical answers
    // either way, so a probe swapping the table for `role === 'admin'` failed
    // nothing at runtime. What comparisons lose is that the *fifth* permission
    // gets no decision and no complaint. Checked by `pnpm typecheck`, which is
    // the only gate that sees it.
    // @ts-expect-error a permission with nobody assigned to it is not a table
    const partial: RoleAdmission = {
      'members:read': ['admin', 'editor', 'viewer'],
      'members:invite': ['admin'],
      'members:change-role': ['admin'],
    };

    expect(Object.keys(partial)).toHaveLength(3);
  });

  it('names every permission the feature has, so the matrix cannot be partial', () => {
    // `PERMISSIONS` is what the first test iterates. If a permission could be
    // added without appearing here, the matrix above would silently stop
    // covering it.
    expect([...PERMISSIONS].sort()).toEqual(
      Object.keys(AS_THE_BACKEND_DECLARES).sort(),
    );
  });
});
