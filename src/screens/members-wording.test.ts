import { whatYouMayDo } from './members-wording';
import { may } from '../access/permissions';
import { ROLES } from '../api/types';

/**
 * The sentence, held to the permissions it describes.
 *
 * A sentence about what somebody may do is a claim the application makes in its
 * own voice, and the only way it stays true is by being derived from the same
 * table the controls are. These tests assert the derivation rather than the
 * prose: the words may be rewritten freely, and they may not come to disagree
 * with `may`.
 */
describe('what you may do here', () => {
  it('names the role the person actually holds', () => {
    for (const role of ROLES) {
      expect(whatYouMayDo(role)).toContain(role);
    }
  });

  it('promises inviting exactly where inviting is permitted', () => {
    for (const role of ROLES) {
      expect(/invite/i.test(whatYouMayDo(role))).toBe(
        may(role, 'members:invite'),
      );
    }
  });

  it('says the access cannot be changed exactly where it cannot', () => {
    for (const role of ROLES) {
      const mayChange =
        may(role, 'members:change-role') || may(role, 'members:revoke');

      expect(/but not change it/i.test(whatYouMayDo(role))).toBe(!mayChange);
    }
  });

  it('says something for every role there is', () => {
    // Not "for admin and viewer". A role added to `ROLES` with no sentence
    // would reach a person as an empty line under the title.
    for (const role of ROLES) {
      expect(whatYouMayDo(role).length).toBeGreaterThan(0);
    }
  });
});
