import { may } from '../access/permissions';
import type { Role } from '../api/types';

/**
 * What the person looking at this screen may do here, said in words.
 *
 * This sentence is the reason the repaint happened. The screen it replaced was
 * a table and a form, and somebody meeting it could not tell what the product
 * *was* — still less what their own role let them do in it. A role name in a
 * corner does not answer that: "viewer" is a label, and "you can see who has
 * access but not change it" is the same fact in a form somebody can act on.
 *
 * **Derived from `may`, never written out per role.** A sentence hand-written
 * beside a control is a second authorization model — quieter than the first,
 * answerable to nobody, and wrong the day a permission moves. Here the claim
 * and the render read the same table, so a screen that promises inviting is one
 * that mounts the invite form.
 */
export function whatYouMayDo(role: Role): string {
  const invite = may(role, 'members:invite');
  const change =
    may(role, 'members:change-role') || may(role, 'members:revoke');

  if (invite && change) {
    return `You are ${role} here, so you can invite people and change what they may do.`;
  }
  if (invite) {
    return `You are ${role} here, so you can invite people.`;
  }
  if (change) {
    return `You are ${role} here, so you can change what people may do.`;
  }
  return `You are ${role} here, so you can see who has access but not change it.`;
}
